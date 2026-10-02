// Rotas de dados do dia a dia: clientes, fornecedores, produtos, estoque,
// transacoes, contas, servicos e agenda. Tudo aqui e sempre filtrado pela
// empresa do usuario logado (nunca um usuario ve dados de outra empresa).
const { query, withTransaction } = require('../lib/db');
const { sendJson, readBody } = require('../lib/http-helpers');
const { requireUser } = require('../lib/auth-middleware');
const { findOrCreateCliente, findOrCreateFornecedor, findOrCreateCategoria } = require('../lib/lookups');

function idFromPath(prefix, pathname) {
  if (pathname === prefix) return null;
  const match = pathname.slice(prefix.length).match(/^\/(\d+)(?:\/(\w+))?$/);
  return match ? { id: Number(match[1]), action: match[2] || null } : undefined;
}

const dateOnly = value => {
  if (!value) return '';
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
};
const timeOnly = value => (value ? String(value).slice(0, 5) : '');

// ---------- clientes ----------

function mapCliente(row) {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email || '',
    telefone: row.telefone || '',
    observacoes: row.observacoes || '',
    created: dateOnly(row.criado_em)
  };
}

async function handleClientes(req, res, pathname) {
  const prefix = '/api/clientes';
  if (!pathname.startsWith(prefix)) return false;
  const user = await requireUser(req, res);
  if (!user) return true;
  const target = idFromPath(prefix, pathname);

  if (req.method === 'GET' && target === null) {
    const { rows } = await query('SELECT * FROM cliente WHERE empresa_id = $1 ORDER BY nome', [user.empresa_id]);
    sendJson(res, 200, rows.map(mapCliente));
    return true;
  }

  if (req.method === 'POST' && target === null) {
    const body = await readBody(req);
    if (!String(body.nome || '').trim()) {
      sendJson(res, 400, { error: 'invalid_request', message: 'Informe o nome do cliente.' });
      return true;
    }
    const { rows } = await query(
      `INSERT INTO cliente (empresa_id, nome, email, telefone, observacoes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [user.empresa_id, body.nome.trim(), body.email || null, body.telefone || null, body.observacoes || null]
    );
    sendJson(res, 201, mapCliente(rows[0]));
    return true;
  }

  if (req.method === 'DELETE' && target && target.id) {
    await query('DELETE FROM cliente WHERE id = $1 AND empresa_id = $2', [target.id, user.empresa_id]);
    sendJson(res, 200, { ok: true });
    return true;
  }

  return false;
}

// ---------- fornecedores ----------

function mapFornecedor(row) {
  return {
    id: row.id,
    nome: row.nome,
    documento: row.documento || '',
    telefone: row.telefone || '',
    email: row.email || '',
    cidade: row.cidade || '',
    estado: row.estado || '',
    categoria: row.categoria_fornecida || '',
    observacoes: row.observacoes || '',
    created: dateOnly(row.criado_em)
  };
}

async function handleFornecedores(req, res, pathname) {
  const prefix = '/api/fornecedores';
  if (!pathname.startsWith(prefix)) return false;
  const user = await requireUser(req, res);
  if (!user) return true;
  const target = idFromPath(prefix, pathname);

  if (req.method === 'GET' && target === null) {
    const { rows } = await query('SELECT * FROM fornecedor WHERE empresa_id = $1 ORDER BY nome', [user.empresa_id]);
    sendJson(res, 200, rows.map(mapFornecedor));
    return true;
  }

  if (req.method === 'POST' && target === null) {
    const body = await readBody(req);
    if (!String(body.nome || '').trim()) {
      sendJson(res, 400, { error: 'invalid_request', message: 'Informe o nome do fornecedor.' });
      return true;
    }
    const { rows } = await query(
      `INSERT INTO fornecedor (empresa_id, nome, documento, telefone, email, cidade, estado, categoria_fornecida, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        user.empresa_id, body.nome.trim(), body.documento || null, body.telefone || null, body.email || null,
        body.cidade || null, body.estado || null, body.categoria || null, body.observacoes || null
      ]
    );
    sendJson(res, 201, mapFornecedor(rows[0]));
    return true;
  }

  if (req.method === 'DELETE' && target && target.id) {
    await query('DELETE FROM fornecedor WHERE id = $1 AND empresa_id = $2', [target.id, user.empresa_id]);
    sendJson(res, 200, { ok: true });
    return true;
  }

  return false;
}

