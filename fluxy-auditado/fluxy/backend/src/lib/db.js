const { Pool, types } = require('pg');
const { DATABASE_URL } = require('../config');

// BIGINT e NUMERIC chegam como texto; o front trabalha com numeros.
types.setTypeParser(20, value => (value === null ? null : Number(value)));
types.setTypeParser(1700, value => (value === null ? null : Number(value)));

// DATE fica como "AAAA-MM-DD": convertido para Date, o dia mudaria conforme o fuso do servidor.
types.setTypeParser(1082, value => value);

const pool = new Pool({ connectionString: DATABASE_URL });

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
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
