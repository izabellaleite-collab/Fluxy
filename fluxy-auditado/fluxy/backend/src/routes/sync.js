const { sendJson } = require('../lib/http-helpers');
const { requireUser } = require('../lib/auth-middleware');
const { mapProfile, listAccessHistory } = require('./account');
const { getCompany, getModules, getSettings } = require('./company');
const data = require('./data');

async function handleSyncRoute(req, res, pathname) {
  if (pathname !== '/api/sync' || req.method !== 'GET') return false;

  const user = await requireUser(req);
  const empresaId = user.empresa_id;

  const [
    logins, company, modules, settings,
    clients, suppliers, products, stockHistory, transactions, accounts, services, events
  ] = await Promise.all([
    listAccessHistory(user.id),
    getCompany(empresaId),
    getModules(empresaId),
    getSettings(empresaId),
    data.listClientes(empresaId),
    data.listFornecedores(empresaId),
    data.listProdutos(empresaId),
    data.listMovimentacoes(empresaId),
    data.listTransacoes(empresaId),
    data.listContas(empresaId),
    data.listServicos(empresaId),
    data.listEventos(empresaId)
  ]);

  sendJson(res, 200, {
    profile: mapProfile(user),
    logins,
    company,
    modules,
    settings,
    clients,
    suppliers,
    products,
    stockHistory,
    transactions,
    accounts,
    services,
    events
  });
  return true;
}

module.exports = { handleSyncRoute };
