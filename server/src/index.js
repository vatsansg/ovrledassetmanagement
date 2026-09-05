import http from 'node:http';
import { WebSocketServer } from 'ws';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { getDb } from './db/index.js';
import { createApp } from './app.js';

getDb(); // runs migrations + seed on startup
const app = createApp();
const server = http.createServer(app);

// Live run-progress updates are pushed over this socket starting in the stage
// that implements RunService (Stage 5 onward).
export const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (socket) => {
  socket.send(JSON.stringify({ type: 'connected' }));
});

server.listen(env.port, () => {
  logger.info(`LED Asset Manager server listening on port ${env.port}`);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
});
