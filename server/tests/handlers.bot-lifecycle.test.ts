import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Server } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { registerHandlers } from '../src/socket/handlers.js';
import * as store from '../src/realtime/store.js';

/**
 * Bot maçı yaşam döngüsü:
 *  - Sorun 1: maç bitince "Tekrar Oyna" hemen yeni bir bot maçı başlatmalı, takılmamalı.
 *    Kök neden: emitMatchEnd bot girdisini siliyordu; match:rematch handler girdiyi
 *    bulamayıp "Aktif maç yok" dönüyordu, client "Rakip bekleniyor…"de kalıyordu.
 *  - Sorun 2 (docs O1): bot maçında disconnect sonrası girdi reconnect penceresi
 *    boyunca canlı kalmalı ki sayfa yenilemede match:reconnect kaldığı yerden resync etsin.
 */
function waitFor<T = unknown>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, (payload: T) => resolve(payload)));
}

describe('bot maçı yaşam döngüsü (rematch + reconnect)', () => {
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

  it('match:rematch takılmadan hemen yeni bir bot maçı başlatır (Sorun 1)', async () => {
    const client = connect();
    await waitFor(client, 'connect');

    const first = waitFor<{ matchId: string }>(client, 'match:start');
    client.emit('bot:start');
    const { matchId: firstId } = await first;
    expect(firstId).toBeTruthy();

    // Maç bitmemiş olsa da rematch handler'ının "bot -> sil + yeni maç" yolu aynıdır;
    // fix'ten önce girdi silinmiş olsaydı bu yol hiç çalışmazdı.
    const second = waitFor<{ matchId: string }>(client, 'match:start');
    client.emit('match:rematch');
    const { matchId: secondId } = await second;

    expect(secondId).toBeTruthy();
    expect(secondId).not.toBe(firstId);

    client.close();
  }, 15000);

  it('disconnect sonrası bot maçı canlı kalır, reconnect resync eder (Sorun 2)', async () => {
    const client = connect();
    await waitFor(client, 'connect');

    const start = waitFor<{ matchId: string; playerToken: string; playerIdx: 0 | 1 }>(client, 'match:start');
    const firstDraft = waitFor(client, 'draft:options');
    client.emit('bot:start');
    const { matchId, playerToken } = await start;
    await firstDraft; // draft fazındayız

    // Kullanıcı sekmeyi yeniler: socket kopar.
    client.close();
    await new Promise((r) => setTimeout(r, 300));

    // Bot maçı hemen silinmemeli (reconnect penceresi).
    expect(store.getEntry(matchId)).toBeDefined();

    // Yeni sekme reconnect eder: "Maç bulunamadı" hatası değil, resync (draft:options) almalı.
    const revived = connect();
    await waitFor(revived, 'connect');
    let gotError = false;
    revived.on('error', () => {
      gotError = true;
    });
    const resync = waitFor<{ round: number }>(revived, 'draft:options');
    revived.emit('match:reconnect', { matchId, playerToken });
    const payload = await resync;

    expect(payload).toBeDefined();
    expect(gotError).toBe(false);
    expect(store.getEntry(matchId)).toBeDefined();

    revived.close();
  }, 15000);

  it('yeni bot maçı başlarken önceki bot maçı temizlenir (bellek sızıntısı yok)', async () => {
    const client = connect();
    await waitFor(client, 'connect');

    const first = waitFor<{ matchId: string }>(client, 'match:start');
    client.emit('bot:start');
    const { matchId: id1 } = await first;

    const second = waitFor<{ matchId: string }>(client, 'match:start');
    client.emit('bot:start');
    const { matchId: id2 } = await second;

    expect(id2).not.toBe(id1);
    expect(store.getEntry(id1)).toBeUndefined();
    expect(store.getEntry(id2)).toBeDefined();

    client.close();
  }, 15000);
});
