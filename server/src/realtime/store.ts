import { MatchSession } from '../game/session.js';
import type { TypedSocket } from './types.js';

/**
 * In-memory eşleşme deposu. Bot maçında tek gerçek socket vardır, arkadaş ve
 * eşleşme maçlarında iki; hangi socket'in hangi maçta hangi oyuncu (0|1)
 * olduğunu ve socket kopunca reconnect penceresini burada tutuyoruz. Maç bitince (ya da forfeit'le) girdi silinir.
 */
export interface PlayerLink {
  matchId: string;
  playerIdx: 0 | 1;
}

export interface MatchEntry {
  session: MatchSession;
  /** null = o taraf şu an bağlı değil (disconnect penceresinde) ya da bot. */
  sockets: [TypedSocket | null, TypedSocket | null];
  disconnectTimers: [NodeJS.Timeout | null, NodeJS.Timeout | null];
  rematchRequested: [boolean, boolean];
  /** Son socket değişimi zamanı (GC süpürmesi için). */
  updatedAt: number;
}

const entries = new Map<string, MatchEntry>();
const links = new Map<string, PlayerLink>();

export function createEntry(session: MatchSession, sockets: [TypedSocket | null, TypedSocket | null]): MatchEntry {
  const entry: MatchEntry = {
    session,
    sockets,
    disconnectTimers: [null, null],
    rematchRequested: [false, false],
    updatedAt: Date.now(),
  };
  entries.set(session.id, entry);
  for (const idx of [0, 1] as const) {
    const socket = sockets[idx];
    if (socket) links.set(socket.id, { matchId: session.id, playerIdx: idx });
  }
  return entry;
}

export function getEntry(matchId: string): MatchEntry | undefined {
  return entries.get(matchId);
}

export function getLink(socketId: string): PlayerLink | undefined {
  return links.get(socketId);
}

export function getSocket(matchId: string, playerIdx: 0 | 1): TypedSocket | null {
  return entries.get(matchId)?.sockets[playerIdx] ?? null;
}

/** Reconnect: socket'i o oyuncu koltuğuna yeniden bağlar. */
export function rebindSocket(matchId: string, playerIdx: 0 | 1, socket: TypedSocket): void {
  const entry = entries.get(matchId);
  if (!entry) throw new Error(`Maç bulunamadı: ${matchId}`);
  // Koltukta hâlâ eski bir socket oturuyorsa (aynı token'la ikinci sekme) linkini
  // düşür — yoksa eski sekme koltuğu kaybettiği hâlde hamle göndermeye devam edebilirdi.
  const old = entry.sockets[playerIdx];
  if (old && old.id !== socket.id) links.delete(old.id);
  entry.sockets[playerIdx] = socket;
  links.set(socket.id, { matchId, playerIdx });
  const timer = entry.disconnectTimers[playerIdx];
  if (timer) clearTimeout(timer);
  entry.disconnectTimers[playerIdx] = null;
  entry.updatedAt = Date.now();
}

export function setDisconnectTimer(matchId: string, playerIdx: 0 | 1, timer: NodeJS.Timeout): void {
  const entry = entries.get(matchId);
  if (!entry) return;
  entry.disconnectTimers[playerIdx] = timer;
}

export function unregisterSocket(socketId: string): PlayerLink | undefined {
  const link = links.get(socketId);
  links.delete(socketId);
  if (!link) return undefined;
  const entry = entries.get(link.matchId);
  if (entry && entry.sockets[link.playerIdx]?.id === socketId) {
    entry.sockets[link.playerIdx] = null;
    entry.updatedAt = Date.now();
  }
  return link;
}

export function deleteEntry(matchId: string): void {
  const entry = entries.get(matchId);
  if (entry) {
    for (const timer of entry.disconnectTimers) if (timer) clearTimeout(timer);
    for (const socket of entry.sockets) if (socket) links.delete(socket.id);
  }
  entries.delete(matchId);
}

/**
 * Zombi maç temizliği (GC): iki tarafı da bağlı olmayan ve `maxIdleMs`'ten uzun
 * süredir öyle olan girdileri siler. Reconnect penceresinden (60 sn) daha büyük
 * bir `maxIdleMs` verilmeli. Silinen girdi sayısını döndürür.
 */
export function sweep(maxIdleMs: number): number {
  const now = Date.now();
  const stale: string[] = [];
  for (const [id, entry] of entries) {
    if (!entry.sockets[0] && !entry.sockets[1] && now - entry.updatedAt > maxIdleMs) stale.push(id);
  }
  for (const id of stale) deleteEntry(id);
  return stale.length;
}
