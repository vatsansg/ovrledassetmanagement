import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../db/index.js';
import { getOrCreateJwtSecret } from '../utils/jwtSecret.js';

const JWT_SECRET = getOrCreateJwtSecret();
const TOKEN_TTL = '12h';

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.status = 401;
    this.publicMessage = message;
  }
}

export function verifyCredentials(username, password) {
  const db = getDb();
  const user = db
    .prepare('SELECT * FROM Users WHERE Username = ? COLLATE NOCASE AND IsActive = 1')
    .get(username);
  if (!user) throw new AuthError('Invalid username or password');

  const ok = bcrypt.compareSync(password, user.PasswordHash);
  if (!ok) throw new AuthError('Invalid username or password');

  db.prepare('UPDATE Users SET LastLoginAt = strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\') WHERE Id = ?').run(user.Id);
  db.prepare('INSERT INTO AuditLog (UserId, EventType, Message) VALUES (?, ?, ?)').run(
    user.Id,
    'auth.login',
    `User ${user.Username} signed in`
  );

  return user;
}

export function issueToken(user) {
  return jwt.sign(
    { sub: user.Id, username: user.Username, role: user.Role },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function changePassword(userId, currentPassword, newPassword) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM Users WHERE Id = ?').get(userId);
  if (!user) throw new AuthError('User not found');

  const ok = bcrypt.compareSync(currentPassword, user.PasswordHash);
  if (!ok) throw new AuthError('Current password is incorrect');

  const newHash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE Users SET PasswordHash = ?, MustChangePassword = 0 WHERE Id = ?').run(newHash, userId);
  db.prepare('INSERT INTO AuditLog (UserId, EventType, Message) VALUES (?, ?, ?)').run(
    userId,
    'auth.password_changed',
    `User ${user.Username} changed their password`
  );
}
