const fs = require('fs');
const { DATA_DIR, DB_FILE, LEGACY_DB_FILE } = require('../config');

function emptyDb() {
  return { users: [], sessions: [], company: null, resets: [], seq: 1 };
}

function migrateLegacyDbFileIfNeeded() {
  if (fs.existsSync(DB_FILE) || !fs.existsSync(LEGACY_DB_FILE)) return;
  try {
    fs.copyFileSync(LEGACY_DB_FILE, DB_FILE);
  } catch (_error) {
  }
}

function loadDb() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    migrateLegacyDbFileIfNeeded();
    if (!fs.existsSync(DB_FILE)) return emptyDb();
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8') || '{}');
    return { ...emptyDb(), ...parsed };
  } catch (error) {
    console.error('[Fluxy] falha ao ler o banco local, recriando.', error.message);
    return emptyDb();
  }
}

const db = loadDb();

function saveDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmpFile, DB_FILE);
}

module.exports = { db, saveDb };
