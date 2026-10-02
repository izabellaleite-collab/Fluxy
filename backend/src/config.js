const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const FRONTEND_DIR = path.join(PROJECT_ROOT, 'frontend');

// Le backend/.env manualmente (sem dependencia externa) e preenche
// process.env so onde a variavel ainda nao existir.
(function loadEnvFile() {
  const envPath = path.join(PROJECT_ROOT, 'backend', '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) return;
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  });
})();

// PORT/HOST sao definidos automaticamente por hospedagens como o Render.
// Localmente valem API_PORT/API_HOST do backend/.env (padrao 127.0.0.1:8080).
const PORT = Number(process.env.PORT || process.env.API_PORT || 8080);
const HOST = process.env.HOST || process.env.API_HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');

// Bancos hospedados (Neon, Render, Supabase...) exigem conexao SSL.
const DATABASE_SSL = process.env.DATABASE_SSL === 'true';

// Origens que podem chamar a API pelo navegador (ex.: o site no GitHub
// Pages). Lista separada por virgula; vazio = qualquer origem.
const CORS_ORIGINS = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

const DATABASE_URL = process.env.DATABASE_URL ||
  `postgres://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || 'postgres'}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'fluxy_db'}`;

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
  HOST,
  PORT,
  DATABASE_URL,
  DATABASE_SSL,
  CORS_ORIGINS,
  MIME_TYPES
};
