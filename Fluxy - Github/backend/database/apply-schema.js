const fs = require('fs');
const path = require('path');

// Aplica schema.sql (idempotente: pode rodar a cada inicializacao).
async function applySchema(pool) {
  await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
}

async function applySeed(pool) {
  await pool.query(fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8'));
}

module.exports = { applySchema, applySeed };
