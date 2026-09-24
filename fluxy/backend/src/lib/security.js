const crypto = require('crypto');
const { db, saveDb } = require('./database');

function passwordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function passwordMatches(password, stored) {
  const [salt, expectedHex] = String(stored || '').split(':');
  if (!salt || !expectedHex) return false;
  const actual = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
}

function createSession(userId, role) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  db.sessions.push({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  });
  db.sessions = db.sessions.slice(-500);
  saveDb();
  return { token, userId, role };
}

function userFromToken(req) {
  const header = String(req.headers.authorization || '');
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const session = db.sessions.find(s => s.token_hash === tokenHash && new Date(s.expires_at) > new Date());
  if (!session) return null;

  return db.users.find(u => u.id === session.user_id) || null;
}

const normalizeEmail = value => String(value || '').trim().toLowerCase();
const normalizeAnswer = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

module.exports = {
  passwordHash,
  passwordMatches,
  createSession,
  userFromToken,
  normalizeEmail,
  normalizeAnswer
};
