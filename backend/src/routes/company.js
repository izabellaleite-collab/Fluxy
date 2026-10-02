const { query } = require('../lib/db');
const { sendJson, readBody } = require('../lib/http-helpers');
const { requireUser } = require('../lib/auth-middleware');

function mapEmpresa(row) {
  if (!row) return null;
  return {
    name: row.razao_social || '',
    trade: row.nome_fantasia || '',
    doc: row.cnpj || '',
    segment: row.segmento || '',
    phone: row.telefone || '',
    email: row.email || '',
    address: row.endereco || '',
    city: row.cidade || '',
    state: row.estado || '',
    cep: row.cep || '',
    logo: row.logotipo_url || '',
    timezone: row.fuso_horario || 'America/Sao_Paulo'
  };
}

const EMPRESA_FIELD_MAP = {
  name: 'razao_social',
  trade: 'nome_fantasia',
  doc: 'cnpj',
  segment: 'segmento',
  phone: 'telefone',
  email: 'email',
  address: 'endereco',
  city: 'cidade',
  state: 'estado',
  cep: 'cep',
  logo: 'logotipo_url',
  timezone: 'fuso_horario'
};

async function handleCompanyRoute(req, res, pathname) {
  if (pathname !== '/api/company') return false;

  const user = await requireUser(req, res);
  if (!user) return true;

  if (req.method === 'POST') {
    const body = await readBody(req);
    const setClauses = [];
    const values = [];

    Object.entries(EMPRESA_FIELD_MAP).forEach(([frontendKey, column]) => {
      if (body[frontendKey] === undefined) return;
      values.push(body[frontendKey]);
      setClauses.push(`${column} = $${values.length}`);
    });

    if (setClauses.length) {
      values.push(user.empresa_id);
      await query(
        `UPDATE empresa SET ${setClauses.join(', ')}, atualizado_em = now() WHERE id = $${values.length}`,
        values
      );
    }

    const { rows } = await query('SELECT * FROM empresa WHERE id = $1', [user.empresa_id]);
    sendJson(res, 200, { ok: true, company: mapEmpresa(rows[0]) });
    return true;
  }

  const { rows } = await query('SELECT * FROM empresa WHERE id = $1', [user.empresa_id]);
  sendJson(res, 200, { company: mapEmpresa(rows[0]) });
  return true;
}

async function handleModulesRoute(req, res, pathname) {
  if (pathname !== '/api/modulos') return false;

  const user = await requireUser(req, res);
  if (!user) return true;

  if (req.method === 'POST' || req.method === 'PUT') {
    const body = await readBody(req);
    const entries = Object.entries(body).filter(([, value]) => typeof value === 'boolean');
    for (const [chave, ativo] of entries) {
      await query(
        `INSERT INTO empresa_modulo (empresa_id, modulo_id, ativo)
         SELECT $1, id, $2 FROM modulo_sistema WHERE chave = $3
         ON CONFLICT (empresa_id, modulo_id) DO UPDATE SET ativo = EXCLUDED.ativo, atualizado_em = now()`,
        [user.empresa_id, ativo, chave]
      );
    }
  }

  const { rows } = await query(
    `SELECT m.chave, em.ativo
       FROM modulo_sistema m
       LEFT JOIN empresa_modulo em ON em.modulo_id = m.id AND em.empresa_id = $1`,
    [user.empresa_id]
  );
  const modules = {};
  rows.forEach(row => { modules[row.chave] = row.ativo !== false; });
  sendJson(res, 200, modules);
  return true;
}

async function handleSettingsRoute(req, res, pathname) {
  if (pathname !== '/api/configuracoes') return false;

  const user = await requireUser(req, res);
  if (!user) return true;

  if (req.method === 'POST' || req.method === 'PUT') {
    const body = await readBody(req);
    const notifications = body.notifications || {};
    await query(
      `INSERT INTO configuracao_empresa (empresa_id, moeda, tema, notificar_contas, notificar_eventos)
       VALUES ($1, COALESCE($2, 'BRL'), COALESCE($3, 'claro'), COALESCE($4, TRUE), COALESCE($5, TRUE))
       ON CONFLICT (empresa_id) DO UPDATE SET
         moeda = COALESCE($2, configuracao_empresa.moeda),
         tema = COALESCE($3, configuracao_empresa.tema),
         notificar_contas = COALESCE($4, configuracao_empresa.notificar_contas),
         notificar_eventos = COALESCE($5, configuracao_empresa.notificar_eventos),
         atualizado_em = now()`,
      [user.empresa_id, body.moeda ?? null, body.tema ?? null, notifications.accounts ?? null, notifications.events ?? null]
    );
  }

  const { rows } = await query('SELECT * FROM configuracao_empresa WHERE empresa_id = $1', [user.empresa_id]);
  const settings = rows[0];
  sendJson(res, 200, {
    moeda: settings?.moeda || 'BRL',
    tema: settings?.tema || 'claro',
    notifications: {
      accounts: settings?.notificar_contas ?? true,
      events: settings?.notificar_eventos ?? true
    }
  });
  return true;
}

module.exports = { handleCompanyRoute, handleModulesRoute, handleSettingsRoute };
