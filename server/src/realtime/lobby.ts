import { randomUUID } from 'node:crypto';
import type { MatchMode } from '@fkd/shared';
import type { TypedSocket } from './types.js';

/**
 * Oda (arkadaşla oyna) ve kuyruk (rastgele eşleş) eşleştirmesi. Maçın kendisini
 * kurma işini (`MatchSession` + store girdisi + ilk event'ler) `beginMatch`
 * callback'ine devreder — böylece bu modül `socket/handlers.ts`'e bağımlı olmaz.
 *
 * Havuz kuralı (kullanıcı kararı): odada HOST'un seçtiği havuz geçerlidir;
 * kuyrukta İLK giren oyuncunun havuzu geçerlidir.
 */
export type BeginMatch = (mode: MatchMode, sockets: [TypedSocket, TypedSocket | null], poolId: string) => void;

interface RoomEntry {
  host: TypedSocket;
  poolId: string;
}

interface QueueEntry {
  socket: TypedSocket;
  poolId: string;
}

export function createLobby(beginMatch: BeginMatch) {
  const rooms = new Map<string, RoomEntry>();
  const queue: QueueEntry[] = [];

  function createRoom(host: TypedSocket, poolId: string): void {
    // Aynı socket'in eski odası/kuyruk girdisi varsa düş: bir host'un tek odası
    // olabilir (üst üste room:create ile oda biriktirilemez).
    forget(host);
    const roomId = randomUUID().slice(0, 8);
    rooms.set(roomId, { host, poolId });
    host.emit('room:created', { roomId });
  }

  function joinRoom(roomId: string, guest: TypedSocket): void {
    const room = rooms.get(roomId);
    if (!room || room.host.id === guest.id) {
      guest.emit('error', { message: 'Oda bulunamadı' });
      return;
    }
    forget(guest);
    rooms.delete(roomId);
    beginMatch('friend', [room.host, guest], room.poolId);
  }

  function joinQueue(socket: TypedSocket, poolId: string): void {
    // Eski oda/kuyruk girdisini düş: aynı socket kuyrukta birden fazla kez duramaz
    // (docs/saglik-kontrolu-raporu.md O2) ve oda host'uyken kuyruğa da giremez.
    forget(socket);
    const waiting = queue.shift();
    if (!waiting) {
      queue.push({ socket, poolId });
      socket.emit('queue:waiting');
      return;
    }
    beginMatch('matchmaking', [waiting.socket, socket], waiting.poolId);
  }

  /** Socket disconnect olursa bekleyen oda/kuyruk girdilerini de temizle. */
  function forget(socket: TypedSocket): void {
    for (const [roomId, room] of rooms) {
      if (room.host.id === socket.id) rooms.delete(roomId);
    }
    const idx = queue.findIndex((q) => q.socket.id === socket.id);
    if (idx >= 0) queue.splice(idx, 1);
  }

  return { createRoom, joinRoom, joinQueue, forget };
}
