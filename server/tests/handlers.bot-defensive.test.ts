import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Server } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { registerHandlers } from '../src/socket/handlers.js';
import * as store from '../src/realtime/store.js';

/**
 * docs/saglik-fix-plani.md Y1: bot zamanlayıcılarındaki (`scheduleBotDraftPick` vb.)
 * `setTimeout` gövdeleri motor çağrılarını try/catch ile sarmalı — motor beklenmedik
 * şekilde `throw` ederse (K1 canlı bir örneğiydi) süreç düşmemeli, sadece loglanmalı.
 * Burada K1 kapandıktan sonra da bu savunma katmanının gerçekten var olduğunu,
 * `botRoundChoice` kasıtlı throw ettiğinde sunucunun ayakta kaldığını doğruluyoruz.
 */
function waitFor<T = unknown>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, (payload: T) => resolve(payload)));
}

describe('bot zamanlayıcıları — savunma katmanı (Y1)', () => {
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

  it('botRoundChoice throw etse bile sunucu ayakta kalır ve yeni maç başlatılabilir', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const client = connect();
    await waitFor(client, 'connect');

    interface DraftOptionsPayload {
      round: number;
      options: { id: string }[];
    }
    const draftState: { last: DraftOptionsPayload | null } = { last: null };

    const matchStart = waitFor<{ matchId: string }>(client, 'match:start');
    client.on('draft:options', (payload: DraftOptionsPayload) => {
      draftState.last = payload;
    });
    client.emit('bot:start');
    const { matchId } = await matchStart;

    // Motoru kasıtlı bozuyoruz: bot tur seçiminde her zaman throw etsin.
    const entry = store.getEntry(matchId);
    expect(entry).toBeDefined();
    entry!.session.botRoundChoice = () => {
      throw new Error('kasıtlı test hatası (Y1)');
    };

    // Draft'ı bitir: persistent listener her round:options'ta lastOptions'ı günceller;
    // her turda mevcut seçeneği seçip bot'un da seçmesi için yeterince bekliyoruz.
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 300));
      if (draftState.last) client.emit('draft:pick', { cardId: draftState.last.options[0]!.id });
      await new Promise((r) => setTimeout(r, 1700));
    }

    // Maç round1 başlayınca bot zamanlayıcısı tetiklenip patched botRoundChoice'i
    // çağıracak; try/catch olmasaydı bu an sunucuyu düşürürdü.
    await new Promise((r) => setTimeout(r, 2500));

    expect(errorSpy).toHaveBeenCalled();
    client.close();

    // Sunucu hâlâ ayakta mı? Yeni client normal bot maçı başlatabilmeli.
    const good = connect();
    await waitFor(good, 'connect');
    const freshStart = waitFor<{ matchId: string }>(good, 'match:start');
    good.emit('bot:start');
    const payload = await freshStart;
    expect(payload.matchId).toBeTruthy();

    good.close();
    errorSpy.mockRestore();
  }, 20000);
});
