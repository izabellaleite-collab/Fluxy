const fs = require('fs');
const path = require('path');
const { FRONTEND_DIR, MIME_TYPES } = require('./config');

function serveStatic(req, res, pathname) {
  const relativePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.resolve(FRONTEND_DIR, `.${relativePath}`);

  if (!filePath.startsWith(path.resolve(FRONTEND_DIR) + path.sep)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<h1>404</h1><p>Arquivo nao encontrado. <a href="/index.html">Voltar ao inicio</a></p>');
    }
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

module.exports = { serveStatic };
