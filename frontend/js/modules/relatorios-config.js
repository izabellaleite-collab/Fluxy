function report() {
  const income = state.transactions.filter(t => t.tipo === 'entrada');
  const expenses = state.transactions.filter(t => t.tipo === 'saida');

  const expensesByCategory = expenses.reduce((totals, expense) => {
    const category = expense.categoria || 'Geral';
    totals[category] = (totals[category] || 0) + expense.valor;
    return totals;
  }, {});

  const totalIncome = income.reduce((sum, t) => sum + t.valor, 0);
  const totalExpenses = expenses.reduce((sum, t) => sum + t.valor, 0);

  $('#report-result').textContent = money(totalIncome - totalExpenses);
  $('#report-ticket').textContent = money(income.length ? totalIncome / income.length : 0);

  const maxCategoryValue = Math.max(...Object.values(expensesByCategory), 1);
  $('#category-report').innerHTML = Object.entries(expensesByCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([category, value]) => `
      <div class="category-row">
        <span>${esc(category)}</span>
        <div class="bar"><i style="width:${(value / maxCategoryValue) * 100}%"></i></div>
        <strong>${money(value)}</strong>
      </div>
    `).join('') || '<p class="muted">Registre saídas para visualizar categorias.</p>';
}

const SETTINGS_MODULE_LABELS = {
  dashboard: 'Dashboard',
  financeiro: 'Movimentações',
  contas: 'Contas a pagar e receber',
  estoque: 'Estoque',
  clientes: 'Clientes',
  fornecedores: 'Fornecedores',
  servicos: 'Serviços',
  agenda: 'Agenda de serviços',
  calendario: 'Calendário',
  relatorios: 'Relatórios'
};

function renderSettings() {
  $('#module-toggles').innerHTML = Object.entries(SETTINGS_MODULE_LABELS).map(([key, label]) => `
    <label class="toggle-row">
      <span><b>${label}</b><small>Exibir este módulo no menu e no sistema.</small></span>
      <input data-module-toggle="${key}" type="checkbox" ${state.modules[key] ? 'checked' : ''}>
      <i></i>
    </label>
  `).join('');

  $('#company-name').value = state.company.name;
  $('#company-doc').value = state.company.doc;
  $('#company-phone').value = state.company.phone;
  $('#company-timezone').value = state.company.timezone;
  $('#notify-accounts').checked = state.notifications.accounts;
  $('#notify-events').checked = state.notifications.events;
}

function renderProfile() {
  const profile = state.profile;
  $('#profile-name').value = profile.name;
  $('#profile-email').value = profile.email;
  $('#profile-phone').value = profile.phone;
  $('#profile-created').value = date(profile.created.slice(0, 10));
  $('#profile-name-card').textContent = profile.name;
  $('#profile-email-card').textContent = profile.email;
  $('#profile-avatar').textContent = profile.avatar || profile.name.split(' ').map(part => part[0]).join('').slice(0, 2);
  $('#two-factor').checked = !!profile.twoFactor;
  $('#login-history').textContent = profile.logins?.length
    ? `${date(profile.logins[0].date.slice(0, 10))} · ${profile.logins[0].device}`
    : 'Nenhum acesso registrado.';
}
