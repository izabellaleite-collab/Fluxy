const http = require('http');
const { exec } = require('child_process');
const { HOST, PORT, DB_FILE } = require('./config');
const { log } = require('./lib/logger');
const { db } = require('./lib/database');
const { sendJson } = require('./lib/http-helpers');
const { handleApi } = require('./routes');
const { serveStatic } = require('./static-server');

function resolvePathname(req) {
  try {
    return decodeURIComponent(new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname);
  } catch (_error) {
    return (req.url || '/').split('?')[0];
  }
}

const server = http.createServer((req, res) => {
  const pathname = resolvePathname(req);

  if (pathname === '/health' || pathname.startsWith('/api/')) {
    handleApi(req, res, pathname).catch(error => {
      console.error('[Fluxy] erro interno', error);
      sendJson(res, 500, { error: 'internal_error', message: 'Erro interno no servidor local.' });
    });
    return;
  }

  serveStatic(req, res, pathname);
});

const appUrl = `http://localhost:${PORT}/index.html`;

function openBrowser() {
  if (process.env.FLUXY_NO_OPEN === '1') return;
  const command = process.platform === 'win32'
    ? `start "" "${appUrl}"`
    : process.platform === 'darwin' ? `open "${appUrl}"` : `xdg-open "${appUrl}"`;
  exec(command, () => {});
}

server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    log(`a porta ${PORT} ja esta em uso - o Fluxy provavelmente ja esta aberto.`);
    log(`abrindo ${appUrl}`);
    openBrowser();
    setTimeout(() => process.exit(0), 1200);
    return;
  }
  console.error('[Fluxy] falha ao iniciar o servidor:', error.message);
  process.exit(1);
});

function start() {
  server.listen(PORT, HOST, () => {
    log('Fluxy ONLINE (frontend + API na mesma porta)');
    log(`site .......: ${appUrl}`);
    log(`api ........: http://localhost:${PORT}/api`);
    log(`health .....: http://localhost:${PORT}/health`);
    log(`banco local : ${DB_FILE}`);
    log(`usuarios ...: ${db.users.length}`);
    log('para encerrar, feche esta janela ou pressione Ctrl+C');
    openBrowser();
  });
}

function shutdown() {
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = { server, start };
