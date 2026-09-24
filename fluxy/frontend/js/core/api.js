(function migrateLegacyStorageKeys() {
  const RENAMED_KEYS = {
    skina_api_url: 'fluxy_api_url',
    skina_token: 'fluxy_token',
    skina_api_logs: 'fluxy_api_logs'
  };

  Object.entries(RENAMED_KEYS).forEach(([oldKey, newKey]) => {
    const oldValue = localStorage.getItem(oldKey);
    if (oldValue !== null && localStorage.getItem(newKey) === null) {
      localStorage.setItem(newKey, oldValue);
    }
  });
})();

function resolveApiBaseUrl() {
  const saved = localStorage.getItem('fluxy_api_url');
  if (saved) return saved.replace(/\/$/, '');
  if (location.protocol === 'http:' || location.protocol === 'https:') return location.origin;
  return 'http://localhost:8080';
}

window.FLUXY_API = {
  apiPort: 8080,
  isFile: location.protocol === 'file:',
  baseUrl: resolveApiBaseUrl(),

  token() {
    return localStorage.getItem('fluxy_token') || '';
  },

  log(level, message, details) {
    const entry = { time: new Date().toISOString(), level, message, details };
    console[level === 'error' ? 'error' : 'log']('[Fluxy API]', message, details || '');
    try {
      const logs = JSON.parse(localStorage.getItem('fluxy_api_logs') || '[]');
      logs.push(entry);
      localStorage.setItem('fluxy_api_logs', JSON.stringify(logs.slice(-100)));
    } catch (_error) {
    }
  },

  async health() {
    return this.request('/health', { skipAuth: true });
  },

  async online() {
    try {
      await this.health();
      return true;
    } catch (_error) {
      return false;
    }
  },

  async request(path, options = {}) {
    if (this.isFile) {
      this.log('warn', 'frontend_opened_as_file', {
        message: 'Abra pelo INICIAR-FLUXY (http://localhost:8080). Usando modo local.'
      });
      const offlineError = new Error(
        'O sistema foi aberto direto pelo arquivo (file://). Use o INICIAR-FLUXY e acesse http://localhost:8080.'
      );
      offlineError.code = 'API_UNAVAILABLE';
      throw offlineError;
    }

    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    const token = this.token();
    if (token && !options.skipAuth) headers.Authorization = `Bearer ${token}`;

    const url = this.baseUrl + path;
    let response;
    try {
      response = await fetch(url, { ...options, headers });
    } catch (error) {
      this.log('error', 'fetch_failed', { url, error: error.message });
      const connectionError = new Error(
        `Nao foi possivel conectar a API em ${this.baseUrl}. Abra o sistema pelo INICIAR-FLUXY.`
      );
      connectionError.code = 'API_UNAVAILABLE';
      throw connectionError;
    }

    const rawBody = await response.text();
    let data = {};
    try {
      data = rawBody ? JSON.parse(rawBody) : {};
    } catch (_error) {
      this.log('error', 'invalid_json', { url, status: response.status, text: rawBody.slice(0, 300) });
      const parseError = new Error('A API respondeu em formato invalido.');
      parseError.code = 'API_UNAVAILABLE';
      throw parseError;
    }

    if (!response.ok) {
      this.log('error', 'http_error', { url, status: response.status, data });
      const httpError = new Error(`API ${response.status}`);
      httpError.code = `API_${response.status}`;
      httpError.data = data;
      throw httpError;
    }

    this.log('info', 'request_ok', { url, status: response.status });
    return data;
  }
};
