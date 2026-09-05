import { logger } from '../utils/logger.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not found' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  logger.error(err.message, { stack: err.stack, path: req.path });
  const status = err.status || 500;
  res.status(status).json({ error: err.publicMessage || 'Internal server error' });
}
