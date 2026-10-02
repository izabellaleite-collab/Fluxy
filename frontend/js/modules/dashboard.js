function monthTransactions() {
  const now = new Date();
  return state.transactions.filter(transaction => {
    const transactionDate = new Date(`${transaction.data}T12:00:00`);
    return transactionDate.getMonth() === now.getMonth() && transactionDate.getFullYear() === now.getFullYear();
  });
}

function renderDashboard() {
  const monthlyEntries = monthTransactions();
  const totalIn = monthlyEntries.filter(t => t.tipo === 'entrada').reduce((sum, t) => sum + t.valor, 0);
  const totalOut = monthlyEntries.filter(t => t.tipo === 'saida').reduce((sum, t) => sum + t.valor, 0);
  const totalReceivable = state.accounts
    .filter(a => a.tipo === 'receber' && a.status !== 'pago')
    .reduce((sum, a) => sum + a.valor, 0);

  $('#kpi-balance').textContent = money(totalIn - totalOut);
  $('#kpi-in').textContent = money(totalIn);
  $('#kpi-out').textContent = money(totalOut);
  $('#kpi-receivable').textContent = money(totalReceivable);
  $('#balance-trend').textContent = totalIn ? '12,4%' : '0%';

  const upcoming = [
    ...state.accounts
      .filter(a => a.status !== 'pago')
      .map(a => ({ title: a.descricao, date: a.vencimento, value: a.valor, type: a.tipo })),
    ...state.events
      .filter(e => e.date >= todayISO())
      .map(e => ({ title: e.title, date: e.date, value: null, type: e.type }))
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

  const sevenDaysFromNow = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const notices = state.accounts
    .filter(a => a.status !== 'pago' && a.vencimento <= sevenDaysFromNow)
    .map(a => `
      <div class="insight">
        <i class="fa-solid fa-triangle-exclamation warning"></i>
        <span><b>${esc(a.descricao)}</b> vence em ${date(a.vencimento)}.</span>
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
  $('#notification-count').textContent = state.accounts.filter(a => a.status !== 'pago').length;

  drawChart();
}

function drawChart() {
  if (!window.Chart) return;

  const canvas = $('#cash-chart');
  if (window.fluxyChart) window.fluxyChart.destroy();

  const labels = [];
  const incomeSeries = [];
  const expenseSeries = [];

  for (let i = 5; i >= 0; i--) {
    const referenceDate = new Date();
    referenceDate.setMonth(referenceDate.getMonth() - i);
    labels.push(referenceDate.toLocaleDateString('pt-BR', { month: 'short' }));

    const monthEntries = state.transactions.filter(t => {
      const entryDate = new Date(`${t.data}T12:00:00`);
      return entryDate.getMonth() === referenceDate.getMonth() && entryDate.getFullYear() === referenceDate.getFullYear();
    });
    incomeSeries.push(monthEntries.filter(t => t.tipo === 'entrada').reduce((sum, t) => sum + t.valor, 0));
    expenseSeries.push(monthEntries.filter(t => t.tipo === 'saida').reduce((sum, t) => sum + t.valor, 0));
  }

  window.fluxyChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Entradas', data: incomeSeries, backgroundColor: '#6b60e9', borderRadius: 5 },
        { label: 'Saídas', data: expenseSeries, backgroundColor: '#e8b3b8', borderRadius: 5 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { usePointStyle: true, boxWidth: 7, font: { size: 10 } }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          grid: { color: '#eef1f5' },
          ticks: { callback: value => 'R$ ' + value }
        }
      }
    }
  });
}
