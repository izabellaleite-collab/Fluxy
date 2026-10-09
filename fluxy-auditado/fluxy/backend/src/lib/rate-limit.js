const { HttpError } = require('./http-helpers');

const MAX_TRACKED_KEYS = 50000;

function createRateLimiter({ windowMs, max }) {
  const entries = new Map();

  function currentEntry(key) {
    const entry = entries.get(key);
    if (entry && entry.resetAt > Date.now()) return entry;
    entries.delete(key);
    return null;
  }

  function secondsUntilReset(entry) {
    return Math.max(1, Math.ceil((entry.resetAt - Date.now()) / 1000));
  }

  function blockedFor(key) {
    const entry = currentEntry(key);
    return entry && entry.count >= max ? secondsUntilReset(entry) : 0;
  }

  function hit(key) {
    let entry = currentEntry(key);
    if (!entry) {
      if (entries.size >= MAX_TRACKED_KEYS) purgeExpired();
      if (entries.size >= MAX_TRACKED_KEYS) entries.delete(entries.keys().next().value);
      entry = { count: 0, resetAt: Date.now() + windowMs };
      entries.set(key, entry);
    }
    entry.count += 1;
  }

  function reset(key) {
    entries.delete(key);
  }

  function purgeExpired() {
    const now = Date.now();
    for (const [key, entry] of entries) {
      if (entry.resetAt <= now) entries.delete(key);
    }
  }

  setInterval(purgeExpired, windowMs).unref();

  return { blockedFor, hit, reset };
}

function tooManyRequests(seconds) {
  const minutes = Math.ceil(seconds / 60);
  const wait = minutes > 1 ? `${minutes} minutos` : '1 minuto';
  return new HttpError(429, 'too_many_requests', `Muitas tentativas. Aguarde ${wait} e tente de novo.`, {
    retryAfter: seconds
  });
}

function assertNotBlocked(limiter, key) {
  const seconds = limiter.blockedFor(key);
  if (seconds) throw tooManyRequests(seconds);
}

function consume(limiter, key) {
  assertNotBlocked(limiter, key);
  limiter.hit(key);
}

module.exports = { createRateLimiter, assertNotBlocked, consume };
