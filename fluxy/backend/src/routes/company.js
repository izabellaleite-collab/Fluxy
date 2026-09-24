const { db, saveDb } = require('../lib/database');
const { sendJson, readBody } = require('../lib/http-helpers');

async function handleCompanyRoute(req, res, pathname) {
  if (pathname !== '/api/company') return false;

  if (req.method === 'POST') {
    const body = await readBody(req);
    db.company = { ...(db.company || {}), ...body, updated_at: new Date().toISOString() };
    saveDb();
    sendJson(res, 200, { ok: true, company: db.company });
    return true;
  }

  sendJson(res, 200, { company: db.company });
  return true;
}

module.exports = { handleCompanyRoute };
