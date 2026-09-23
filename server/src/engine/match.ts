import type { Card, GameConfig, RoundResult, Task } from '@fkd/shared';
import { compareScores, roundPoints, taskScore } from './scoring.js';
import { shuffle, type RNG } from './rng.js';

/**
 * Maç aşaması:
 * - 5 tur; 1,2,4,5 saha turu (kör kart seçimi), 3. tur Kilit Round (kaleciler otomatik).
 * - Görevler maç başında çekilir: 4 tekrarsız saha görevi + 1 kaleci görevi.
 * - Kazanan 3, beraberlikte 1-1.
 * - Oynanan saha kartı tekrar kullanılamaz.
 */

export interface MatchState {
  round: number; // 1 bazlı
  /** Tur sırasına göre görevler (gkRound indeksinde kaleci görevi). */
  tasks: Task[];
  scores: [number, number];
  usedCardIds: [string[], string[]];
  /** Bu turda kilitlenen (henüz açılmamış) kartlar. */
  pending: [Card | null, Card | null];
  history: RoundResult[];
  finished: boolean;
}

export function isKeeperRound(round: number, config: GameConfig): boolean {
  return round === config.match.gkRound;
}

/** Maç görevlerini çeker: saha havuzundan 4 tekrarsız + kaleci havuzundan 1. */
export function createMatchTasks(fieldTasks: Task[], gkTasks: Task[], config: GameConfig, rng: RNG): Task[] {
  const fieldCount = config.match.rounds - 1;
  if (fieldTasks.length < fieldCount) throw new Error('Saha görev havuzu yetersiz');
  if (gkTasks.length < 1) throw new Error('Kaleci görev havuzu boş');
  const pickedField = shuffle(rng, fieldTasks).slice(0, fieldCount);
  const gkTask = shuffle(rng, gkTasks)[0] as Task;
  const tasks: Task[] = [];
  let f = 0;
  for (let r = 1; r <= config.match.rounds; r++) {
    tasks.push(isKeeperRound(r, config) ? gkTask : (pickedField[f++] as Task));
  }
  return tasks;
}

/**
 * Görevler dışarıdan verilir (createMatchTasks ile üretilmiş, tur sıralı liste) —
 * görev önizlemesi için seçim maçtan ÖNCE (session kurulumunda) yapılır.
 */
export function createMatch(tasks: Task[]): MatchState {
  return {
    round: 1,
    tasks,
    scores: [0, 0],
    usedCardIds: [[], []],
    pending: [null, null],
    history: [],
    finished: false,
  };
}

export function currentTask(state: MatchState): Task {
  const task = state.tasks[state.round - 1];
  if (!task) throw new Error(`Görev bulunamadı: tur ${state.round}`);
  return task;
}

/**
 * Saha turunda kör kart seçimi. Doğrulamalar:
 * - Maç bitmemiş, kaleci turu değil, kart saha kartı, daha önce oynanmamış,
 *   bu turda zaten seçim yapılmamış.
 */
export function playCard(state: MatchState, playerIdx: 0 | 1, card: Card, config: GameConfig): MatchState {
  if (state.finished) throw new Error('Maç bitti');
  if (isKeeperRound(state.round, config)) throw new Error('Kilit Round: kart seçimi yok, kaleciler otomatik oynar');
  if (card.position !== 'field') throw new Error('Kaleci kartı saha turunda oynanamaz');
  if (state.usedCardIds[playerIdx].includes(card.id)) throw new Error(`Kart zaten kullanıldı: ${card.id}`);
  if (state.pending[playerIdx]) throw new Error(`Oyuncu ${playerIdx} bu turda zaten kart kilitledi`);

  const next = cloneState(state);
  next.pending[playerIdx] = card;
  return next;
}

/** Kilit Round: iki kaleci otomatik sahaya sürülür. */
export function playKeeperRound(state: MatchState, keepers: [Card, Card], config: GameConfig): MatchState {
  if (state.finished) throw new Error('Maç bitti');
  if (!isKeeperRound(state.round, config)) throw new Error('Bu tur kaleci turu değil');
  if (keepers.some((k) => k.position !== 'gk')) throw new Error('Saha kartı kaleci turunda oynanamaz');

  const next = cloneState(state);
  next.pending = [keepers[0], keepers[1]];
  return next;
}

/**
 * İki seçim de kilitlenince turu çözer: skorlar hesaplanır, puanlar işlenir,
 * kartlar "kullanıldı" olarak işaretlenir, tur ilerler.
 */
export function resolveRound(state: MatchState, config: GameConfig): MatchState {
  if (state.finished) throw new Error('Maç bitti');
  const [cardA, cardB] = state.pending;
  if (!cardA || !cardB) throw new Error('İki oyuncu da kart kilitlemeden tur çözülemez');

  const task = currentTask(state);
  const scoreA = taskScore(cardA, task);
  const scoreB = taskScore(cardB, task);
  const winner = compareScores(scoreA, scoreB);
  const points = roundPoints(winner, config);

  const next = cloneState(state);
  next.scores = [state.scores[0] + points[0], state.scores[1] + points[1]];
  next.usedCardIds[0].push(cardA.id);
  next.usedCardIds[1].push(cardB.id);
  next.history.push({ round: state.round, taskId: task.id, cards: [cardA, cardB], scores: [scoreA, scoreB], winner, points });
  next.pending = [null, null];
  if (state.round >= config.match.rounds) next.finished = true;
  else next.round += 1;
  return next;
}

/** Maç sonucu: 0 | 1 kazanan, 'penalty' = puanlar eşit → penaltı turu. */
export function matchWinner(state: MatchState): 0 | 1 | 'penalty' {
  if (!state.finished) throw new Error('Maç henüz bitmedi');
  if (state.scores[0] > state.scores[1]) return 0;
  if (state.scores[1] > state.scores[0]) return 1;
  return 'penalty';
}

function cloneState(state: MatchState): MatchState {
  return {
    ...state,
    scores: [...state.scores],
    usedCardIds: [[...state.usedCardIds[0]], [...state.usedCardIds[1]]],
    pending: [...state.pending] as [Card | null, Card | null],
    history: [...state.history],
  };
}
