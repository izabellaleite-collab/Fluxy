const http = require('http');
const { exec } = require('child_process');
const { HOST, PORT, DATABASE_URL, CORS_ORIGINS } = require('./config');
const { log } = require('./lib/logger');
const { pool } = require('./lib/db');
const { sendJson } = require('./lib/http-helpers');
const { handleApi } = require('./routes');
const { serveStatic } = require('./static-server');
const { applySchema } = require('../database/apply-schema');

// Em hospedagem (Render define PORT) nao existe navegador para abrir.
const IS_HOSTED = Boolean(process.env.PORT);

function resolvePathname(req) {
  try {
    return decodeURIComponent(new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname);
  } catch (_error) {
    return (req.url || '/').split('?')[0];
  }
}

// Permite que o site publicado em outro dominio (GitHub Pages) chame a API.
// A autenticacao e por token (Authorization: Bearer), sem cookies.
function applyCors(req, res) {
  const origin = String(req.headers.origin || '').replace(/\/$/, '');
  if (!origin) return;
  const allowed = CORS_ORIGINS.length === 0 || CORS_ORIGINS.includes(origin);
  if (!allowed) return;
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGINS.length === 0 ? '*' : origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Max-Age', '86400');
}

const server = http.createServer((req, res) => {
  const pathname = resolvePathname(req);

  if (pathname === '/health' || pathname.startsWith('/api/')) {
    applyCors(req, res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    handleApi(req, res, pathname).catch(error => {
      console.error('[Fluxy] erro interno', error);
      sendJson(res, 500, { error: 'internal_error', message: 'Erro interno no servidor.' });
    });
    return;
  }

  serveStatic(req, res, pathname);
});

const appUrl = `http://localhost:${PORT}/index.html`;

function openBrowser() {
  if (IS_HOSTED || process.env.FLUXY_NO_OPEN === '1') return;
  const command = process.platform === 'win32'
    ? `start "" "${appUrl}"`
    : process.platform === 'darwin' ? `open "${appUrl}"` : `xdg-open "${appUrl}"`;
  exec(command, () => {});
}

server.on('error', error => {
  if (error.code === 'EADDRINUSE' && !IS_HOSTED) {
    log(`a porta ${PORT} ja esta em uso - o Fluxy provavelmente ja esta aberto.`);
    log(`abrindo ${appUrl}`);
    openBrowser();
    setTimeout(() => process.exit(0), 1200);
    return;
  }
  console.error('[Fluxy] falha ao iniciar o servidor:', error.message);
  process.exit(1);
});

async function start() {
  try {
    await applySchema(pool);
    log('banco PostgreSQL: conectado e tabelas verificadas');
  } catch (error) {
    log(`ATENCAO: nao foi possivel preparar o PostgreSQL (${error.message})`);
    log('confira DATABASE_URL em backend/.env (ou nas variaveis da hospedagem).');
  }

  server.listen(PORT, HOST, () => {
    log('Fluxy ONLINE (frontend + API na mesma porta)');
    log(`site .......: ${IS_HOSTED ? `porta ${PORT}` : appUrl}`);
    log(`health .....: /health`);
    log(`banco ......: ${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);
    if (!IS_HOSTED) log('para encerrar, feche esta janela ou pressione Ctrl+C');
    openBrowser();
  });
}

function shutdown() {
  server.close(() => pool.end().finally(() => process.exit(0)));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = { server, start };
