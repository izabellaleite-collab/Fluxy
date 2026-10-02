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

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

// Decide para onde vao as chamadas da API:
// 1. URL salva manualmente no navegador (localStorage "fluxy_api_url");
// 2. rodando local (npm start): a propria origem (site + API na mesma porta);
// 3. site publicado: a URL definida em frontend/config.js;
// 4. nenhuma das anteriores: '' -> modo local, sem chamar API nenhuma.
function resolveApiBaseUrl() {
  const saved = localStorage.getItem('fluxy_api_url');
  if (saved) return saved.replace(/\/$/, '');
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return '';
  if (LOCAL_HOSTS.includes(location.hostname)) return location.origin;
  const configured = (window.FLUXY_CONFIG && window.FLUXY_CONFIG.apiUrl) || '';
  return configured.replace(/\/$/, '');
}

// Pagina em HTTPS nao pode chamar API em HTTP (o navegador bloqueia como
// "mixed content"), exceto quando a API esta na propria maquina.
function isBlockedMixedContent(baseUrl) {
  if (location.protocol !== 'https:' || !baseUrl.startsWith('http:')) return false;
  try {
    return !LOCAL_HOSTS.includes(new URL(baseUrl).hostname);
  } catch (_error) {
    return true;
  }
}

function unavailableError(message) {
  const error = new Error(message);
  error.code = 'API_UNAVAILABLE';
  return error;
}

window.FLUXY_API = {
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

  async request(path, options = {}) {
    if (this.isFile) {
      throw unavailableError(
        'O sistema foi aberto direto pelo arquivo (file://). Use o INICIAR-FLUXY e acesse http://localhost:8080.'
      );
    }
    if (!this.baseUrl) {
      throw unavailableError('Nenhuma API configurada (frontend/config.js). Usando modo local.');
    }
    if (isBlockedMixedContent(this.baseUrl)) {
      this.log('warn', 'mixed_content', { baseUrl: this.baseUrl });
      throw unavailableError(`A API precisa usar https:// (configurada: ${this.baseUrl}).`);
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
        `Nao foi possivel conectar a API em ${this.baseUrl}. Usando modo local.`
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
      // 404/405 sem o formato de erro da API = o endereco nao e a API do
      // Fluxy (ex.: GitHub Pages). Tratado como "API indisponivel".
      const notTheApi = (response.status === 404 || response.status === 405) && !data.error;
      const httpError = new Error(`API ${response.status}`);
      httpError.code = notTheApi ? 'API_UNAVAILABLE' : `API_${response.status}`;
      httpError.data = data;
      throw httpError;
    }

    this.log('info', 'request_ok', { url, status: response.status });
    return data;
  }
};
