import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Server } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { registerHandlers } from '../src/socket/handlers.js';

/**
 * Go-live güvenlik katmanı: aktif (bitmemiş) bir multiplayer maçtaki socket
 * yeni bir maç başlatamamalı. Aksi hâlde eski girdinin socket referansı dolu
 * kaldığı için GC onu asla süpüremez (kalıcı bellek sızıntısı) ve rakip
 * forfeit tetiklenmeden sonsuza dek bekler.
 */
function waitFor<T = unknown>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, (payload: T) => resolve(payload)));
}

describe('socket handlers — aktif maç koruması', () => {
  let httpServer: ReturnType<typeof createServer>;
  let port: number;

  beforeAll(async () => {
    httpServer = createServer();
    const io = new Server(httpServer);
    registerHandlers(io as never);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    port = (httpServer.address() as AddressInfo).port;
  });

  afterAll(() => {
    httpServer.close();
  });

  function connect(): ClientSocket {
    return ioClient(`http://localhost:${port}`, { transports: ['websocket'] });
  }

  it('friend maçı sürerken bot:start reddedilir, maç bozulmaz', async () => {
    const host = connect();
    const guest = connect();
    await Promise.all([waitFor(host, 'connect'), waitFor(guest, 'connect')]);

    const roomCreated = waitFor<{ roomId: string }>(host, 'room:created');
    host.emit('room:create');
    const { roomId } = await roomCreated;

    const hostStart = waitFor<{ matchId: string }>(host, 'match:start');
    const guestStart = waitFor<{ matchId: string }>(guest, 'match:start');
    guest.emit('room:join', { roomId });
    const [{ matchId }] = await Promise.all([hostStart, guestStart]);
    expect(matchId).toBeTruthy();

    // Maç draft aşamasında sürerken host yeni bir bot maçı açmaya çalışıyor.
    const err = waitFor<{ message: string }>(host, 'error');
    host.emit('bot:start');
    expect((await err).message).toMatch(/aktif bir maçta/);

    // Mevcut maç hâlâ ayakta: host draft seçeneklerini almaya devam edebilmeli
    // (yeni bir match:start ALMAMALI — onu bekleyip timeout etmek yerine
    // draft:pick'in hâlâ bu maça işlediğini kontrol ediyoruz).
    const draftErr = waitFor<{ message: string }>(host, 'error');
    host.emit('draft:pick', { cardId: 'olmayan-kart' });
    // Hata "Aktif maç bulunamadı" DEĞİL, draft motorundan gelen kart hatası olmalı.
    expect((await draftErr).message).not.toMatch(/Aktif maç bulunamadı/);

    host.close();
    guest.close();
  }, 15000);
});
