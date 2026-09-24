function renderTransactions() {
  const query = ($('#transaction-search')?.value || '').toLowerCase();
  const filter = $('#transaction-filter')?.value || 'all';

  const rows = state.transactions
    .filter(t => (filter === 'all' || t.tipo === filter) &&
      `${t.descricao} ${t.categoria || ''}`.toLowerCase().includes(query))
    .sort((a, b) => b.data.localeCompare(a.data));

  $('#transactions-table').innerHTML = rows.length
    ? rows.map(t => `
      <tr>
        <td>${date(t.data)}</td>
        <td><strong>${esc(t.descricao)}</strong></td>
        <td>${esc(t.categoria || 'Geral')}</td>
        <td><span class="type-pill ${t.tipo === 'entrada' ? 'in' : 'out'}">${t.tipo === 'entrada' ? 'Entrada' : 'Saída'}</span></td>
        <td><strong class="${t.tipo === 'entrada' ? 'positive' : 'negative'}">${t.tipo === 'entrada' ? '+' : '-'} ${money(t.valor)}</strong></td>
        <td><button class="table-action" onclick="removeItem('transaction',${t.id})"><i class="fa-solid fa-trash"></i></button></td>
      </tr>
    `).join('')
    : '<tr><td colspan="6" class="muted">Nenhuma movimentação cadastrada.</td></tr>';
}

function renderAccounts() {
  const accounts = [...state.accounts].sort((a, b) => a.vencimento.localeCompare(b.vencimento));

  $('#accounts-grid').innerHTML = accounts.length
    ? accounts.map(account => `
      <article class="account-card">
        <div class="account-top">
          <span class="type-pill ${account.tipo === 'pagar' ? 'out' : 'in'}">${account.tipo === 'pagar' ? 'A pagar' : 'A receber'}</span>
          <button class="table-action" onclick="removeItem('account',${account.id})"><i class="fa-solid fa-trash"></i></button>
        </div>
        <h3>${esc(account.descricao)}</h3>
        <strong>${money(account.valor)}</strong>
        <div class="account-footer">
          <small><i class="fa-regular fa-calendar"></i> ${date(account.vencimento)}</small>
          <span class="status-pill ${account.status === 'pago' ? 'paid' : 'pending'}">${account.status === 'pago' ? 'Pago' : 'Pendente'}</span>
        </div>
        <button class="text-btn" onclick="payAccount(${account.id})">${account.status === 'pago' ? 'Marcar pendente' : 'Marcar como pago'}</button>
      </article>
    `).join('')
    : '<p class="muted">Nenhuma conta cadastrada.</p>';
}
