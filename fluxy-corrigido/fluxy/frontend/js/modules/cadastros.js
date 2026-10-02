function renderClients() {
  const totalsByClient = state.transactions.reduce((totals, t) => {
    const clientName = t.cliente || '';
    totals[clientName] = (totals[clientName] || 0) + (t.tipo === 'entrada' ? t.valor : 0);
    return totals;
  }, {});

  $('#clients-table').innerHTML = state.clients.length
    ? state.clients.map(client => `
      <tr>
        <td><strong>${esc(client.nome)}</strong></td>
        <td>${esc(client.email || '')}<br><small class="muted">${esc(client.telefone || '')}</small></td>
        <td>${date(client.created || todayISO())}</td>
        <td>${money(totalsByClient[client.nome] || 0)}</td>
        <td><button class="table-action" onclick="removeItem('client',${client.id})"><i class="fa-solid fa-trash"></i></button></td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" class="muted">Nenhum cliente cadastrado.</td></tr>';
}

function renderStock() {
  const lowStockProducts = state.products.filter(p => Number(p.quantity) <= Number(p.minimum || 0));

  $('#stock-total').textContent = state.products.length;
  $('#stock-low').textContent = lowStockProducts.length;

  $('#products-table').innerHTML = state.products.length
    ? state.products.map(product => `
      <tr>
        <td>${esc(product.code || '—')}</td>
        <td><strong>${esc(product.name)}</strong><br><small class="muted">${esc(product.barcode || '')}</small></td>
        <td>${esc(product.category || 'Geral')}</td>
        <td>
          <strong class="${Number(product.quantity) <= Number(product.minimum || 0) ? 'negative' : ''}">${product.quantity}</strong>
          <br><small class="muted">mín. ${product.minimum || 0}</small>
        </td>
        <td>${money(product.salePrice)}</td>
        <td>${esc(product.supplier || '—')}</td>
        <td><button class="table-action" onclick="removeItem('product',${product.id})"><i class="fa-solid fa-trash"></i></button></td>
      </tr>
    `).join('')
    : '<tr><td colspan="7" class="muted">Nenhum produto cadastrado.</td></tr>';

  $('#stock-history-table').innerHTML = state.stockHistory.slice().reverse().map(entry => `
    <tr>
      <td>${date(entry.date)}</td>
      <td>${esc(entry.productName)}</td>
      <td><span class="type-pill ${entry.movement === 'entrada' ? 'in' : 'out'}">${entry.movement}</span></td>
      <td>${entry.quantity}</td>
      <td>${esc(entry.note || '')}</td>
    </tr>
  `).join('') || '<tr><td colspan="5" class="muted">Nenhuma movimentação.</td></tr>';
}

function renderServices() {
  const services = state.services;

  $('#services-table').innerHTML = services.length
    ? services.map(service => `
      <tr>
        <td>${date(service.date)}</td>
        <td>${esc(service.client || '—')}</td>
        <td><strong>${esc(service.description)}</strong></td>
        <td>${money(service.valor)}</td>
        <td><span class="status-pill paid">Concluído</span></td>
        <td><button class="table-action" onclick="removeItem('service',${service.id})"><i class="fa-solid fa-trash"></i></button></td>
      </tr>
    `).join('')
    : '<tr><td colspan="6" class="muted">Nenhum serviço cadastrado.</td></tr>';
}

function renderSuppliers() {
  const box = $('#suppliers-list');
  if (!box) return;

  box.innerHTML = state.suppliers.length
    ? state.suppliers.map(supplier => `
      <div class="supplier-row">
        <span class="list-icon"><i class="fa-solid fa-truck-field"></i></span>
        <div>
          <b>${esc(supplier.nome)}</b>
          <small>
            ${esc(supplier.categoria || 'Sem categoria')}
            ${supplier.cidade ? ' &middot; ' + esc(supplier.cidade) : ''}
            ${supplier.estado ? '/' + esc(supplier.estado) : ''}
          </small>
          <small>${esc(supplier.telefone || '')}${supplier.telefone && supplier.email ? ' &middot; ' : ''}${esc(supplier.email || '')}</small>
        </div>
        <button class="table-action" onclick="removeItem('supplier',${supplier.id})"><i class="fa-solid fa-trash"></i></button>
      </div>
    `).join('')
    : '<p class="muted">Nenhum fornecedor cadastrado ainda. Clique em "Novo fornecedor" para comecar.</p>';
}
