const crypto = require('crypto');
const { db, saveDb } = require('../lib/database');
const { sendJson, readBody } = require('../lib/http-helpers');
const { log } = require('../lib/logger');
const {
  passwordHash,
  passwordMatches,
  createSession,
  userFromToken,
  normalizeEmail,
  normalizeAnswer
} = require('../lib/security');

async function register(req, res) {
  const body = await readBody(req);
  const name = String(body.name || '').trim();
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');

  if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
    return sendJson(res, 400, {
      error: 'invalid_request',
      message: 'Informe nome, e-mail valido e senha com ao menos 8 caracteres.'
    });
  }
  if (db.users.some(u => u.email === email)) {
    return sendJson(res, 409, { error: 'email_already_exists', message: 'Este e-mail ja esta cadastrado.' });
  }

  const user = {
    id: db.seq++,
    name,
    email,
    phone: String(body.phone || '').trim(),
    cpf: String(body.cpf || '').trim(),
    password_hash: passwordHash(password),
    security_question: String(body.securityQuestion || '').trim(),
    security_answer_hash: body.securityAnswer ? passwordHash(normalizeAnswer(body.securityAnswer)) : '',
    role: 'admin',
    created_at: new Date().toISOString()
  };
  db.users.push(user);
  saveDb();

  const session = createSession(user.id, user.role);
  log('register_success', `id=${user.id} email=${email}`);
  return sendJson(res, 201, { id: user.id, name: user.name, email: user.email, role: user.role, token: session.token });
}

async function login(req, res) {
  const body = await readBody(req);
  const email = normalizeEmail(body.email);
  const user = db.users.find(u => u.email === email);

  if (!user || !passwordMatches(String(body.password || ''), user.password_hash)) {
    return sendJson(res, 401, { error: 'invalid_credentials', message: 'E-mail ou senha invalidos.' });
  }

  const session = createSession(user.id, user.role);
  log('login_success', `id=${user.id} email=${email}`);
  return sendJson(res, 200, {
    user_id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    token: session.token
  });
}

async function forgotPassword(req, res) {
  const body = await readBody(req);
  const email = normalizeEmail(body.email);
  const user = db.users.find(u => u.email === email);

  if (!user) {
    return sendJson(res, 200, { question: '' });
  }

  return sendJson(res, 200, { question: user.security_question || '' });
}

async function answerSecurityQuestion(req, res) {
  const body = await readBody(req);
  const user = db.users.find(u => u.email === normalizeEmail(body.email));

  if (!user || !user.security_answer_hash) {
    return sendJson(res, 400, { error: 'no_question', message: 'Nenhuma pergunta de seguranca cadastrada para este e-mail.' });
  }
  if (!passwordMatches(normalizeAnswer(body.answer), user.security_answer_hash)) {
    return sendJson(res, 401, { error: 'wrong_answer', message: 'Resposta incorreta.' });
  }

  const token = crypto.randomBytes(24).toString('hex');
  db.resets.push({ user_id: user.id, token, expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), used: false });
  saveDb();
  return sendJson(res, 200, { token });
}

async function resetPassword(req, res) {
  const body = await readBody(req);
  const password = String(body.password || '');

  if (password.length < 8) {
    return sendJson(res, 400, { error: 'weak_password', message: 'A nova senha precisa de ao menos 8 caracteres.' });
  }

  const reset = db.resets.find(r => r.token === String(body.token || '') && !r.used && new Date(r.expires_at) > new Date());
  if (!reset) return sendJson(res, 400, { error: 'invalid_token', message: 'Link de redefinicao invalido ou expirado.' });

  const user = db.users.find(u => u.id === reset.user_id);
  if (!user) return sendJson(res, 400, { error: 'invalid_token', message: 'Usuario nao encontrado.' });

  user.password_hash = passwordHash(password);
  reset.used = true;
  db.sessions = db.sessions.filter(session => session.user_id !== user.id);
  saveDb();

  log('password_reset', user.email);
  return sendJson(res, 200, { ok: true, email: user.email });
}

async function logout(req, res) {
  const header = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (header) {
    const tokenHash = crypto.createHash('sha256').update(header).digest('hex');
    db.sessions = db.sessions.filter(s => s.token_hash !== tokenHash);
    saveDb();
  }
  return sendJson(res, 200, { ok: true });
}

async function me(req, res) {
  const user = userFromToken(req);
  if (!user) return sendJson(res, 401, { error: 'unauthorized', message: 'Sessao expirada.' });
  return sendJson(res, 200, { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role });
}

async function handleAuthRoutes(req, res, pathname) {
  if (pathname === '/api/auth/register' && req.method === 'POST') {
    await register(req, res);
    return true;
  }
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    await login(req, res);
    return true;
  }
  if (pathname === '/api/auth/forgot-password' && req.method === 'POST') {
    await forgotPassword(req, res);
    return true;
  }
  if (pathname === '/api/auth/answer-question' && req.method === 'POST') {
    await answerSecurityQuestion(req, res);
    return true;
  }
  if (pathname === '/api/auth/reset-password' && req.method === 'POST') {
    await resetPassword(req, res);
    return true;
  }
  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    await logout(req, res);
    return true;
  }
  if (pathname === '/api/me' && req.method === 'GET') {
    await me(req, res);
    return true;
  }
  return false;
}

module.exports = { handleAuthRoutes };
