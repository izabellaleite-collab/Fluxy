// Busca os dados reais (banco de dados, via API) assim que o usuario entra
// no painel. O localStorage continua servindo de cache/rascunho offline -
// quando a API responde, ela e sempre a fonte da verdade.
const FLUXY_SYNC = {
  async loadAll() {
    if (!window.FLUXY_API || FLUXY_API.isFile || !FLUXY_API.baseUrl) return false;

    try {
      const [clients, suppliers, products, stockHistory, transactions, accounts, services, events, modules, companyResponse, settings] =
        await Promise.all([
          FLUXY_API.request('/api/clientes'),
          FLUXY_API.request('/api/fornecedores'),
          FLUXY_API.request('/api/produtos'),
          FLUXY_API.request('/api/movimentacoes-estoque'),
          FLUXY_API.request('/api/transacoes'),
          FLUXY_API.request('/api/contas'),
          FLUXY_API.request('/api/servicos'),
          FLUXY_API.request('/api/eventos'),
          FLUXY_API.request('/api/modulos'),
          FLUXY_API.request('/api/company'),
          FLUXY_API.request('/api/configuracoes')
        ]);

      state.clients = clients;
      state.suppliers = suppliers;
      state.products = products;
      state.stockHistory = stockHistory;
      state.transactions = transactions;
      state.accounts = accounts;
      state.services = services;
      state.events = events;
      state.modules = { ...MODULES_DEFAULT, ...modules };
      if (companyResponse?.company) state.company = { ...state.company, ...companyResponse.company };
      if (settings?.notifications) state.notifications = settings.notifications;

      persist();
      return true;
    } catch (error) {
      FLUXY_API.log('warn', 'sync_failed', { message: error.message });
      return false;
    }
  },

  async refreshStock() {
    try {
      state.stockHistory = await FLUXY_API.request('/api/movimentacoes-estoque');
      persist();
    } catch (_error) {
    }
  }
};
window.FLUXY_SYNC = FLUXY_SYNC;
