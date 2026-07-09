import { randomUUID } from 'node:crypto';
import type { MatchMode } from '@fkd/shared';
import type { TypedSocket } from './types.js';

/**
 * Oda (arkadaşla oyna) ve kuyruk (rastgele eşleş) eşleştirmesi. Maçın kendisini
 * kurma işini (`MatchSession` + store girdisi + ilk event'ler) `beginMatch`
 * callback'ine devreder — böylece bu modül `socket/handlers.ts`'e bağımlı olmaz.
 */
export type BeginMatch = (mode: MatchMode, sockets: [TypedSocket, TypedSocket | null]) => void;

export function createLobby(beginMatch: BeginMatch) {
  const rooms = new Map<string, TypedSocket>();
  const queue: TypedSocket[] = [];

  function createRoom(host: TypedSocket): void {
    // Aynı socket'in eski odası/kuyruk girdisi varsa düş: bir host'un tek odası
    // olabilir (üst üste room:create ile oda biriktirilemez).
    forget(host);
    const roomId = randomUUID().slice(0, 8);
    rooms.set(roomId, host);
    host.emit('room:created', { roomId });
  }

  function joinRoom(roomId: string, guest: TypedSocket): void {
    const host = rooms.get(roomId);
    if (!host || host.id === guest.id) {
      guest.emit('error', { message: 'Oda bulunamadı' });
      return;
    }
    forget(guest);
    rooms.delete(roomId);
    beginMatch('friend', [host, guest]);
  }

  function joinQueue(socket: TypedSocket): void {
    // Eski oda/kuyruk girdisini düş: aynı socket kuyrukta birden fazla kez duramaz
    // (docs/saglik-kontrolu-raporu.md O2) ve oda host'uyken kuyruğa da giremez.
    forget(socket);
    const waiting = queue.shift();
    if (!waiting) {
      queue.push(socket);
      socket.emit('queue:waiting');
      return;
    }
    beginMatch('matchmaking', [waiting, socket]);
  }

  /** Socket disconnect olursa bekleyen oda/kuyruk girdilerini de temizle. */
  function forget(socket: TypedSocket): void {
    for (const [roomId, host] of rooms) {
      if (host.id === socket.id) rooms.delete(roomId);
    }
    const idx = queue.findIndex((s) => s.id === socket.id);
    if (idx >= 0) queue.splice(idx, 1);
  }

  return { createRoom, joinRoom, joinQueue, forget };
}
