const { query, withTransaction } = require('../lib/db');
const { HttpError, sendJson, readBody } = require('../lib/http-helpers');
const { requireUser } = require('../lib/auth-middleware');
const { findOrCreateCliente, findOrCreateFornecedor, findOrCreateCategoria } = require('../lib/lookups');
const {
  requiredText, optionalText, optionalEmail, money, integer, isoDate, time, stateCode, oneOf
} = require('../lib/validation');

function targetFromPath(prefix, pathname) {
  if (pathname === prefix) return null;
  const match = pathname.slice(prefix.length).match(/^\/(\d{1,15})(?:\/(\w+))?$/);
  return match ? { id: Number(match[1]), action: match[2] || null } : undefined;
}

const pad = number => String(number).padStart(2, '0');

const dateOnly = value => {
  if (!value) return '';
  if (value instanceof Date) return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  return String(value).slice(0, 10);
};
const timeOnly = value => (value ? String(value).slice(0, 5) : '');

const notFound = message => new HttpError(404, 'not_found', message);

async function removeById(table, id, empresaId) {
  const { rowCount } = await query(`DELETE FROM ${table} WHERE id = $1 AND empresa_id = $2`, [id, empresaId]);
  if (!rowCount) throw notFound('Registro não encontrado.');
}

function resourceRoutes({ prefix, table, list, create, extra }) {
  return async function handle(req, res, pathname) {
    if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) return false;
    const target = targetFromPath(prefix, pathname);
    if (target === undefined) return false;

    const user = await requireUser(req);

    if (req.method === 'GET' && target === null) {
      sendJson(res, 200, await list(user.empresa_id));
      return true;
    }
    if (req.method === 'POST' && target === null) {
      sendJson(res, 201, await create(await readBody(req), user.empresa_id));
      return true;
    }
    if (extra && target) {
      const result = await extra(req, target, user);
      if (result !== undefined) {
        sendJson(res, 200, result);
        return true;
      }
    }
    if (req.method === 'DELETE' && target && !target.action && table) {
      await removeById(table, target.id, user.empresa_id);
      sendJson(res, 200, { ok: true });
      return true;
    }
    return false;
  };
}

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

async function listClientes(empresaId) {
  const { rows } = await query('SELECT * FROM cliente WHERE empresa_id = $1 ORDER BY nome', [empresaId]);
  return rows.map(mapCliente);
}

