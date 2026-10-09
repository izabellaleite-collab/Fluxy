const TRANSACTIONS_PAGE_SIZE = 100;
let transactionsShown = TRANSACTIONS_PAGE_SIZE;

function removeButton(kind, id) {
  return `<button class="table-action" data-action="remove" data-kind="${kind}" data-id="${Number(id)}" aria-label="Remover" title="Remover"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>`;
}

function renderTransactions() {
  const query = ($('#transaction-search')?.value || '').toLowerCase();
  const filter = $('#transaction-filter')?.value || 'all';

  const rows = state.transactions
    .filter(t => (filter === 'all' || t.tipo === filter) &&
      `${t.descricao} ${t.categoria || ''}`.toLowerCase().includes(query))
    .sort((a, b) => String(b.data).localeCompare(String(a.data)) || b.id - a.id);

  const visible = rows.slice(0, transactionsShown);
  const emptyMessage = state.transactions.length
    ? 'Nenhuma movimentação encontrada com esse filtro.'
    : 'Nenhuma movimentação cadastrada.';

  $('#transactions-table').innerHTML = visible.length
    ? visible.map(t => `
      <tr>
        <td>${date(t.data)}</td>
        <td><strong>${esc(t.descricao)}</strong></td>
        <td>${esc(t.categoria || 'Geral')}</td>
        <td><span class="type-pill ${t.tipo === 'entrada' ? 'in' : 'out'}">${t.tipo === 'entrada' ? 'Entrada' : 'Saída'}</span></td>
        <td><strong class="${t.tipo === 'entrada' ? 'positive' : 'negative'}">${t.tipo === 'entrada' ? '+' : '-'} ${money(t.valor)}</strong></td>
        <td>${removeButton('transaction', t.id)}</td>
      </tr>
    `).join('')
    : `<tr><td colspan="6" class="muted">${emptyMessage}</td></tr>`;

  const remaining = rows.length - visible.length;
  const moreButton = $('#transactions-more');
  moreButton.classList.toggle('hidden', remaining <= 0);
  moreButton.textContent = `Mostrar mais (${remaining} restantes)`;
}

function showMoreTransactions() {
  transactionsShown += TRANSACTIONS_PAGE_SIZE;
  renderTransactions();
}

function resetTransactionsPage() {
  transactionsShown = TRANSACTIONS_PAGE_SIZE;
  renderTransactions();
}

function renderAccounts() {
  const accounts = [...state.accounts].sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)));

  $('#accounts-grid').innerHTML = accounts.length
    ? accounts.map(account => `
      <article class="account-card">
        <div class="account-top">
          <span class="type-pill ${account.tipo === 'pagar' ? 'out' : 'in'}">${account.tipo === 'pagar' ? 'A pagar' : 'A receber'}</span>
          ${removeButton('account', account.id)}
        </div>
        <h3>${esc(account.descricao)}</h3>
        <strong>${money(account.valor)}</strong>
        <div class="account-footer">
          <small><i class="fa-regular fa-calendar"></i> ${date(account.vencimento)}</small>
          <span class="status-pill ${account.status === 'pago' ? 'paid' : 'pending'}">${account.status === 'pago' ? 'Pago' : 'Pendente'}</span>
        </div>
        <button class="text-btn" data-action="toggle-account" data-id="${Number(account.id)}">${account.status === 'pago' ? 'Marcar pendente' : 'Marcar como pago'}</button>
      </article>
    `).join('')
    : '<p class="muted">Nenhuma conta cadastrada.</p>';
}
