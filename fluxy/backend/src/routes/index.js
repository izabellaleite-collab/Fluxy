const { db } = require('../lib/database');
const { sendJson } = require('../lib/http-helpers');
const { DB_FILE } = require('../config');
const { handleAuthRoutes } = require('./auth');
const { handleCompanyRoute } = require('./company');

async function handleApi(req, res, pathname) {
  if (req.method === 'OPTIONS') return sendJson(res, 204, {});

  if (pathname === '/health' || pathname === '/api/health') {
    return sendJson(res, 200, {
      status: 'ok',
      database: 'connected',
      storage: DB_FILE,
      users: db.users.length
    });
  }

  if (await handleAuthRoutes(req, res, pathname)) return;
  if (await handleCompanyRoute(req, res, pathname)) return;

  return sendJson(res, 404, { error: 'not_found', message: 'Rota nao encontrada.' });
}

module.exports = { handleApi };
