const { query } = require('../lib/db');
const { sendJson, readBody } = require('../lib/http-helpers');
const { log } = require('../lib/logger');
const { userFromToken } = require('../lib/auth-middleware');
const {
  passwordHash,
  passwordMatches,
  newToken,
  hashToken,
  normalizeEmail,
  normalizeAnswer
} = require('../lib/security');

const SESSION_DAYS = 30;
const RESET_MINUTES = 15;
const MODULE_KEYS = [
  'dashboard', 'financeiro', 'contas', 'estoque', 'clientes',
  'fornecedores', 'servicos', 'agenda', 'calendario', 'relatorios'
];

async function createSession(usuarioId) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await query(
    'INSERT INTO sessao (usuario_id, token_hash, expira_em) VALUES ($1, $2, $3)',
    [usuarioId, hashToken(token), expiresAt]
  );
  return token;
}

async function registerAccess(usuarioId, req, sucesso) {
  const dispositivo = String(req.headers['user-agent'] || '').slice(0, 150);
  try {
    await query(
      'INSERT INTO historico_acesso (usuario_id, dispositivo, sucesso) VALUES ($1, $2, $3)',
      [usuarioId, dispositivo, sucesso]
    );
  } catch (_error) {
    // historico de acesso nunca deve derrubar o login
  }
}

// Toda conta nova ganha sua propria empresa (preenchida depois na tela de
// "dados da empresa"), ja com todos os modulos ligados por padrao.
async function createEmpresaParaNovoUsuario(nomeUsuario) {
  const { rows } = await query(
    'INSERT INTO empresa (razao_social) VALUES ($1) RETURNING id',
    [nomeUsuario]
  );
  const empresaId = rows[0].id;

  await query('INSERT INTO configuracao_empresa (empresa_id) VALUES ($1)', [empresaId]);
  await query(
    `INSERT INTO empresa_modulo (empresa_id, modulo_id, ativo)
     SELECT $1, id, TRUE FROM modulo_sistema`,
    [empresaId]
  );

  return empresaId;
}

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

  const existing = await query('SELECT id FROM usuario WHERE email = $1', [email]);
  if (existing.rows.length) {
    return sendJson(res, 409, { error: 'email_already_exists', message: 'Este e-mail ja esta cadastrado.' });
  }

  const empresaId = await createEmpresaParaNovoUsuario(name);

  const { rows } = await query(
    `INSERT INTO usuario (empresa_id, nome, email, senha_hash, telefone, cpf, papel, pergunta_seguranca, resposta_seguranca_hash)
     VALUES ($1, $2, $3, $4, $5, $6, 'admin', $7, $8)
     RETURNING id, nome, email, papel`,
    [
      empresaId,
      name,
      email,
      passwordHash(password),
      String(body.phone || '').trim(),
      String(body.cpf || '').trim(),
      String(body.securityQuestion || '').trim(),
      body.securityAnswer ? passwordHash(normalizeAnswer(body.securityAnswer)) : null
    ]
  );
  const user = rows[0];

  const token = await createSession(user.id);
  await registerAccess(user.id, req, true);
  log('register_success', `id=${user.id} email=${email}`);

  return sendJson(res, 201, { id: user.id, name: user.nome, email: user.email, role: user.papel, token });
}

async function login(req, res) {
  const body = await readBody(req);
  const email = normalizeEmail(body.email);
  const { rows } = await query('SELECT * FROM usuario WHERE email = $1 AND ativo = TRUE', [email]);
  const user = rows[0];

  if (!user || !passwordMatches(String(body.password || ''), user.senha_hash)) {
    if (user) await registerAccess(user.id, req, false);
    return sendJson(res, 401, { error: 'invalid_credentials', message: 'E-mail ou senha invalidos.' });
  }

  const token = await createSession(user.id);
  await registerAccess(user.id, req, true);
  log('login_success', `id=${user.id} email=${email}`);

  return sendJson(res, 200, {
    user_id: user.id,
    name: user.nome,
    email: user.email,
    phone: user.telefone,
    role: user.papel,
    token
  });
}

async function forgotPassword(req, res) {
  const body = await readBody(req);
  const email = normalizeEmail(body.email);
  const { rows } = await query('SELECT pergunta_seguranca FROM usuario WHERE email = $1', [email]);

  return sendJson(res, 200, { question: rows[0]?.pergunta_seguranca || '' });
}

async function answerSecurityQuestion(req, res) {
  const body = await readBody(req);
  const email = normalizeEmail(body.email);
  const { rows } = await query('SELECT id, resposta_seguranca_hash FROM usuario WHERE email = $1', [email]);
  const user = rows[0];

  if (!user || !user.resposta_seguranca_hash) {
    return sendJson(res, 400, { error: 'no_question', message: 'Nenhuma pergunta de seguranca cadastrada para este e-mail.' });
  }
  if (!passwordMatches(normalizeAnswer(body.answer), user.resposta_seguranca_hash)) {
    return sendJson(res, 401, { error: 'wrong_answer', message: 'Resposta incorreta.' });
  }

  const token = newToken();
  const expiresAt = new Date(Date.now() + RESET_MINUTES * 60 * 1000);
  await query(
    'INSERT INTO redefinicao_senha (usuario_id, token_hash, expira_em) VALUES ($1, $2, $3)',
    [user.id, hashToken(token), expiresAt]
  );

  return sendJson(res, 200, { token });
}

async function resetPassword(req, res) {
  const body = await readBody(req);
  const password = String(body.password || '');

  if (password.length < 8) {
    return sendJson(res, 400, { error: 'weak_password', message: 'A nova senha precisa de ao menos 8 caracteres.' });
  }

  const tokenHash = hashToken(String(body.token || ''));
  const { rows } = await query(
    `SELECT id, usuario_id FROM redefinicao_senha
      WHERE token_hash = $1 AND utilizado = FALSE AND expira_em > now()`,
    [tokenHash]
  );
  const reset = rows[0];
  if (!reset) return sendJson(res, 400, { error: 'invalid_token', message: 'Link de redefinicao invalido ou expirado.' });

  const userRows = await query('SELECT id, email FROM usuario WHERE id = $1', [reset.usuario_id]);
  const user = userRows.rows[0];
  if (!user) return sendJson(res, 400, { error: 'invalid_token', message: 'Usuario nao encontrado.' });

  await query('UPDATE usuario SET senha_hash = $1, atualizado_em = now() WHERE id = $2', [passwordHash(password), user.id]);
  await query('UPDATE redefinicao_senha SET utilizado = TRUE WHERE id = $1', [reset.id]);
  await query('UPDATE sessao SET revogado_em = now() WHERE usuario_id = $1 AND revogado_em IS NULL', [user.id]);

  log('password_reset', user.email);
  return sendJson(res, 200, { ok: true, email: user.email });
}

async function logout(req, res) {
  const header = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (header) {
    await query('UPDATE sessao SET revogado_em = now() WHERE token_hash = $1', [hashToken(header)]);
  }
  return sendJson(res, 200, { ok: true });
}

async function me(req, res) {
  const user = await userFromToken(req);
  if (!user) return sendJson(res, 401, { error: 'unauthorized', message: 'Sessao expirada.' });
  return sendJson(res, 200, { id: user.id, name: user.nome, email: user.email, phone: user.telefone, role: user.papel });
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

module.exports = { handleAuthRoutes, MODULE_KEYS };
