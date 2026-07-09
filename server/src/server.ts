import { createServer } from 'node:http';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@fkd/shared';
import { registerHandlers } from './socket/handlers.js';

const port = Number(process.env.PORT ?? 3001);
const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';

// /health: Render'ın (ve benzeri platformların) "süreç ayakta mı?" yoklaması.
// Socket.io kendi path'ini (/socket.io) bu handler'dan önce yakalar.
const httpServer = createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok');
    return;
  }
  res.writeHead(404);
  res.end();
});
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: clientOrigin },
  // En büyük meşru payload birkaç yüz bayt (cardId/roomId/token) — varsayılan
  // 1 MB yerine 10 KB, dev payload'la RAM şişirme yüzeyini kapatır.
  maxHttpBufferSize: 10_000,
});

registerHandlers(io);

httpServer.listen(port, () => {
  console.log(`FKD server dinliyor: http://localhost:${port} (client origin: ${clientOrigin})`);
});
