const { spawn } = require('child_process');
const crypto = require('crypto');
const net = require('net');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const TEST_EMAIL_DOMAIN = 'teste.fluxy.invalid';

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function waitUntilReady(baseUrl, child) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error('o servidor de teste encerrou antes de ficar pronto');
    const response = await fetch(`${baseUrl}/health`).catch(() => null);
    if (response?.ok) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('o servidor de teste nao respondeu a tempo');
}

const ISOLATED_ENV = {
  NODE_ENV: '', APP_URL: '', MAIL_MODE: '', CORS_ORIGINS: '',
  SMTP_HOST: '', SMTP_PORT: '', SMTP_SECURE: '', SMTP_USER: '', SMTP_PASS: '', SMTP_REQUIRE_TLS: '', MAIL_FROM: ''
};

async function startServer(extraEnv = {}) {
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [path.join(PROJECT_ROOT, 'backend', 'src', 'index.js')], {
    env: {
      ...process.env,
      ...ISOLATED_ENV,
      API_HOST: '127.0.0.1',
      API_PORT: String(port),
      FLUXY_NO_OPEN: '1',
      TRUST_PROXY: 'true',
      ...extraEnv
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });

  await waitUntilReady(baseUrl, child);

  return {
    baseUrl,
    port,
    output: () => output,
    stop: () => new Promise(resolve => {
      if (child.exitCode !== null) return resolve();
      child.once('exit', () => resolve());
      child.kill();
    })
  };
}

let ipCounter = 0;
const nextFakeIp = () => `10.${crypto.randomInt(1, 250)}.${crypto.randomInt(1, 250)}.${(ipCounter++ % 250) + 1}`;

function createClient(baseUrl, { ip = nextFakeIp(), token = '' } = {}) {
  const client = {
    ip,
    token,
    async request(method, pathname, body, extraHeaders = {}) {
      const headers = { 'X-Forwarded-For': client.ip, ...extraHeaders };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (client.token) headers.Authorization = `Bearer ${client.token}`;

      const response = await fetch(`${baseUrl}${pathname}`, {
        method,
        headers,
        body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
      });
      const text = await response.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (_error) {
        data = text;
      }
      return { status: response.status, data, headers: response.headers };
    },
    get: pathname => client.request('GET', pathname),
    post: (pathname, body = {}) => client.request('POST', pathname, body),
    del: (pathname, body) => client.request('DELETE', pathname, body)
  };
  return client;
}

const createdEmails = new Set();

function newEmail(prefix = 'conta') {
  const email = `${prefix}-${crypto.randomBytes(6).toString('hex')}@${TEST_EMAIL_DOMAIN}`;
  createdEmails.add(email);
  return email;
}

const PASSWORD = 'Senha1234';

async function registerAccount(baseUrl, overrides = {}) {
  const email = overrides.email || newEmail();
  createdEmails.add(email);
  const client = createClient(baseUrl);
  const response = await client.post('/api/auth/register', {
    name: 'Pessoa de Teste', email, password: PASSWORD, ...overrides
  });
  if (response.status !== 201) throw new Error(`cadastro de teste falhou: ${response.status} ${JSON.stringify(response.data)}`);
  client.token = response.data.token;
  return { client, email, password: overrides.password || PASSWORD, account: response.data };
}

let pool = null;

function db() {
  if (!pool) {
    const { Pool } = require('pg');
    const { DATABASE_URL } = require(path.join(PROJECT_ROOT, 'backend', 'src', 'config'));
    pool = new Pool({ connectionString: DATABASE_URL, max: 3 });
  }
  return pool;
}

async function cleanup() {
  if (createdEmails.size) {
    const emails = [...createdEmails];
    await db().query('DELETE FROM empresa WHERE id IN (SELECT empresa_id FROM usuario WHERE email = ANY($1))', [emails]);
    await db().query('DELETE FROM usuario WHERE email = ANY($1)', [emails]);
    createdEmails.clear();
  }
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = { PROJECT_ROOT, PASSWORD, startServer, createClient, registerAccount, newEmail, db, cleanup, nextFakeIp };
