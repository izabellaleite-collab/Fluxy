function supplierOptionsHtml() {
  return state.suppliers.map(supplier => `<option value="${esc(supplier.nome)}"></option>`).join('');
}

function productOptionsHtml() {
  return state.products
    .map(product => `<option value="${product.id}">${esc(product.name)} (${product.quantity})</option>`)
    .join('');
}

const MODAL_FORMS = {
  transaction: (type) => ({
    title: 'Nova movimentação',
    html: `
      <label>Tipo
        <select name="tipo">
          <option value="${type || 'entrada'}">Entrada</option>
          <option value="saida">Saída</option>
        </select>
      </label>
      <label>Descrição<input name="descricao" required placeholder="Ex.: Venda de produtos"></label>
      <label>Valor<input name="valor" type="number" step="0.01" min="0" required></label>
      <label>Data<input name="data" type="date" value="${todayISO()}" required></label>
      <label>Categoria<input name="categoria" placeholder="Ex.: Vendas"></label>
      <label>Cliente (opcional)<input name="cliente"></label>
    `
  }),

  account: () => ({
    title: 'Agendar conta',
    html: `
      <label>Tipo
        <select name="tipo">
          <option value="pagar">Conta a pagar</option>
          <option value="receber">Conta a receber</option>
        </select>
      </label>
      <label>Descrição<input name="descricao" required></label>
      <label>Valor<input name="valor" type="number" step="0.01" required></label>
      <label>Vencimento<input name="vencimento" type="date" value="${todayISO()}" required></label>
    `
  }),

  supplier: () => ({
    title: 'Novo fornecedor',
    html: `
      <label>Nome / razao social<input name="nome" required placeholder="Ex.: Distribuidora Sao Paulo"></label>
      <div class="form-grid">
        <label>CNPJ / CPF<input name="documento"></label>
        <label>Telefone<input name="telefone"></label>
      </div>
      <label>E-mail<input name="email" type="email"></label>
      <div class="form-grid">
        <label>Cidade<input name="cidade"></label>
        <label>Estado<input name="estado" maxlength="2"></label>
      </div>
      <label>Produtos / categoria fornecida<input name="categoria" placeholder="Ex.: Embalagens"></label>
      <label>Observacoes<textarea name="observacoes"></textarea></label>
    `
  }),

  client: () => ({
    title: 'Novo cliente',
    html: `
      <label>Nome completo<input name="nome" required></label>
      <label>E-mail<input name="email" type="email"></label>
      <label>Telefone<input name="telefone"></label>
      <label>Observações<textarea name="observacoes"></textarea></label>
    `
  }),

  service: () => ({
    title: 'Registrar serviço',
    html: `
      <label>Cliente<input name="client"></label>
      <label>Serviço realizado<input name="description" required></label>
      <label>Valor<input name="valor" type="number" step="0.01" required></label>
      <label>Data<input name="date" type="date" value="${todayISO()}" required></label>
    `
  }),

  product: () => ({
    title: 'Novo produto',
    html: `
      <div class="form-grid">
        <label>Código do produto<input name="code" required></label>
        <label>Código de barras<input name="barcode"></label>
      </div>
      <label>Nome<input name="name" required></label>
      <div class="form-grid">
        <label>Categoria<input name="category"></label>
        <label>Fornecedor
          <input name="supplier" list="supplier-options">
          <datalist id="supplier-options">${supplierOptionsHtml()}</datalist>
        </label>
      </div>
      <div class="form-grid">
        <label>Quantidade<input name="quantity" type="number" min="0" value="0" required></label>
        <label>Quantidade mínima<input name="minimum" type="number" min="0" value="0" required></label>
        <label>Preço de custo<input name="costPrice" type="number" step="0.01" value="0" required></label>
        <label>Preço de venda<input name="salePrice" type="number" step="0.01" value="0" required></label>
      </div>
    `
  }),

  'stock-move': () => ({
    title: 'Movimentação de estoque',
    html: `
      <label>Produto
        <select name="productId" required>${productOptionsHtml()}</select>
      </label>
      <label>Tipo
        <select name="movement">
          <option value="entrada">Entrada</option>
          <option value="saida">Saída</option>
        </select>
      </label>
      <label>Quantidade<input name="quantity" type="number" min="1" required></label>
      <label>Observação<input name="note"></label>
    `
  }),

  event: () => ({
    title: 'Novo evento no calendário',
    html: `
      <label>Título<input name="title" required placeholder="Ex.: Entrega para cliente"></label>
      <label>Tipo
        <select name="type">
          <option value="entrega">Entrega</option>
          <option value="compra">Compra</option>
          <option value="fornecedor">Fornecedor</option>
          <option value="reuniao">Reunião</option>
          <option value="compromisso">Compromisso</option>
          <option value="feriado">Feriado</option>
          <option value="importante">Data importante</option>
        </select>
      </label>
      <label>Data<input name="date" type="date" value="${todayISO()}" required></label>
      <label>Horário<input name="time" type="time"></label>
      <label>Descrição<input name="description"></label>
    `
  }),

  password: () => ({
    title: 'Alterar senha',
    html: `
      <label>Senha atual<input name="current" type="password" required></label>
      <label>Nova senha<input name="password" type="password" minlength="6" required></label>
      <label>Confirmar nova senha<input name="confirm" type="password" minlength="6" required></label>
    `
  })
};

