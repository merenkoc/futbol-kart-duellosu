import { randomUUID } from 'node:crypto';
import type { Server } from 'socket.io';
import type { ClientToServerEvents, GameConfig, MatchMode, ServerToClientEvents } from '@fkd/shared';
import { cardsByPool, config, fieldTasks, gkTasks, resolvePoolId } from '../data/loadData.js';
import { MatchSession } from '../game/session.js';
import { createLobby } from '../realtime/lobby.js';
import * as store from '../realtime/store.js';
import type { TypedSocket } from '../realtime/types.js';

const RECONNECT_GRACE_MS = 60_000;

// Basit rate-limit: socket başına RL_WINDOW_MS içinde en fazla RL_MAX pahalı işlem
// (maç kurulumu). Oyun-içi eventler (pick/play/reconnect) için ayrı, daha gevşek
// bir kova var: insan hızında asla dolmaz, flood'u keser.
const RL_MAX = 6;
const RL_GAME_MAX = 30;
const RL_WINDOW_MS = 3000;
const rlBuckets = new Map<string, number[]>();
function rateLimited(key: string, max: number): boolean {
  const now = Date.now();
  const arr = (rlBuckets.get(key) ?? []).filter((t) => now - t < RL_WINDOW_MS);
  if (arr.length >= max) {
    rlBuckets.set(key, arr);
    return true;
  }
  arr.push(now);
  rlBuckets.set(key, arr);
  return false;
}

/**
 * Faz 3: "bota karşı", "arkadaşla oyna" ve "rastgele eşleş" tek bir orkestrasyon
 * katmanından geçer. Bir `MatchSession` iki gerçek socket'e (friend/matchmaking)
 * ya da bir gerçek + bir sanal bot'a (mode==='bot') bağlanabilir; hangi taraf
 * hangi event'i alacağını `realtime/store.ts` (socket<->oyuncu eşleşmesi) belirler.
 * Rakibin kilitlenmemiş seçimi / eli hiçbir emit'te karşı tarafa gönderilmez.
 */
