const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const FRONTEND_DIR = path.join(PROJECT_ROOT, 'frontend');
const DATA_DIR = path.join(PROJECT_ROOT, 'backend', 'database', 'data');
const LOG_DIR = path.join(PROJECT_ROOT, 'backend', 'logs');

const HOST = process.env.API_HOST || '127.0.0.1';
const PORT = Number(process.env.API_PORT || 8080);

const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, 'fluxy-data.json');
const LEGACY_DB_FILE = path.join(DATA_DIR, 'skina-data.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8'
};

module.exports = {
  PROJECT_ROOT,
  FRONTEND_DIR,
  DATA_DIR,
  LOG_DIR,
  HOST,
  PORT,
  DB_FILE,
  LEGACY_DB_FILE,
  MIME_TYPES
};