// ---------- produtos ----------

function mapProduto(row) {
  return {
    id: row.id,
    code: row.codigo || '',
    barcode: row.codigo_barras || '',
    name: row.nome,
    category: row.categoria || '',
    supplier: row.fornecedor_nome || '',
    quantity: row.quantidade,
    minimum: row.quantidade_minima,
    costPrice: Number(row.preco_custo),
    salePrice: Number(row.preco_venda)
  };
}

async function handleProdutos(req, res, pathname) {
  const prefix = '/api/produtos';
  if (!pathname.startsWith(prefix)) return false;
  const user = await requireUser(req, res);
  if (!user) return true;
  const target = idFromPath(prefix, pathname);

  if (req.method === 'GET' && target === null) {
    const { rows } = await query(
      `SELECT p.*, f.nome AS fornecedor_nome
         FROM produto p
         LEFT JOIN fornecedor f ON f.id = p.fornecedor_id
        WHERE p.empresa_id = $1
        ORDER BY p.nome`,
      [user.empresa_id]
    );
    sendJson(res, 200, rows.map(mapProduto));
    return true;
  }

  if (req.method === 'POST' && target === null) {
    const body = await readBody(req);
    if (!String(body.name || '').trim()) {
      sendJson(res, 400, { error: 'invalid_request', message: 'Informe o nome do produto.' });
      return true;
    }

    const quantity = Number(body.quantity) || 0;
    const product = await withTransaction(async client => {
      const fornecedorId = body.supplier ? await findOrCreateFornecedor(body.supplier, user.empresa_id) : null;
      const { rows } = await client.query(
        `INSERT INTO produto (empresa_id, fornecedor_id, codigo, codigo_barras, nome, categoria, quantidade, quantidade_minima, preco_custo, preco_venda)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [
          user.empresa_id, fornecedorId, body.code || null, body.barcode || null, body.name.trim(),
          body.category || null, quantity, Number(body.minimum) || 0, Number(body.costPrice) || 0, Number(body.salePrice) || 0
        ]
      );
      const created = rows[0];
      if (quantity > 0) {
        await client.query(
          `INSERT INTO movimentacao_estoque (empresa_id, produto_id, produto_nome, tipo, quantidade, observacao)
           VALUES ($1, $2, $3, 'entrada', $4, 'Cadastro inicial')`,
          [user.empresa_id, created.id, created.nome, quantity]
        );
      }
      return created;
    });

    sendJson(res, 201, mapProduto({ ...product, fornecedor_nome: body.supplier || null }));
    return true;
  }

  if (req.method === 'DELETE' && target && target.id) {
    await query('DELETE FROM produto WHERE id = $1 AND empresa_id = $2', [target.id, user.empresa_id]);
    sendJson(res, 200, { ok: true });
    return true;
  }

  return false;
}

// ---------- movimentacoes de estoque ----------

function mapMovimentacao(row) {
  return {
    id: row.id,
    date: dateOnly(row.data_movimentacao),
    productName: row.produto_nome,
    movement: row.tipo,
    quantity: row.quantidade,
    note: row.observacao || ''
  };
}

async function handleMovimentacoes(req, res, pathname) {
  const prefix = '/api/movimentacoes-estoque';
  if (!pathname.startsWith(prefix)) return false;
  const user = await requireUser(req, res);
  if (!user) return true;

  if (req.method === 'GET' && pathname === prefix) {
    const { rows } = await query(
      `SELECT * FROM movimentacao_estoque
        WHERE empresa_id = $1
        ORDER BY data_movimentacao DESC, id DESC`,
      [user.empresa_id]
    );
    sendJson(res, 200, rows.map(mapMovimentacao));
    return true;
  }

  if (req.method === 'POST' && pathname === prefix) {
    const body = await readBody(req);
    const productId = Number(body.productId);
    const quantity = Number(body.quantity);
    const movement = body.movement === 'saida' ? 'saida' : 'entrada';

    if (!productId || !quantity || quantity <= 0) {
      sendJson(res, 400, { error: 'invalid_request', message: 'Informe produto e quantidade validos.' });
      return true;
    }

    try {
      const result = await withTransaction(async client => {
        const { rows } = await client.query(
          'SELECT * FROM produto WHERE id = $1 AND empresa_id = $2 FOR UPDATE',
          [productId, user.empresa_id]
        );
        const product = rows[0];
        if (!product) {
          const notFound = new Error('Produto nao encontrado.');
          notFound.code = 'not_found';
          throw notFound;
        }
        if (movement === 'saida' && product.quantidade < quantity) {
          const insufficient = new Error('Quantidade insuficiente em estoque.');
          insufficient.code = 'insufficient_stock';
          throw insufficient;
        }

        const newQuantity = movement === 'entrada' ? product.quantidade + quantity : product.quantidade - quantity;
        await client.query('UPDATE produto SET quantidade = $1 WHERE id = $2', [newQuantity, productId]);

        const inserted = await client.query(
          `INSERT INTO movimentacao_estoque (empresa_id, produto_id, produto_nome, tipo, quantidade, observacao)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [user.empresa_id, productId, product.nome, movement, quantity, body.note || null]
        );
        return inserted.rows[0];
      });
      sendJson(res, 201, mapMovimentacao(result));
    } catch (error) {
      if (error.code === 'not_found') sendJson(res, 404, { error: 'not_found', message: error.message });
      else if (error.code === 'insufficient_stock') sendJson(res, 400, { error: 'insufficient_stock', message: error.message });
      else throw error;
    }
    return true;
  }

  return false;
}

