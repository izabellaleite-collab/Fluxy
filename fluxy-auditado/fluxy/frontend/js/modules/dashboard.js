const sumBy = (list, pick) => list.reduce((sum, item) => sum + pick(item), 0);

function monthTotals(year, month) {
  const prefix = `${year}-${pad2(month + 1)}`;
  const totals = { income: 0, expense: 0 };
  state.transactions.forEach(transaction => {
    if (!String(transaction.data).startsWith(prefix)) return;
    if (transaction.tipo === 'entrada') totals.income += transaction.valor;
    else totals.expense += transaction.valor;
  });
  return totals;
}

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  return hour < 18 ? 'Boa tarde' : 'Boa noite';
}

function renderBalanceTrend(currentBalance, previousBalance) {
  const box = $('#balance-trend-box');
  const hasBase = previousBalance !== 0;
  const change = hasBase ? ((currentBalance - previousBalance) / Math.abs(previousBalance)) * 100 : 0;
  const rising = change >= 0;

  box.classList.toggle('positive', !hasBase || rising);
  box.classList.toggle('negative', hasBase && !rising);
  $('#balance-trend-icon').className = `fa-solid ${rising ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}`;
  $('#balance-trend').textContent = hasBase
    ? `${rising ? '+' : ''}${change.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% em relação ao mês anterior`
    : 'Sem movimentações no mês anterior';
}

function renderDashboard() {
  const now = new Date();
  const current = monthTotals(now.getFullYear(), now.getMonth());
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previous = monthTotals(previousMonth.getFullYear(), previousMonth.getMonth());
  const pendingAccounts = state.accounts.filter(account => account.status !== 'pago');
  const totalReceivable = sumBy(pendingAccounts.filter(account => account.tipo === 'receber'), account => account.valor);

  $('#greeting-period').textContent = greetingForNow();
  $('#kpi-balance').textContent = money(current.income - current.expense);
  $('#kpi-in').textContent = money(current.income);
  $('#kpi-out').textContent = money(current.expense);
  $('#kpi-receivable').textContent = money(totalReceivable);
  renderBalanceTrend(current.income - current.expense, previous.income - previous.expense);

  const today = todayISO();
  const upcoming = [
    ...pendingAccounts.map(a => ({ title: a.descricao, date: a.vencimento, value: a.valor })),
    ...state.events.filter(e => e.date >= today).map(e => ({ title: e.title, date: e.date, value: null }))
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);

  $('#upcoming-list').innerHTML = upcoming.length
    ? upcoming.map(item => `
      <div class="list-item">
        <span class="list-icon"><i class="fa-solid ${item.value !== null ? 'fa-file-invoice-dollar' : 'fa-calendar-day'}"></i></span>
        <div><b>${esc(item.title)}</b><small>${date(item.date)}</small></div>
        <strong>${item.value !== null ? money(item.value) : ''}</strong>
      </div>
    `).join('')
    : '<p class="muted">Nenhum compromisso próximo.</p>';

  const sevenDaysFromNow = toISODate(new Date(Date.now() + 7 * 864e5));
  const notices = pendingAccounts
    .filter(account => account.vencimento <= sevenDaysFromNow)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
    .map(account => `
      <div class="insight">
        <i class="fa-solid fa-triangle-exclamation warning"></i>
        <span><b>${esc(account.descricao)}</b> ${account.vencimento < today ? 'venceu' : 'vence'} em ${date(account.vencimento)}.</span>
      </div>
    `);
  if (!notices.length) {
    notices.push(`
      <div class="insight">
        <i class="fa-solid fa-circle-check positive"></i>
        <span>Tudo certo! Nenhum alerta crítico no momento.</span>
      </div>
    `);
  }
  $('#insights').innerHTML = notices.slice(0, 3).join('');
  $('#notification-count').textContent = pendingAccounts.length;

  drawChart();
}

function chartMonths() {
  const now = new Date();
  const count = $('#chart-period').value === 'year' ? now.getMonth() + 1 : 6;
  return Array.from({ length: count }, (_, index) => new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1));
}

function drawChart() {
  if (!window.Chart) return;

  const months = chartMonths();
  const totals = months.map(month => monthTotals(month.getFullYear(), month.getMonth()));
  const labels = months.map(month => month.toLocaleDateString('pt-BR', { month: 'short' }));
  const income = totals.map(total => total.income);
  const expense = totals.map(total => total.expense);

  if (window.fluxyChart) {
    window.fluxyChart.data.labels = labels;
    window.fluxyChart.data.datasets[0].data = income;
    window.fluxyChart.data.datasets[1].data = expense;
    window.fluxyChart.update();
    return;
  }

  window.fluxyChart = new Chart($('#cash-chart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Entradas', data: income, backgroundColor: '#6b60e9', borderRadius: 5 },
        { label: 'Saídas', data: expense, backgroundColor: '#e8b3b8', borderRadius: 5 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { usePointStyle: true, boxWidth: 7, font: { size: 10 } }
        },
        tooltip: { callbacks: { label: context => `${context.dataset.label}: ${money(context.parsed.y)}` } }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          grid: { color: '#eef1f5' },
          ticks: { callback: value => 'R$ ' + Number(value).toLocaleString('pt-BR') }
        }
      }
    }
  });
}
