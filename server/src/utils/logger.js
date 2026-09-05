import path from 'node:path';
import winston from 'winston';
import { env } from '../config/env.js';

const SENSITIVE_KEY_PATTERN = /password|secret|token|authorization/i;

const redact = winston.format((info) => {
  for (const key of Object.keys(info)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      info[key] = '[REDACTED]';
    }
  }
  return info;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(redact(), winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.File({ filename: path.join(env.logsDir, 'app.log') }),
    new winston.transports.File({ filename: path.join(env.logsDir, 'error.log'), level: 'error' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple())
    })
  );
}
