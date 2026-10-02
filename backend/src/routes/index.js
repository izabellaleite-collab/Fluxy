const { query } = require('../lib/db');
const { sendJson } = require('../lib/http-helpers');
const { handleAuthRoutes } = require('./auth');
const { handleCompanyRoute, handleModulesRoute, handleSettingsRoute } = require('./company');
const { handleDataRoutes } = require('./data');

async function handleApi(req, res, pathname) {
  if (pathname === '/health' || pathname === '/api/health') {
    try {
      await query('SELECT 1');
      return sendJson(res, 200, { status: 'ok', database: 'connected' });
    } catch (error) {
      return sendJson(res, 200, { status: 'degraded', database: 'unavailable', message: error.message });
    }
  }

  if (await handleAuthRoutes(req, res, pathname)) return;
  if (await handleCompanyRoute(req, res, pathname)) return;
  if (await handleModulesRoute(req, res, pathname)) return;
  if (await handleSettingsRoute(req, res, pathname)) return;
  if (await handleDataRoutes(req, res, pathname)) return;

  return sendJson(res, 404, { error: 'not_found', message: 'Rota nao encontrada.' });
}

module.exports = { handleApi };
