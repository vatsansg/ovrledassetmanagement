import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { getDb } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { testAndRecordDeviceConnection } from '../services/ledConnectionService.js';

export const ledDeviceRoutes = Router();

ledDeviceRoutes.use(requireAuth);

ledDeviceRoutes.get('/', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM LEDDevices ORDER BY DeviceKey').all());
});

ledDeviceRoutes.put(
  '/:deviceKey',
  requireRole('SuperAdmin'),
  body('displayLabel').optional().isString().trim().isLength({ min: 1, max: 40 }),
  body('targetPath').optional({ nullable: true }).isString(),
  body('enabled').optional().isBoolean(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid device fields' });
    }

    const db = getDb();
    const device = db.prepare('SELECT * FROM LEDDevices WHERE DeviceKey = ?').get(req.params.deviceKey);
    if (!device) return res.status(404).json({ error: `Unknown device: ${req.params.deviceKey}` });

    const enabled = req.body.enabled ?? !!device.Enabled;
    if (enabled && !(req.body.targetPath ?? device.TargetPath)) {
      return res.status(400).json({ error: 'A target path is required to enable a device' });
    }

    db.prepare(
      `UPDATE LEDDevices SET
         DisplayLabel = ?,
         TargetPath = ?,
         Enabled = ?,
         LastConnectionStatus = CASE WHEN ? THEN 'UNTESTED' ELSE LastConnectionStatus END,
         UpdatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE DeviceKey = ?`
    ).run(
      req.body.displayLabel ?? device.DisplayLabel,
      req.body.targetPath ?? device.TargetPath,
      enabled ? 1 : 0,
      (req.body.targetPath ?? device.TargetPath) !== device.TargetPath ? 1 : 0,
      req.params.deviceKey
    );

    db.prepare('INSERT INTO AuditLog (UserId, EventType, Message) VALUES (?, ?, ?)').run(
      req.user.sub,
      'led_device.updated',
      `${req.user.username} updated ${req.params.deviceKey}`
    );

    res.json(db.prepare('SELECT * FROM LEDDevices WHERE DeviceKey = ?').get(req.params.deviceKey));
  }
);

ledDeviceRoutes.post('/:deviceKey/test-connection', (req, res, next) => {
  try {
    const outcome = testAndRecordDeviceConnection(req.params.deviceKey);
    res.json(outcome);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});
