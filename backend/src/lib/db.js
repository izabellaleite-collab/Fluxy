const { Pool, types } = require('pg');
const { DATABASE_URL, DATABASE_SSL } = require('../config');

// BIGSERIAL (oid 20) e NUMERIC (oid 1700) voltam do driver como string por
// padrao. O front trata id e valor como number (comparacoes, money(), onclick
// de remover etc.), entao convertemos aqui uma unica vez para todo o app.
types.setTypeParser(20, value => (value === null ? null : Number(value)));
types.setTypeParser(1700, value => (value === null ? null : Number(value)));

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_SSL ? { rejectUnauthorized: false } : undefined
});

pool.on('error', error => {
  console.error('[Fluxy] erro inesperado no pool do PostgreSQL:', error.message);
});

function query(text, params) {
  return pool.query(text, params);
}

async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