// ---------- transacoes (movimentacoes financeiras) ----------

function mapTransacao(row) {
  return {
    id: row.id,
    data: dateOnly(row.data_transacao),
    descricao: row.descricao,
    categoria: row.categoria_nome || '',
    tipo: row.tipo,
    valor: Number(row.valor),
    cliente: row.cliente_nome || ''
  };
}

async function handleTransacoes(req, res, pathname) {
  const prefix = '/api/transacoes';
  if (!pathname.startsWith(prefix)) return false;
  const user = await requireUser(req, res);
  if (!user) return true;
  const target = idFromPath(prefix, pathname);

  if (req.method === 'GET' && target === null) {
    const { rows } = await query(
      `SELECT t.*, c.nome AS categoria_nome, cl.nome AS cliente_nome
         FROM transacao t
         LEFT JOIN categoria c ON c.id = t.categoria_id
         LEFT JOIN cliente cl ON cl.id = t.cliente_id
        WHERE t.empresa_id = $1
        ORDER BY t.data_transacao DESC, t.id DESC`,
      [user.empresa_id]
    );
    sendJson(res, 200, rows.map(mapTransacao));
    return true;
  }

  if (req.method === 'POST' && target === null) {
    const body = await readBody(req);
    const tipo = body.tipo === 'saida' ? 'saida' : 'entrada';
    const valor = Number(body.valor);
    if (!String(body.descricao || '').trim() || !(valor > 0)) {
      sendJson(res, 400, { error: 'invalid_request', message: 'Informe descricao e valor validos.' });
      return true;
    }

    const categoriaId = body.categoria
      ? await findOrCreateCategoria(body.categoria, tipo === 'entrada' ? 'receita' : 'despesa', user.empresa_id)
      : null;
    const clienteId = body.cliente ? await findOrCreateCliente(body.cliente, user.empresa_id) : null;

    const { rows } = await query(
      `INSERT INTO transacao (empresa_id, categoria_id, cliente_id, tipo, descricao, valor, data_transacao)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, CURRENT_DATE)) RETURNING *`,
      [user.empresa_id, categoriaId, clienteId, tipo, body.descricao.trim(), valor, body.data || null]
    );
    sendJson(res, 201, mapTransacao({ ...rows[0], categoria_nome: body.categoria || '', cliente_nome: body.cliente || '' }));
    return true;
  }

  if (req.method === 'DELETE' && target && target.id) {
    await query('DELETE FROM transacao WHERE id = $1 AND empresa_id = $2', [target.id, user.empresa_id]);
    sendJson(res, 200, { ok: true });
    return true;
  }

  return false;
}

