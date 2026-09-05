import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { getDb } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';

export const userRoutes = Router();

userRoutes.use(requireAuth, requireRole('SuperAdmin'));

function toPublicUser(u) {
  return {
    id: u.Id,
    username: u.Username,
    role: u.Role,
    isActive: !!u.IsActive,
    mustChangePassword: !!u.MustChangePassword,
    createdAt: u.CreatedAt,
    lastLoginAt: u.LastLoginAt
  };
}

userRoutes.get('/', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM Users ORDER BY Username').all().map(toPublicUser));
});

userRoutes.post(
  '/',
  body('username').isString().trim().isLength({ min: 3, max: 40 }),
  body('role').isIn(['SuperAdmin', 'Admin']),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Username (3-40 chars) and a valid role are required' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT 1 FROM Users WHERE Username = ? COLLATE NOCASE').get(req.body.username);
    if (existing) return res.status(409).json({ error: 'Username already exists' });

    const tempPassword = crypto.randomBytes(9).toString('base64url');
    const passwordHash = bcrypt.hashSync(tempPassword, 10);
    const info = db
      .prepare(
        `INSERT INTO Users (Username, PasswordHash, Role, IsActive, MustChangePassword) VALUES (?, ?, ?, 1, 1)`
      )
      .run(req.body.username, passwordHash, req.body.role);

    db.prepare('INSERT INTO AuditLog (UserId, EventType, Message) VALUES (?, ?, ?)').run(
      req.user.sub,
      'user.created',
      `${req.user.username} created user ${req.body.username} (${req.body.role})`
    );

    const created = db.prepare('SELECT * FROM Users WHERE Id = ?').get(info.lastInsertRowid);
    res.status(201).json({ ...toPublicUser(created), temporaryPassword: tempPassword });
  }
);

userRoutes.patch(
  '/:id',
  body('role').optional().isIn(['SuperAdmin', 'Admin']),
  body('isActive').optional().isBoolean(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid fields' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM Users WHERE Id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.Id === req.user.sub && req.body.isActive === false) {
      return res.status(400).json({ error: 'You cannot deactivate your own account' });
    }

    db.prepare('UPDATE Users SET Role = ?, IsActive = ? WHERE Id = ?').run(
      req.body.role ?? user.Role,
      req.body.isActive ?? !!user.IsActive ? 1 : 0,
      req.params.id
    );

    db.prepare('INSERT INTO AuditLog (UserId, EventType, Message) VALUES (?, ?, ?)').run(
      req.user.sub,
      'user.updated',
      `${req.user.username} updated user ${user.Username}`
    );

    res.json(toPublicUser(db.prepare('SELECT * FROM Users WHERE Id = ?').get(req.params.id)));
  }
);

userRoutes.post('/:id/reset-password', (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT * FROM Users WHERE Id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const tempPassword = crypto.randomBytes(9).toString('base64url');
  const passwordHash = bcrypt.hashSync(tempPassword, 10);
  db.prepare('UPDATE Users SET PasswordHash = ?, MustChangePassword = 1 WHERE Id = ?').run(passwordHash, req.params.id);

  db.prepare('INSERT INTO AuditLog (UserId, EventType, Message) VALUES (?, ?, ?)').run(
    req.user.sub,
    'user.password_reset',
    `${req.user.username} reset the password for ${user.Username}`
  );

  res.json({ temporaryPassword: tempPassword });
});
