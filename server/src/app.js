import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { authRoutes } from './routes/authRoutes.js';
import { settingsRoutes } from './routes/settingsRoutes.js';
import { ledDeviceRoutes } from './routes/ledDeviceRoutes.js';
import { userRoutes } from './routes/userRoutes.js';
import { ledRequirementsRoutes } from './routes/ledRequirementsRoutes.js';
import { sharePointRoutes } from './routes/sharePointRoutes.js';
import { runRoutes } from './routes/runRoutes.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(express.json());
  app.use(
    '/api',
    rateLimit({
      windowMs: 60 * 1000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false
    })
  );

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use(
    '/api/auth/login',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many login attempts, please try again later' }
    })
  );
  app.use('/api/auth', authRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/led-devices', ledDeviceRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/led-requirements', ledRequirementsRoutes);
  app.use('/api/sharepoint', sharePointRoutes);
  app.use('/api/runs', runRoutes);

  app.use('/api', notFoundHandler);

  // In the installed app, client/ is a sibling of server/ (see installer/),
  // with the Vite build output at client/dist. In dev, the client is
  // served separately by the Vite dev server instead - checking dist/
  // specifically (not client/index.html, which is the unbuilt source
  // template and always exists in this repo) means this only activates
  // once a real production build exists.
  const clientDist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'client', 'dist');
  if (fs.existsSync(path.join(clientDist, 'index.html'))) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/api).*/, (req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(errorHandler);

  return app;
}