function hasApi() {
  return Boolean(window.FLUXY_API) && !FLUXY_API.isFile && Boolean(FLUXY_API.baseUrl);
}

function isOfflineError(error) {
  return error?.code === 'API_UNAVAILABLE' || String(error?.code || '').startsWith('API_5');
}

// Tenta salvar no banco (via API); se a API estiver fora do ar, cai para o
// mesmo comportamento local de sempre (o Fluxy continua funcionando offline).
const SAVE_ENDPOINTS = {
  client: '/api/clientes',
  supplier: '/api/fornecedores',
  transaction: '/api/transacoes',
  account: '/api/contas',
  service: '/api/servicos',
  event: '/api/eventos'
};

async function saveModalRecord(kind, data) {
  if (kind === 'product') {
    const quantity = Number(data.quantity);
    if (hasApi()) {
      try {
        const created = await FLUXY_API.request('/api/produtos', { method: 'POST', body: JSON.stringify(data) });
        state.products.push(created);
        await FLUXY_SYNC.refreshStock();
        return true;
      } catch (error) {
        if (!isOfflineError(error)) {
          toast(error.data?.message || 'Não foi possível salvar o produto.');
          return false;
        }
      }
    }
    state.products.push({
      ...data, id: uid(), quantity, minimum: Number(data.minimum),
      costPrice: Number(data.costPrice), salePrice: Number(data.salePrice)
    });
    state.stockHistory.push({ id: uid(), date: todayISO(), productName: data.name, movement: 'entrada', quantity, note: 'Cadastro inicial' });
    return true;
  }

  if (kind === 'stock-move') {
    const product = state.products.find(p => String(p.id) === String(data.productId));
    const quantity = Number(data.quantity);
    if (!product) return true;

    if (hasApi()) {
      try {
        await FLUXY_API.request('/api/movimentacoes-estoque', { method: 'POST', body: JSON.stringify(data) });
        product.quantity += data.movement === 'entrada' ? quantity : -quantity;
        await FLUXY_SYNC.refreshStock();
        return true;
      } catch (error) {
        if (error.data?.error === 'insufficient_stock') {
          toast(error.data.message);
          return false;
        }
        if (!isOfflineError(error)) {
          toast(error.data?.message || 'Não foi possível registrar a movimentação.');
          return false;
        }
      }
    }

    if (data.movement === 'saida' && product.quantity < quantity) {
      toast('Quantidade insuficiente em estoque.');
      return false;
    }
    product.quantity += data.movement === 'entrada' ? quantity : -quantity;
    state.stockHistory.push({ id: uid(), date: todayISO(), productName: product.name, movement: data.movement, quantity, note: data.note });
    return true;
  }

  if (kind === 'password') {
    if (data.password !== data.confirm) {
      toast('As senhas não conferem.');
      return false;
    }
    toast('Senha alterada com sucesso.');
    return true;
  }

  const endpoint = SAVE_ENDPOINTS[kind];
  if (endpoint && hasApi()) {
    try {
      const created = await FLUXY_API.request(endpoint, { method: 'POST', body: JSON.stringify(data) });
      state[REMOVABLE_COLLECTIONS[kind]].push(created);
      return true;
    } catch (error) {
      if (!isOfflineError(error)) {
        toast(error.data?.message || 'Não foi possível salvar o registro.');
        return false;
      }
    }
  }

  if (kind === 'transaction') state.transactions.push({ ...data, id: uid(), valor: Number(data.valor) });
  if (kind === 'account') state.accounts.push({ ...data, id: uid(), valor: Number(data.valor), status: 'pendente' });
  if (kind === 'supplier') state.suppliers.push({ ...data, id: uid(), created: todayISO() });
  if (kind === 'client') state.clients.push({ ...data, id: uid(), created: todayISO() });
  if (kind === 'service') state.services.push({ ...data, id: uid(), valor: Number(data.valor) });
  if (kind === 'event') state.events.push({ ...data, id: uid() });

  return true;
}