// ---------- contas a pagar/receber ----------

function mapConta(row) {
  return {
    id: row.id,
    tipo: row.tipo,
    descricao: row.descricao,
    valor: Number(row.valor),
    vencimento: dateOnly(row.vencimento),
    status: row.status
  };
}

async function handleContas(req, res, pathname) {
  const prefix = '/api/contas';
  if (!pathname.startsWith(prefix)) return false;
  const user = await requireUser(req, res);
  if (!user) return true;
  const target = idFromPath(prefix, pathname);

  if (req.method === 'GET' && target === null) {
    const { rows } = await query('SELECT * FROM conta WHERE empresa_id = $1 ORDER BY vencimento', [user.empresa_id]);
    sendJson(res, 200, rows.map(mapConta));
    return true;
  }

  if (req.method === 'POST' && target === null) {
    const body = await readBody(req);
    const tipo = body.tipo === 'pagar' ? 'pagar' : 'receber';
    const valor = Number(body.valor);
    if (!String(body.descricao || '').trim() || !(valor > 0) || !body.vencimento) {
      sendJson(res, 400, { error: 'invalid_request', message: 'Informe descricao, valor e vencimento validos.' });
      return true;
    }
    const { rows } = await query(
      `INSERT INTO conta (empresa_id, tipo, descricao, valor, vencimento)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [user.empresa_id, tipo, body.descricao.trim(), valor, body.vencimento]
    );
    sendJson(res, 201, mapConta(rows[0]));
    return true;
  }

  if (req.method === 'POST' && target && target.id && target.action === 'status') {
    const { rows } = await query(
      `UPDATE conta SET
         status = CASE WHEN status = 'pago' THEN 'pendente' ELSE 'pago' END::status_conta,
         pago_em = CASE WHEN status = 'pago' THEN NULL ELSE now() END
       WHERE id = $1 AND empresa_id = $2
       RETURNING *`,
      [target.id, user.empresa_id]
    );
    if (!rows[0]) {
      sendJson(res, 404, { error: 'not_found', message: 'Conta nao encontrada.' });
      return true;
    }
    sendJson(res, 200, mapConta(rows[0]));
    return true;
  }

  if (req.method === 'DELETE' && target && target.id) {
    await query('DELETE FROM conta WHERE id = $1 AND empresa_id = $2', [target.id, user.empresa_id]);
    sendJson(res, 200, { ok: true });
    return true;
  }

  return false;
}

// ---------- servicos prestados ----------

function mapServico(row) {
  return {
    id: row.id,
    client: row.cliente_nome || '',
    description: row.descricao,
    valor: Number(row.valor),
    date: dateOnly(row.data_servico)
  };
}

async function handleServicos(req, res, pathname) {
  const prefix = '/api/servicos';
  if (!pathname.startsWith(prefix)) return false;
  const user = await requireUser(req, res);
  if (!user) return true;
  const target = idFromPath(prefix, pathname);

  if (req.method === 'GET' && target === null) {
    const { rows } = await query(
      `SELECT s.*, cl.nome AS cliente_nome
         FROM servico s
         LEFT JOIN cliente cl ON cl.id = s.cliente_id
        WHERE s.empresa_id = $1
        ORDER BY s.data_servico DESC, s.id DESC`,
      [user.empresa_id]
    );
    sendJson(res, 200, rows.map(mapServico));
    return true;
  }

  if (req.method === 'POST' && target === null) {
    const body = await readBody(req);
    const valor = Number(body.valor);
    if (!String(body.description || '').trim() || !(valor > 0)) {
      sendJson(res, 400, { error: 'invalid_request', message: 'Informe a descricao do servico e um valor valido.' });
      return true;
    }
    const clienteId = body.client ? await findOrCreateCliente(body.client, user.empresa_id) : null;
    const { rows } = await query(
      `INSERT INTO servico (empresa_id, cliente_id, descricao, valor, data_servico)
       VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_DATE)) RETURNING *`,
      [user.empresa_id, clienteId, body.description.trim(), valor, body.date || null]
    );
    sendJson(res, 201, mapServico({ ...rows[0], cliente_nome: body.client || '' }));
    return true;
  }

  if (req.method === 'DELETE' && target && target.id) {
    await query('DELETE FROM servico WHERE id = $1 AND empresa_id = $2', [target.id, user.empresa_id]);
    sendJson(res, 200, { ok: true });
    return true;
  }

  return false;
}

// ---------- agenda / eventos ----------

function mapEvento(row) {
  return {
    id: row.id,
    title: row.titulo,
    type: row.tipo,
    date: dateOnly(row.data_evento),
    time: timeOnly(row.horario),
    description: row.descricao || ''
  };
}

const EVENT_TYPES = ['entrega', 'compra', 'fornecedor', 'reuniao', 'compromisso', 'feriado', 'importante'];

async function handleEventos(req, res, pathname) {
  const prefix = '/api/eventos';
  if (!pathname.startsWith(prefix)) return false;
  const user = await requireUser(req, res);
  if (!user) return true;
  const target = idFromPath(prefix, pathname);

  if (req.method === 'GET' && target === null) {
    const { rows } = await query('SELECT * FROM evento_agenda WHERE empresa_id = $1 ORDER BY data_evento', [user.empresa_id]);
    sendJson(res, 200, rows.map(mapEvento));
    return true;
  }

  if (req.method === 'POST' && target === null) {
    const body = await readBody(req);
    if (!String(body.title || '').trim() || !body.date) {
      sendJson(res, 400, { error: 'invalid_request', message: 'Informe titulo e data do evento.' });
      return true;
    }
    const tipo = EVENT_TYPES.includes(body.type) ? body.type : 'compromisso';
    const { rows } = await query(
      `INSERT INTO evento_agenda (empresa_id, titulo, tipo, data_evento, horario, descricao)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [user.empresa_id, body.title.trim(), tipo, body.date, body.time || null, body.description || null]
    );
    sendJson(res, 201, mapEvento(rows[0]));
    return true;
  }

  if (req.method === 'DELETE' && target && target.id) {
    await query('DELETE FROM evento_agenda WHERE id = $1 AND empresa_id = $2', [target.id, user.empresa_id]);
    sendJson(res, 200, { ok: true });
    return true;
  }

  return false;
}

async function handleDataRoutes(req, res, pathname) {
  if (await handleClientes(req, res, pathname)) return true;
  if (await handleFornecedores(req, res, pathname)) return true;
  if (await handleProdutos(req, res, pathname)) return true;
  if (await handleMovimentacoes(req, res, pathname)) return true;
  if (await handleTransacoes(req, res, pathname)) return true;
  if (await handleContas(req, res, pathname)) return true;
  if (await handleServicos(req, res, pathname)) return true;
  if (await handleEventos(req, res, pathname)) return true;
  return false;
}

module.exports = { handleDataRoutes };
