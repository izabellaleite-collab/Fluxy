// Funcoes de apoio para transformar texto livre (como o front ainda envia
// hoje: "cliente", "fornecedor" digitados num input) em referencias reais
// de tabela, criando o cadastro na hora quando ele ainda nao existe.
const { query } = require('./db');

async function findOrCreateCliente(nome, empresaId) {
  const trimmed = String(nome || '').trim();
  if (!trimmed) return null;

  const existing = await query(
    'SELECT id FROM cliente WHERE empresa_id = $1 AND nome = $2 LIMIT 1',
    [empresaId, trimmed]
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const created = await query(
    'INSERT INTO cliente (empresa_id, nome) VALUES ($1, $2) RETURNING id',
    [empresaId, trimmed]
  );
  return created.rows[0].id;
}

async function findOrCreateFornecedor(nome, empresaId) {
  const trimmed = String(nome || '').trim();
  if (!trimmed) return null;

  const existing = await query(
    'SELECT id FROM fornecedor WHERE empresa_id = $1 AND nome = $2 LIMIT 1',
    [empresaId, trimmed]
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const created = await query(
    'INSERT INTO fornecedor (empresa_id, nome) VALUES ($1, $2) RETURNING id',
    [empresaId, trimmed]
  );
  return created.rows[0].id;
}

async function findOrCreateCategoria(nome, tipo, empresaId) {
  const trimmed = String(nome || '').trim();
  if (!trimmed) return null;

  const existing = await query(
    'SELECT id FROM categoria WHERE empresa_id = $1 AND nome = $2 AND tipo = $3 LIMIT 1',
    [empresaId, trimmed, tipo]
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const created = await query(
    'INSERT INTO categoria (empresa_id, nome, tipo) VALUES ($1, $2, $3) RETURNING id',
    [empresaId, trimmed, tipo]
  );
  return created.rows[0].id;
}

module.exports = { findOrCreateCliente, findOrCreateFornecedor, findOrCreateCategoria };
