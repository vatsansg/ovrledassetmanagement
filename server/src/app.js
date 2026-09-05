import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

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

  // Further routers (auth, settings, led-devices, requirements, runs, ...) are mounted
  // under /api in their respective implementation stages (Stage 2 onward).

  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}
