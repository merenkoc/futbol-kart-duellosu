import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Server } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import type { Card } from '@fkd/shared';
import { registerHandlers } from '../src/socket/handlers.js';
import { DEFAULT_POOL_ID } from '../src/data/loadData.js';

/** Havuz seçimi protokolü: seçilen havuz maça gerçekten uygulanıyor mu? */
function waitFor<T = unknown>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, (payload: T) => resolve(payload)));
}

describe('socket handlers — havuz (pool) seçimi', () => {
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

  it('bot:start {poolId:"premier"} → match:start poolId döner, draft kartları o havuzdan gelir', async () => {
    const c = connect();
    await waitFor(c, 'connect');
    const start = waitFor<{ poolId: string }>(c, 'match:start');
    const options = waitFor<{ options: Card[] }>(c, 'draft:options');
    c.emit('bot:start', { poolId: 'premier' });
    expect((await start).poolId).toBe('premier');
    const { options: opts } = await options;
    expect(opts.length).toBeGreaterThan(0);
    for (const card of opts) {
      expect(card.pool).toBe('premier');
      expect(card.id.startsWith('premier_')).toBe(true);
    }
    c.close();
  }, 15000);

  it('geçersiz/eksik poolId varsayılan havuza düşer', async () => {
    const c = connect();
    await waitFor(c, 'connect');
    const start = waitFor<{ poolId: string }>(c, 'match:start');
    c.emit('bot:start', { poolId: 'boyle-bir-havuz-yok' });
    expect((await start).poolId).toBe(DEFAULT_POOL_ID);
    c.close();
  }, 15000);
});
