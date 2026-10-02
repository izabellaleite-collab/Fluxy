const crypto = require('crypto');
const { query } = require('./db');
const { sendJson } = require('./http-helpers');

async function userFromToken(req) {
  const header = String(req.headers.authorization || '');
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const { rows } = await query(
    `SELECT u.*
       FROM sessao s
       JOIN usuario u ON u.id = s.usuario_id
      WHERE s.token_hash = $1 AND s.expira_em > now() AND s.revogado_em IS NULL AND u.ativo = TRUE`,
    [tokenHash]
  );
  return rows[0] || null;
}

// Usado pelas rotas de dados: exige login valido e devolve o usuario
// (com empresa_id) para o handler. Responde 401 sozinho quando falha.
async function requireUser(req, res) {
  const user = await userFromToken(req);
  if (!user) {
    sendJson(res, 401, { error: 'unauthorized', message: 'Sessao expirada, faca login novamente.' });
    return null;
  }
  return user;
}

module.exports = { userFromToken, requireUser };
