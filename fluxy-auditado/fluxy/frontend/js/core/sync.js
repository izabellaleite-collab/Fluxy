const FLUXY_SYNC = {
  async loadAll() {
    if (FLUXY_API.localOnly) return 'skipped';

    let data;
    try {
      data = await FLUXY_API.get('/api/sync');
    } catch (error) {
      if (error.code === 'API_401') return 'skipped';
      console.warn('[Fluxy] sincronizacao falhou:', error.message);
      state.offline = true;
      return 'offline';
    }

    state.clients = data.clients;
    state.suppliers = data.suppliers;
    state.products = data.products;
    state.stockHistory = data.stockHistory;
    state.transactions = data.transactions;
    state.accounts = data.accounts;
    state.services = data.services;
    state.events = data.events;
    state.modules = { ...MODULES_DEFAULT, ...data.modules };
    if (data.company) state.company = { ...state.company, ...data.company };
    if (data.settings?.notifications) state.notifications = data.settings.notifications;
    if (data.profile) {
      state.profile = { ...state.profile, ...data.profile, logins: data.logins || [] };
      state.user = { ...state.user, name: data.profile.name, email: data.profile.email, phone: data.profile.phone };
      set('fp_user', state.user);
    }

    state.offline = false;
    persist();
    return 'synced';
  },

  async refreshStock() {
    state.stockHistory = await FLUXY_API.get('/api/movimentacoes-estoque').catch(() => state.stockHistory);
    persist();
  }
};
window.FLUXY_SYNC = FLUXY_SYNC;
