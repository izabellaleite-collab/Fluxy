const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const todayISO = () => new Date().toISOString().slice(0, 10);

const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

const date = value => (value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : '');

const uid = () => Date.now() + Math.floor(Math.random() * 999);

function esc(value) {
  const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(value ?? '').replace(/[&<>"']/g, char => entities[char]);
}

function get(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch (_error) {
    return fallback;
  }
}

function set(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

const MODULES_DEFAULT = {
  dashboard: true,
  financeiro: true,
  contas: true,
  estoque: true,
  clientes: true,
  fornecedores: true,
  servicos: true,
  agenda: true,
  calendario: true,
  relatorios: true
};

function withNumericValor(list) {
  return list.map(item => ({ ...item, valor: Number(item.valor) || 0 }));
}

const state = {
  user: get('fp_user', null),
  transactions: withNumericValor(get('fp_transactions', get('gs_transacoes', []))),
  accounts: withNumericValor(get('fp_accounts', get('gs_contas', []))),
  clients: get('fp_clients', get('gs_clientes', [])),
  services: withNumericValor(get('fp_services', get('gs_servicos', []))),
  events: get('fp_events', []),
  modules: { ...MODULES_DEFAULT, ...get('fp_modules', {}) },
  profile: get('fp_profile', {
    name: '',
    email: '',
    phone: '',
    created: new Date().toISOString(),
    avatar: 'AF',
    twoFactor: false,
    logins: []
  }),
  company: get('fp_company', {
    name: 'Minha empresa',
    trade: '',
    doc: '',
    segment: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    cep: '',
    logo: '',
    timezone: 'America/Sao_Paulo'
  }),
  suppliers: get('fp_suppliers', []),
  products: get('fp_products', []),
  stockHistory: get('fp_stock_history', []),
  notifications: get('fp_notifications', { accounts: true, events: true }),
  calendarDate: new Date()
};

if (!state.user) {
  state.user = { name: state.profile.name, email: state.profile.email };
}

function persist() {
  set('fp_suppliers', state.suppliers);
  set('fp_transactions', state.transactions);
  set('fp_accounts', state.accounts);
  set('fp_clients', state.clients);
  set('fp_services', state.services);
  set('fp_events', state.events);
  set('fp_products', state.products);
  set('fp_stock_history', state.stockHistory);
  set('fp_modules', state.modules);
  set('fp_profile', state.profile);
  set('fp_company', state.company);
  set('fp_notifications', state.notifications);
}

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
}

function exportJSON(filename, data) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
