import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { getDb } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { getConfigurationStatus } from '../services/configValidationService.js';
import { logger } from '../utils/logger.js';

export const settingsRoutes = Router();

settingsRoutes.use(requireAuth);

settingsRoutes.get('/status', (req, res) => {
  res.json(getConfigurationStatus());
});

settingsRoutes.put(
  '/:settingName',
  requireRole('SuperAdmin'),
  body('value').optional({ nullable: true }).isString(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Value must be a string' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT * FROM EventSettings WHERE SettingName = ?').get(req.params.settingName);
    if (!existing) {
      return res.status(404).json({ error: `Unknown setting: ${req.params.settingName}` });
    }

    db.prepare(
      `UPDATE EventSettings SET Value = ?, UpdatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), UpdatedBy = ? WHERE SettingName = ?`
    ).run(req.body.value ?? null, req.user.username, req.params.settingName);

    if (!existing.IsSensitive) {
      logger.info(`Setting ${req.params.settingName} updated by ${req.user.username}`);
    } else {
      logger.info(`Setting ${req.params.settingName} (sensitive) updated by ${req.user.username}`);
    }
    db.prepare('INSERT INTO AuditLog (UserId, EventType, Message) VALUES (?, ?, ?)').run(
      req.user.sub,
      'settings.updated',
      `${req.user.username} updated ${req.params.settingName}`
    );

    res.json({ status: 'ok' });
  }
);
