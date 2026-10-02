const crypto = require('crypto');

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

function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const normalizeEmail = value => String(value || '').trim().toLowerCase();
const normalizeAnswer = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

module.exports = {
  passwordHash,
  passwordMatches,
  newToken,
  hashToken,
  normalizeEmail,
  normalizeAnswer
};
