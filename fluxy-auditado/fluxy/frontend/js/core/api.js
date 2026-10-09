(function migrateLegacyStorageKeys() {
  const RENAMED_KEYS = {
    skina_api_url: 'fluxy_api_url',
    skina_token: 'fluxy_token'
  };

  Object.entries(RENAMED_KEYS).forEach(([oldKey, newKey]) => {
    const oldValue = localStorage.getItem(oldKey);
    if (oldValue !== null && localStorage.getItem(newKey) === null) {
      localStorage.setItem(newKey, oldValue);
    }
    localStorage.removeItem(oldKey);
  });

  localStorage.removeItem('skina_api_logs');
  localStorage.removeItem('fluxy_api_logs');
})();

function isStaticOnlyHost() {
  if (localStorage.getItem('fluxy_api_url')) return false;
  return /\.github\.io$/i.test(location.hostname);
}

function resolveApiBaseUrl() {
  const saved = localStorage.getItem('fluxy_api_url');
  if (saved) return saved.replace(/\/$/, '');
  if (location.protocol === 'http:' || location.protocol === 'https:') return location.origin;
  return 'http://localhost:8080';
}

const API_TIMEOUT_MS = 20000;
const TOKEN_KEY = 'fluxy_token';

function apiError(code, message, data) {
  const error = new Error(message);
  error.code = code;
  error.data = data || null;
  return error;
}

window.FLUXY_API = {
  isFile: location.protocol === 'file:',
  isStaticHost: isStaticOnlyHost(),
  baseUrl: resolveApiBaseUrl(),

  onSessionExpired: null,

  get localOnly() {
    return this.isFile || this.isStaticHost;
  },

  token() {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || '';
  },

  setToken(token, remember) {
    this.clearToken();
    (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
  },

  clearToken() {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  },

  async online() {
    try {
      await this.request('/health', { skipAuth: true });
      return true;
    } catch (_error) {
      return false;
    }
  },

  get(path) {
    return this.request(path);
  },

  send(method, path, payload) {
    return this.request(path, { method, body: payload === undefined ? undefined : JSON.stringify(payload) });
  },

  post(path, payload) {
    return this.send('POST', path, payload);
  },

  async request(path, options = {}) {
    if (this.localOnly) {
      throw apiError('API_UNAVAILABLE', 'Modo local: este endereço não tem servidor.');
    }

    const headers = { Accept: 'application/json', ...(options.headers || {}) };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    const token = this.token();
    const authenticated = Boolean(token) && !options.skipAuth;
    if (authenticated) headers.Authorization = `Bearer ${token}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    let response;
    let rawBody;
    try {
      response = await fetch(this.baseUrl + path, { ...options, headers, signal: controller.signal });
      rawBody = await response.text();
    } catch (_error) {
      throw apiError('API_UNAVAILABLE', 'Não foi possível conectar ao servidor do Fluxy.');
    } finally {
      clearTimeout(timer);
    }

    let data = {};
    try {
      data = rawBody ? JSON.parse(rawBody) : {};
    } catch (_error) {
      throw apiError('API_UNAVAILABLE', 'O servidor respondeu em um formato inesperado.');
    }

    if (!response.ok) {
      if (response.status === 401 && authenticated && this.onSessionExpired) this.onSessionExpired();
      throw apiError(`API_${response.status}`, data.message || `Erro ${response.status}`, data);
    }
    return data;
  }
};

function isConnectionError(error) {
  return error?.code === 'API_UNAVAILABLE' || /^API_5/.test(String(error?.code || ''));
}

function apiErrorMessage(error, fallback) {
  if (error?.code === 'API_UNAVAILABLE') {
    return 'Sem conexão com o servidor. Nada foi salvo. Confira se o Fluxy está em execução e tente de novo.';
  }
  return error?.data?.message || fallback || 'Não foi possível concluir. Tente novamente.';
}