export function registerHandlers(io: Server<ClientToServerEvents, ServerToClientEvents>): void {
  const lobby = createLobby(beginMatch);

  function tooFast(socket: TypedSocket): boolean {
    if (rateLimited(socket.id, RL_MAX)) {
      socket.emit('error', { message: 'Çok hızlı işlem — biraz yavaşla.' });
      return true;
    }
    return false;
  }

  function gameTooFast(socket: TypedSocket): boolean {
    if (rateLimited(`g:${socket.id}`, RL_GAME_MAX)) {
      socket.emit('error', { message: 'Çok hızlı işlem — biraz yavaşla.' });
      return true;
    }
    return false;
  }

  io.on('connection', (socket: TypedSocket) => {
    socket.on('bot:start', (payload) => {
      if (tooFast(socket)) return;
      beginMatch('bot', [socket, null], resolvePoolId(payload?.poolId));
    });
    socket.on('room:create', (payload) => {
      if (tooFast(socket)) return;
      lobby.createRoom(socket, resolvePoolId(payload?.poolId));
    });
    socket.on('room:join', (payload) => {
      if (tooFast(socket)) return;
      lobby.joinRoom(typeof payload?.roomId === 'string' ? payload.roomId : '', socket);
    });
    socket.on('queue:join', (payload) => {
      if (tooFast(socket)) return;
      lobby.joinQueue(socket, resolvePoolId(payload?.poolId));
    });

    socket.on('match:reconnect', (payload) => {
      if (gameTooFast(socket)) return;
      const matchId = typeof payload?.matchId === 'string' ? payload.matchId : '';
      const playerToken = typeof payload?.playerToken === 'string' ? payload.playerToken : '';
      const entry = store.getEntry(matchId);
      if (!entry) {
        socket.emit('error', { message: 'Maç bulunamadı' });
        return;
      }
      const idx = entry.session.playerTokens.indexOf(playerToken);
      if (idx !== 0 && idx !== 1) {
        socket.emit('error', { message: 'Geçersiz oturum' });
        return;
      }
      if (entry.session.phase === 'finished') {
        socket.emit('error', { message: 'Maç zaten bitti' });
        return;
      }
      store.rebindSocket(matchId, idx, socket);
      emitToPlayer(matchId, idx === 0 ? 1 : 0, 'opponent:reconnected');
      resyncPlayer(entry.session, idx);
    });

    socket.on('draft:pick', (payload) => {
      if (gameTooFast(socket)) return;
      const cardId = typeof payload?.cardId === 'string' ? payload.cardId : '';
      const { session, playerIdx } = requireSession(socket) ?? {};
      if (!session) return;
      try {
        session.draftPick(playerIdx!, cardId);
      } catch (err) {
        socket.emit('error', { message: (err as Error).message });
        return;
      }
      handleDraftAdvance(session, playerIdx!);
    });

    socket.on('round:playCard', (payload) => {
      if (gameTooFast(socket)) return;
      const cardId = typeof payload?.cardId === 'string' ? payload.cardId : '';
      const { session, playerIdx } = requireSession(socket) ?? {};
      if (!session) return;
      try {
        session.playCard(playerIdx!, cardId);
      } catch (err) {
        socket.emit('error', { message: (err as Error).message });
        return;
      }
      handleRoundAdvance(session, playerIdx!);
    });

    socket.on('penalty:pickShooter', (payload) => {
      if (gameTooFast(socket)) return;
      const cardId = typeof payload?.cardId === 'string' ? payload.cardId : '';
      const { session, playerIdx } = requireSession(socket) ?? {};
      if (!session) return;
      try {
        session.pickShooter(playerIdx!, cardId);
      } catch (err) {
        socket.emit('error', { message: (err as Error).message });
        return;
      }
      handlePenaltyAdvance(session, playerIdx!);
    });

    socket.on('match:rematch', () => {
      if (tooFast(socket)) return;
      const link = store.getLink(socket.id);
      if (!link) {
        socket.emit('error', { message: 'Aktif maç yok' });
        return;
      }
      const entry = store.getEntry(link.matchId);
      if (!entry) return;

      if (entry.session.mode === 'bot') {
        const poolId = entry.session.poolId;
        store.deleteEntry(link.matchId);
        beginMatch('bot', [socket, null], poolId);
        return;
      }

      entry.rematchRequested[link.playerIdx] = true;
      const other = link.playerIdx === 0 ? 1 : 0;
      if (entry.rematchRequested[other]) {
        const [s0, s1] = entry.sockets;
        const { mode, poolId } = entry.session;
        store.deleteEntry(link.matchId);
        if (s0 && s1) beginMatch(mode, [s0, s1], poolId);
      } else {
        emitToPlayer(link.matchId, other, 'match:rematchRequested');
      }
    });

    socket.on('disconnect', () => {
      rlBuckets.delete(socket.id);
      rlBuckets.delete(`g:${socket.id}`);
      lobby.forget(socket);
      const link = store.unregisterSocket(socket.id);
      if (!link) return;
      const entry = store.getEntry(link.matchId);
      if (!entry) return;

      if (entry.session.phase === 'finished') {
        store.deleteEntry(link.matchId);
        return;
      }

      if (entry.session.mode === 'bot') {
        // Bot maçının rakibi yok; forfeit yerine reconnect penceresi boyunca canlı
        // tut ki sayfa yenilemede maç kaldığı yerden sürsün (docs O1). Dönülmezse temizle.
        const cleanup = setTimeout(() => {
          const e = store.getEntry(link.matchId);
          if (e && !e.sockets[link.playerIdx]) store.deleteEntry(link.matchId);
        }, RECONNECT_GRACE_MS);
        cleanup.unref?.();
        store.setDisconnectTimer(link.matchId, link.playerIdx, cleanup);
        return;
      }

      const other = link.playerIdx === 0 ? 1 : 0;
      emitToPlayer(link.matchId, other, 'opponent:disconnected', { graceMs: RECONNECT_GRACE_MS });
      const timer = setTimeout(() => forfeit(link.matchId, link.playerIdx), RECONNECT_GRACE_MS);
      store.setDisconnectTimer(link.matchId, link.playerIdx, timer);
    });
  });

  // Periyodik zombi maç temizliği (GC) — reconnect penceresinden (60 sn) büyük eşik.
  const gcTimer = setInterval(() => {
    const n = store.sweep(120_000);
    if (n > 0) console.log(`[gc] ${n} zombi maç temizlendi`);
  }, 5 * 60_000);
  gcTimer.unref?.();

  // --- Maç kurulumu (bot / friend / matchmaking ortak) ---

  function beginMatch(mode: MatchMode, sockets: [TypedSocket, TypedSocket | null], poolId: string): void {
    for (const s of sockets) {
      if (!s) continue;
      // Lobi hijyeni: maça giren socket'in bekleyen oda/kuyruk girdisi kalmasın
      // (aynı socket hem oda host'u hem kuyrukta olup iki maça bölünemesin).
      lobby.forget(s);
      const prev = store.getLink(s.id);
      if (!prev) continue;
      const e = store.getEntry(prev.matchId);
      if (!e) continue;
      if (e.session.mode === 'bot' || e.session.phase === 'finished') {
        // Sızıntı önleme: menü→bot→menü→bot döngüsünde öksüz kalan MatchSession girdileri.
        store.deleteEntry(prev.matchId);
      } else {
        // Aktif multiplayer maçı olan taraf yeni maça giremez: girdinin socket
        // referansı dolu kaldığı için GC asla süpüremez (kalıcı sızıntı) ve
        // rakip forfeit tetiklenmeden sonsuza dek bekler.
        for (const t of sockets) t?.emit('error', { message: 'Oyunculardan biri hâlâ aktif bir maçta.' });
        return;
      }
    }
    const id = randomUUID();
    const tokens: [string, string] = [randomUUID(), randomUUID()];
    const seed = Date.now() ^ Math.floor(Math.random() * 0xffffffff);
    const poolCards = cardsByPool.get(poolId)!; // resolvePoolId geçersizi varsayılana çevirir
    const session = new MatchSession(id, mode, tokens, config as GameConfig, poolCards, fieldTasks, gkTasks, seed, poolId);
    store.createEntry(session, sockets);

    for (const idx of [0, 1] as const) {
      sockets[idx]?.emit('match:start', { matchId: id, playerIdx: idx, playerToken: tokens[idx], poolId });
    }
    emitDraftOptions(session);
    if (mode === 'bot') scheduleBotDraftPick(session);
  }

  function forfeit(matchId: string, disconnectedIdx: 0 | 1): void {
    const entry = store.getEntry(matchId);
    if (!entry || entry.sockets[disconnectedIdx]) return; // reconnect oldu
    const winner = disconnectedIdx === 0 ? 1 : 0;
    entry.session.finalWinner = winner;
    entry.session.finalDecidedBy = 'forfeit';
    entry.session.phase = 'finished';
    emitToPlayer(matchId, winner, 'match:end', {
      winner,
      decidedBy: 'forfeit',
      finalScores: entry.session.matchState?.scores ?? [0, 0],
      history: entry.session.matchState?.history ?? [],
      penalty: null,
    });
    store.deleteEntry(matchId);
  }

  function requireSession(socket: TypedSocket): { session: MatchSession; playerIdx: 0 | 1 } | undefined {
    const link = store.getLink(socket.id);
    const session = link ? store.getEntry(link.matchId)?.session : undefined;
    if (!link || !session) {
      socket.emit('error', { message: 'Aktif maç bulunamadı' });
      return undefined;
    }
    return { session, playerIdx: link.playerIdx };
  }

  function emitToPlayer<E extends keyof ServerToClientEvents>(
    matchId: string,
    idx: 0 | 1,
    event: E,
    ...args: Parameters<ServerToClientEvents[E]>
  ): void {
    const socket = store.getSocket(matchId, idx);
    socket?.emit(event, ...args);
  }

  function otherOf(idx: 0 | 1): 0 | 1 {
    return idx === 0 ? 1 : 0;
  }

  /**
   * Sahne temposu (docs/faz4-duzeltme-plani.md Sorun 1): store'daki girdi hâlâ
   * bu session'a işaret ediyor mu? Forfeit/rematch bekleyen bir timer'ı
   * geçersiz kılmış olabilir — bot zamanlayıcılarındaki guard'la aynı desen.
   */
  function stillActive(session: MatchSession): boolean {
    return store.getEntry(session.id)?.session === session;
  }

  // --- Reconnect senkronizasyonu ---

  function resyncPlayer(session: MatchSession, idx: 0 | 1): void {
    if (session.phase === 'draft') {
      emitToPlayer(session.id, idx, 'draft:options', {
        round: session.draftState.round,
        totalRounds: session.config.draft.rounds,
        isGkRound: session.isDraftGkRound,
        options: session.draftState.options[idx],
      });
      return;
    }
    emitToPlayer(session.id, idx, 'draft:complete', { hand: session.hands![idx] });
    if (session.phase === 'match') {
      emitToPlayer(session.id, idx, 'round:task', {
        round: session.matchState!.round,
        totalRounds: session.config.match.rounds,
        task: session.currentMatchTask,
      });
      emitToPlayer(session.id, idx, 'match:score', { scores: session.matchState!.scores });
    } else if (session.phase === 'penalty') {
      emitToPlayer(session.id, idx, 'penalty:start', penaltyStartPayload(session, idx));
    }
  }

  /** penalty:start payload'ı — reconnect'te de kullanıldığı için seri durumu ve kilitli seçim dahil. */
  function penaltyStartPayload(session: MatchSession, idx: 0 | 1) {
    const ps = session.penaltyState!;
    return {
      availableShooterIds: session.availableShooterIds(idx),
      totalGoals: ps.goals,
      exchangeIndex: ps.exchanges.length,
      pendingCardId: ps.pending[idx]?.id ?? null,
      opponentPicked: ps.pending[idx === 0 ? 1 : 0] !== null,
    };
  }

  // --- Draft akışı ---

  function emitDraftOptions(session: MatchSession): void {
    for (const idx of [0, 1] as const) {
      emitToPlayer(session.id, idx, 'draft:options', {
        round: session.draftState.round,
        totalRounds: session.config.draft.rounds,
        isGkRound: session.isDraftGkRound,
        options: session.draftState.options[idx],
      });
    }
  }

  function scheduleBotDraftPick(session: MatchSession): void {
    const delay = session.botDelay();
    setTimeout(() => {
      if (store.getEntry(session.id)?.session !== session || session.phase !== 'draft') return;
      try {
        const card = session.botDraftChoice();
        session.draftPick(1, card.id);
        handleDraftAdvance(session, 1);
      } catch (err) {
        console.error('[bot] draft hatası:', err);
      }
    }, delay);
  }

  function handleDraftAdvance(session: MatchSession, actedPlayer: 0 | 1): void {
    if (session.phase === 'match') {
      for (const idx of [0, 1] as const) emitToPlayer(session.id, idx, 'draft:complete', { hand: session.hands![idx] });
      startMatchRound(session);
      return;
    }
    const bothPending = session.draftState.picked[0] === null && session.draftState.picked[1] === null;
    if (bothPending) {
      emitDraftOptions(session);
      if (session.mode === 'bot') scheduleBotDraftPick(session);
    } else {
      const other = otherOf(actedPlayer);
      if (session.draftState.picked[other] === null) {
        emitToPlayer(session.id, other, 'draft:opponentPicked', { round: session.draftState.round });
      }
    }
  }

  // --- Maç (tur) akışı ---

  function startMatchRound(session: MatchSession): void {
    if (session.isKeeperRound) {
      const round = session.matchState!.round;
      const task = session.currentMatchTask;
      // Motor turu anında çözer (kaleciler otomatik); sadece emit'ler geciktirilir
      // ki client Kilit Round giriş sekansını (kaleciler kayarak girer) oynatabilsin.
      const keepers = session.playKeeperRoundAuto();
      for (const idx of [0, 1] as const) emitToPlayer(session.id, idx, 'keeperRound:start', { round, task, keepers });

      setTimeout(() => {
        if (!stillActive(session)) return;
        const last = session.matchState!.history[session.matchState!.history.length - 1]!;
        for (const idx of [0, 1] as const) {
          emitToPlayer(session.id, idx, 'round:reveal', last);
          emitToPlayer(session.id, idx, 'match:score', { scores: session.matchState!.scores });
        }

        setTimeout(() => {
          if (!stillActive(session)) return;
          if (session.phase === 'penalty') startPenaltyExchange(session);
          else if (session.phase === 'finished') emitMatchEnd(session);
          else startMatchRound(session);
        }, session.config.timing.keeperRevealMs);
      }, session.config.timing.keeperIntroMs);
      return;
    }
    for (const idx of [0, 1] as const) {
      emitToPlayer(session.id, idx, 'round:task', {
        round: session.matchState!.round,
        totalRounds: session.config.match.rounds,
        task: session.currentMatchTask,
      });
    }
    if (session.mode === 'bot') scheduleBotRoundPick(session);
  }

  function scheduleBotRoundPick(session: MatchSession): void {
    const delay = session.botDelay();
    setTimeout(() => {
      if (store.getEntry(session.id)?.session !== session || session.phase !== 'match') return;
      try {
        const card = session.botRoundChoice();
        session.playCard(1, card.id);
        handleRoundAdvance(session, 1);
      } catch (err) {
        console.error('[bot] tur hatası:', err);
      }
    }, delay);
  }

  function handleRoundAdvance(session: MatchSession, actedPlayer: 0 | 1): void {
    const pending = session.matchState!.pending;
    if (pending[0] === null && pending[1] === null) {
      afterRoundResolved(session);
    } else if (pending[actedPlayer] !== null && pending[otherOf(actedPlayer)] === null) {
      emitToPlayer(session.id, actedPlayer, 'round:waitingOpponent');
    }
  }

  /** Tur resolveRound ile çözüldükten sonra ortak akış: reveal + skor, revealMs sonra faz'a göre devam. */
  function afterRoundResolved(session: MatchSession): void {
    const last = session.matchState!.history[session.matchState!.history.length - 1]!;
    for (const idx of [0, 1] as const) {
      emitToPlayer(session.id, idx, 'round:reveal', last);
      emitToPlayer(session.id, idx, 'match:score', { scores: session.matchState!.scores });
    }

    setTimeout(() => {
      if (!stillActive(session)) return;
      if (session.phase === 'penalty') {
        startPenaltyExchange(session);
      } else if (session.phase === 'finished') {
        emitMatchEnd(session);
      } else {
        startMatchRound(session);
      }
    }, session.config.timing.revealMs);
  }

  // --- Penaltı akışı ---

  function startPenaltyExchange(session: MatchSession): void {
    for (const idx of [0, 1] as const) {
      emitToPlayer(session.id, idx, 'penalty:start', penaltyStartPayload(session, idx));
    }
    if (session.mode === 'bot') scheduleBotShooterPick(session);
  }

  function scheduleBotShooterPick(session: MatchSession): void {
    const delay = session.botDelay();
    setTimeout(() => {
      if (store.getEntry(session.id)?.session !== session || session.phase !== 'penalty') return;
      try {
        const card = session.botShooterChoice();
        session.pickShooter(1, card.id);
        handlePenaltyAdvance(session, 1);
      } catch (err) {
        console.error('[bot] penaltı hatası:', err);
      }
    }, delay);
  }

  function handlePenaltyAdvance(session: MatchSession, actedPlayer: 0 | 1): void {
    const pending = session.penaltyState!.pending;
    if (pending[0] === null && pending[1] === null) {
      const exchange = session.penaltyState!.exchanges[session.penaltyState!.exchanges.length - 1]!;
      const payload = {
        exchangeIndex: session.penaltyState!.exchanges.length - 1,
        shooters: exchange.shooters,
        powers: exchange.powers,
        savePowers: exchange.savePowers,
        goals: exchange.goals,
        totalGoals: session.penaltyState!.goals,
        finished: session.penaltyState!.finished,
        winner: session.penaltyState!.winner,
        decidedBy: session.penaltyState!.decidedBy,
      };
      for (const idx of [0, 1] as const) emitToPlayer(session.id, idx, 'penalty:result', payload);
      setTimeout(() => {
        if (!stillActive(session)) return;
        if (session.phase === 'finished') {
          emitMatchEnd(session);
        } else {
          startPenaltyExchange(session);
        }
      }, session.config.timing.penaltyResultMs);
    } else {
      const other = otherOf(actedPlayer);
      if (pending[other] === null) emitToPlayer(session.id, other, 'penalty:opponentPicked');
    }
  }

  function emitMatchEnd(session: MatchSession): void {
    const payload = {
      winner: session.finalWinner!,
      decidedBy: session.finalDecidedBy!,
      finalScores: session.matchState!.scores,
      history: session.matchState!.history,
      penalty:
        session.finalDecidedBy === 'penalty'
          ? { goals: session.penaltyState!.goals, decidedBy: session.penaltyState!.decidedBy! }
          : null,
    };
    for (const idx of [0, 1] as const) emitToPlayer(session.id, idx, 'match:end', payload);
    // Not: bot maçında girdiyi burada SİLMİYORUZ — "Tekrar Oyna" (match:rematch) girdiyi
    // bulup yeni bir bot maçı başlatabilsin diye. Temizlik disconnect ya da rematch'te olur.
  }
}
