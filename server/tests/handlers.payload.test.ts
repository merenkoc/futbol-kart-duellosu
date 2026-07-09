import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Server } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { registerHandlers } from '../src/socket/handlers.js';

/**
 * docs/saglik-fix-plani.md K2: bozuk/eksik socket payload'ları (destructure
 * hatasıyla) tüm Node sürecini düşürüyordu. Burada gerçek bir socket.io sunucusu
 * ayağa kaldırılıp kasıtlı bozuk payload'lar gönderiliyor; sunucunun ayakta
 * kaldığını (yeni bir client'ın hâlâ normal maç başlatabildiğini) doğruluyoruz.
 */
function waitFor<T = unknown>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, (payload: T) => resolve(payload)));
}

describe('socket handlers — bozuk payload dayanıklılığı (K2)', () => {
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

  it('eksik/bozuk payload sunucuyu düşürmez, sonraki client normal maç başlatabilir', async () => {
    const bad = connect();
    await waitFor(bad, 'connect');

    // 1) room:join payload'sız
    const err1 = waitFor<{ message: string }>(bad, 'error');
    (bad as unknown as { emit: (event: string) => void }).emit('room:join');
    expect((await err1).message).toBeTruthy();

    // 2) match:reconnect payload'sız
    const err2 = waitFor<{ message: string }>(bad, 'error');
    (bad as unknown as { emit: (event: string) => void }).emit('match:reconnect');
    expect((await err2).message).toBeTruthy();

    // 3) draft:pick eksik alan ({})
    const err3 = waitFor<{ message: string }>(bad, 'error');
    bad.emit('draft:pick', {} as never);
    expect((await err3).message).toBeTruthy();

    // 4) round:playCard yanlış tipte alan (number)
    const err4 = waitFor<{ message: string }>(bad, 'error');
    bad.emit('round:playCard', { cardId: 42 } as never);
    expect((await err4).message).toBeTruthy();

    // 5) penalty:pickShooter tamamen yanlış şekilli payload (string)
    const err5 = waitFor<{ message: string }>(bad, 'error');
    bad.emit('penalty:pickShooter', 'x' as never);
    expect((await err5).message).toBeTruthy();

    bad.close();

    // Sunucu hâlâ ayakta mı? Yeni bir client normal şekilde bot maçı başlatabilmeli.
    const good = connect();
    await waitFor(good, 'connect');
    const matchStart = waitFor<{ matchId: string; playerIdx: 0 | 1 }>(good, 'match:start');
    good.emit('bot:start');
    const payload = await matchStart;
    expect(payload.matchId).toBeTruthy();
    expect(payload.playerIdx).toBe(0);

    good.close();
  }, 15000);
});
