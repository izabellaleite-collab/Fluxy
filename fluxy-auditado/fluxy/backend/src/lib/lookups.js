const defaultDb = require('./db');

async function findOrCreateByName(table, nome, empresaId, db) {
  const existing = await db.query(
    `SELECT id FROM ${table} WHERE empresa_id = $1 AND nome = $2 ORDER BY id LIMIT 1`,
    [empresaId, nome]
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const created = await db.query(
    `INSERT INTO ${table} (empresa_id, nome) VALUES ($1, $2) RETURNING id`,
    [empresaId, nome]
  );
  return created.rows[0].id;
}

function findOrCreateCliente(nome, empresaId, db = defaultDb) {
  return nome ? findOrCreateByName('cliente', nome, empresaId, db) : null;
}

function findOrCreateFornecedor(nome, empresaId, db = defaultDb) {
  return nome ? findOrCreateByName('fornecedor', nome, empresaId, db) : null;
}

async function findOrCreateCategoria(nome, tipo, empresaId, db = defaultDb) {
  if (!nome) return null;

  await db.query(
    `INSERT INTO categoria (empresa_id, nome, tipo) VALUES ($1, $2, $3)
     ON CONFLICT (empresa_id, nome, tipo) DO NOTHING`,
    [empresaId, nome, tipo]
  );
  const { rows } = await db.query(
    'SELECT id FROM categoria WHERE empresa_id = $1 AND nome = $2 AND tipo = $3',
    [empresaId, nome, tipo]
  );
  return rows[0].id;
}

module.exports = { findOrCreateCliente, findOrCreateFornecedor, findOrCreateCategoria };