function openModal(kind, type) {
  const buildForm = MODAL_FORMS[kind];
  if (!buildForm) return;

  const form = buildForm(type);
  $('#modal-title').textContent = form.title;
  $('#modal-form').innerHTML = form.html +
    '<div class="modal-actions">' +
    '<button type="button" class="btn secondary" id="cancel-modal">Cancelar</button>' +
    '<button class="btn primary">Salvar</button>' +
    '</div>';
  $('#modal').classList.remove('hidden');

  $('#modal-form').onsubmit = async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    const saved = await saveModalRecord(kind, data);
    if (saved === false) return;
    persist();
    closeModal();
    renderAll();
    toast('Registro salvo com sucesso.');
  };

  $('#cancel-modal').onclick = closeModal;
}

function closeModal() {
  $('#modal').classList.add('hidden');
}

async function payAccount(id) {
  const account = state.accounts.find(a => a.id === id);
  if (!account) return;

  if (hasApi()) {
    try {
      const updated = await FLUXY_API.request(`/api/contas/${id}/status`, { method: 'POST' });
      Object.assign(account, updated);
      persist();
      renderAll();
      toast('Status da conta atualizado.');
      return;
    } catch (error) {
      if (!isOfflineError(error)) {
        toast('Não foi possível atualizar a conta.');
        return;
      }
    }
  }

  account.status = account.status === 'pago' ? 'pendente' : 'pago';
  persist();
  renderAll();
  toast('Status da conta atualizado.');
}

const REMOVABLE_COLLECTIONS = {
  transaction: 'transactions',
  account: 'accounts',
  client: 'clients',
  service: 'services',
  event: 'events',
  supplier: 'suppliers'
};

const DELETE_ENDPOINTS = {
  transaction: '/api/transacoes',
  account: '/api/contas',
  client: '/api/clientes',
  service: '/api/servicos',
  event: '/api/eventos',
  supplier: '/api/fornecedores',
  product: '/api/produtos'
};

async function removeItem(type, id) {
  if (!confirm(type === 'product' ? 'Remover este produto?' : 'Remover este registro?')) return;

  if (hasApi()) {
    try {
      await FLUXY_API.request(`${DELETE_ENDPOINTS[type]}/${id}`, { method: 'DELETE' });
    } catch (error) {
      if (!isOfflineError(error)) {
        toast('Não foi possível remover. Tente novamente.');
        return;
      }
    }
  }

  if (type === 'product') {
    state.products = state.products.filter(product => product.id !== id);
  } else {
    const collectionKey = REMOVABLE_COLLECTIONS[type];
    state[collectionKey] = state[collectionKey].filter(item => item.id !== id);
  }
  persist();
  renderAll();
  toast(type === 'product' ? 'Produto removido.' : 'Registro removido.');
}