async function createCliente(body, empresaId) {
  const { rows } = await query(
    `INSERT INTO cliente (empresa_id, nome, email, telefone, observacoes)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [
      empresaId,
      requiredText(body.nome, 'o nome do cliente', 150),
      optionalEmail(body.email),
      optionalText(body.telefone, 'o telefone', 20),
      optionalText(body.observacoes, 'as observações', 2000)
    ]
  );
  return mapCliente(rows[0]);
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

async function listFornecedores(empresaId) {
  const { rows } = await query('SELECT * FROM fornecedor WHERE empresa_id = $1 ORDER BY nome', [empresaId]);
  return rows.map(mapFornecedor);
}

async function createFornecedor(body, empresaId) {
  const { rows } = await query(
    `INSERT INTO fornecedor (empresa_id, nome, documento, telefone, email, cidade, estado, categoria_fornecida, observacoes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [
      empresaId,
      requiredText(body.nome, 'o nome do fornecedor', 150),
      optionalText(body.documento, 'o CNPJ/CPF', 18),
      optionalText(body.telefone, 'o telefone', 20),
      optionalEmail(body.email),
      optionalText(body.cidade, 'a cidade', 100),
      stateCode(body.estado),
      optionalText(body.categoria, 'a categoria', 100),
      optionalText(body.observacoes, 'as observações', 2000)
    ]
  );
  return mapFornecedor(rows[0]);
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

async function listProdutos(empresaId) {
  const { rows } = await query(
    `SELECT p.*, f.nome AS fornecedor_nome
       FROM produto p
       LEFT JOIN fornecedor f ON f.id = p.fornecedor_id
      WHERE p.empresa_id = $1
      ORDER BY p.nome`,
    [empresaId]
  );
  return rows.map(mapProduto);
}

async function createProduto(body, empresaId) {
  const name = requiredText(body.name, 'o nome do produto', 150);
  const code = optionalText(body.code, 'o código do produto', 50);
  const barcode = optionalText(body.barcode, 'o código de barras', 50);
  const category = optionalText(body.category, 'a categoria', 100);
  const supplier = optionalText(body.supplier, 'o fornecedor', 150);
  const quantity = integer(body.quantity, 'a quantidade', { fallback: 0 });
  const minimum = integer(body.minimum, 'a quantidade mínima', { fallback: 0 });
  const costPrice = money(body.costPrice || 0, 'o preço de custo', { allowZero: true });
  const salePrice = money(body.salePrice || 0, 'o preço de venda', { allowZero: true });

  const product = await withTransaction(async db => {
    if (code) {
      const duplicate = await db.query('SELECT 1 FROM produto WHERE empresa_id = $1 AND codigo = $2', [empresaId, code]);
      if (duplicate.rows.length) throw new HttpError(409, 'duplicate_code', 'Já existe um produto com este código.');
    }

    const fornecedorId = await findOrCreateFornecedor(supplier, empresaId, db);
    const { rows } = await db.query(
      `INSERT INTO produto (empresa_id, fornecedor_id, codigo, codigo_barras, nome, categoria, quantidade, quantidade_minima, preco_custo, preco_venda)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [empresaId, fornecedorId, code, barcode, name, category, quantity, minimum, costPrice, salePrice]
    );
    const created = rows[0];
    if (quantity > 0) {
      await db.query(
        `INSERT INTO movimentacao_estoque (empresa_id, produto_id, produto_nome, tipo, quantidade, observacao)
         VALUES ($1, $2, $3, 'entrada', $4, 'Cadastro inicial')`,
        [empresaId, created.id, created.nome, quantity]
      );
    }
    return created;
  });

  return mapProduto({ ...product, fornecedor_nome: supplier });
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

async function listMovimentacoes(empresaId) {
  const { rows } = await query(
    `SELECT * FROM movimentacao_estoque
      WHERE empresa_id = $1
      ORDER BY data_movimentacao DESC, id DESC`,
    [empresaId]
  );
  return rows.map(mapMovimentacao);
}

async function createMovimentacao(body, empresaId) {
  const productId = integer(body.productId, 'o produto', { min: 1 });
  const quantity = integer(body.quantity, 'a quantidade', { min: 1 });
  const movement = oneOf(body.movement, ['entrada', 'saida'], 'entrada');
  const note = optionalText(body.note, 'a observação', 200);

  const created = await withTransaction(async db => {
    const { rows } = await db.query(
      'SELECT id, nome, quantidade FROM produto WHERE id = $1 AND empresa_id = $2 FOR UPDATE',
      [productId, empresaId]
    );
    const product = rows[0];
    if (!product) throw notFound('Produto não encontrado.');
    if (movement === 'saida' && product.quantidade < quantity) {
      throw new HttpError(400, 'insufficient_stock', 'Quantidade insuficiente em estoque.');
    }

    const newQuantity = movement === 'entrada' ? product.quantidade + quantity : product.quantidade - quantity;
    await db.query('UPDATE produto SET quantidade = $1 WHERE id = $2', [newQuantity, productId]);

    const inserted = await db.query(
      `INSERT INTO movimentacao_estoque (empresa_id, produto_id, produto_nome, tipo, quantidade, observacao)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [empresaId, productId, product.nome, movement, quantity, note]
    );
    return inserted.rows[0];
  });

  return mapMovimentacao(created);
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

async function listTransacoes(empresaId) {
  const { rows } = await query(
    `SELECT t.*, c.nome AS categoria_nome, cl.nome AS cliente_nome
       FROM transacao t
       LEFT JOIN categoria c ON c.id = t.categoria_id
       LEFT JOIN cliente cl ON cl.id = t.cliente_id
      WHERE t.empresa_id = $1
      ORDER BY t.data_transacao DESC, t.id DESC`,
    [empresaId]
  );
  return rows.map(mapTransacao);
}

async function createTransacao(body, empresaId) {
  const tipo = oneOf(body.tipo, ['entrada', 'saida'], 'entrada');
  const descricao = requiredText(body.descricao, 'a descrição', 200);
  const valor = money(body.valor, 'um valor');
  const data = isoDate(body.data, 'a data');
  const categoria = optionalText(body.categoria, 'a categoria', 80);
  const cliente = optionalText(body.cliente, 'o cliente', 150);

  const created = await withTransaction(async db => {
    const categoriaId = await findOrCreateCategoria(categoria, tipo === 'entrada' ? 'receita' : 'despesa', empresaId, db);
    const clienteId = await findOrCreateCliente(cliente, empresaId, db);
    const { rows } = await db.query(
      `INSERT INTO transacao (empresa_id, categoria_id, cliente_id, tipo, descricao, valor, data_transacao)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, CURRENT_DATE)) RETURNING *`,
      [empresaId, categoriaId, clienteId, tipo, descricao, valor, data]
    );
    return rows[0];
  });

  return mapTransacao({ ...created, categoria_nome: categoria, cliente_nome: cliente });
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

async function listContas(empresaId) {
  const { rows } = await query('SELECT * FROM conta WHERE empresa_id = $1 ORDER BY vencimento, id', [empresaId]);
  return rows.map(mapConta);
}

async function createConta(body, empresaId) {
  const { rows } = await query(
    `INSERT INTO conta (empresa_id, tipo, descricao, valor, vencimento)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [
      empresaId,
      oneOf(body.tipo, ['pagar', 'receber'], 'receber'),
      requiredText(body.descricao, 'a descrição', 200),
      money(body.valor, 'um valor'),
      isoDate(body.vencimento, 'a data de vencimento', { required: true })
    ]
  );
  return mapConta(rows[0]);
}

async function toggleContaStatus(req, target, user) {
  if (req.method !== 'POST' || target.action !== 'status') return undefined;

  const { rows } = await query(
    `UPDATE conta SET
       status = CASE WHEN status = 'pago' THEN 'pendente' ELSE 'pago' END::status_conta,
       pago_em = CASE WHEN status = 'pago' THEN NULL ELSE now() END
     WHERE id = $1 AND empresa_id = $2
     RETURNING *`,
    [target.id, user.empresa_id]
  );
  if (!rows[0]) throw notFound('Conta não encontrada.');
  return mapConta(rows[0]);
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

async function listServicos(empresaId) {
  const { rows } = await query(
    `SELECT s.*, cl.nome AS cliente_nome
       FROM servico s
       LEFT JOIN cliente cl ON cl.id = s.cliente_id
      WHERE s.empresa_id = $1
      ORDER BY s.data_servico DESC, s.id DESC`,
    [empresaId]
  );
  return rows.map(mapServico);
}

async function createServico(body, empresaId) {
  const description = requiredText(body.description, 'a descrição do serviço', 200);
  const valor = money(body.valor, 'um valor');
  const date = isoDate(body.date, 'a data');
  const client = optionalText(body.client, 'o cliente', 150);

  const created = await withTransaction(async db => {
    const clienteId = await findOrCreateCliente(client, empresaId, db);
    const { rows } = await db.query(
      `INSERT INTO servico (empresa_id, cliente_id, descricao, valor, data_servico)
       VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_DATE)) RETURNING *`,
      [empresaId, clienteId, description, valor, date]
    );
    return rows[0];
  });

  return mapServico({ ...created, cliente_nome: client });
}

// ---------- agenda / eventos ----------

const EVENT_TYPES = ['entrega', 'compra', 'fornecedor', 'reuniao', 'compromisso', 'feriado', 'importante'];

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

async function listEventos(empresaId) {
  const { rows } = await query(
    'SELECT * FROM evento_agenda WHERE empresa_id = $1 ORDER BY data_evento, horario NULLS FIRST, id',
    [empresaId]
  );
  return rows.map(mapEvento);
}

async function createEvento(body, empresaId) {
  const { rows } = await query(
    `INSERT INTO evento_agenda (empresa_id, titulo, tipo, data_evento, horario, descricao)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      empresaId,
      requiredText(body.title, 'o título do evento', 150),
      oneOf(body.type, EVENT_TYPES, 'compromisso'),
      isoDate(body.date, 'a data do evento', { required: true }),
      time(body.time, 'o horário'),
      optionalText(body.description, 'a descrição', 300)
    ]
  );
  return mapEvento(rows[0]);
}

// ---------- roteamento ----------

const ROUTES = [
  resourceRoutes({ prefix: '/api/clientes', table: 'cliente', list: listClientes, create: createCliente }),
  resourceRoutes({ prefix: '/api/fornecedores', table: 'fornecedor', list: listFornecedores, create: createFornecedor }),
  resourceRoutes({ prefix: '/api/produtos', table: 'produto', list: listProdutos, create: createProduto }),
  resourceRoutes({ prefix: '/api/movimentacoes-estoque', list: listMovimentacoes, create: createMovimentacao }),
  resourceRoutes({ prefix: '/api/transacoes', table: 'transacao', list: listTransacoes, create: createTransacao }),
  resourceRoutes({ prefix: '/api/contas', table: 'conta', list: listContas, create: createConta, extra: toggleContaStatus }),
  resourceRoutes({ prefix: '/api/servicos', table: 'servico', list: listServicos, create: createServico }),
  resourceRoutes({ prefix: '/api/eventos', table: 'evento_agenda', list: listEventos, create: createEvento })
];

async function handleDataRoutes(req, res, pathname) {
  for (const handle of ROUTES) {
    if (await handle(req, res, pathname)) return true;
  }
  return false;
}

module.exports = {
  handleDataRoutes,
  listClientes,
  listFornecedores,
  listProdutos,
  listMovimentacoes,
  listTransacoes,
  listContas,
  listServicos,
  listEventos
};
