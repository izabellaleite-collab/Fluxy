function renderAll() {
  renderSuppliers();
  renderDashboard();
  renderTransactions();
  renderStock();
  renderAccounts();
  renderClients();
  renderServices();
  renderAgenda();
  renderCalendar();
  report();
  renderSettings();
  renderProfile();
}

function bindPasswordToggles() {
  document.addEventListener('click', event => {
    const toggleButton = event.target.closest('[data-toggle]');
    if (!toggleButton) return;
    event.preventDefault();
    const input = $(toggleButton.dataset.toggle);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    toggleButton.innerHTML = input.type === 'password'
      ? '<i class="fa-regular fa-eye"></i>'
      : '<i class="fa-regular fa-eye-slash"></i>';
  });

  const loginToggle = $('#toggle-password');
  if (loginToggle) {
    loginToggle.onclick = () => {
      const input = $('#login-password');
      input.type = input.type === 'password' ? 'text' : 'password';
      loginToggle.innerHTML = input.type === 'password'
        ? '<i class="fa-regular fa-eye"></i>'
        : '<i class="fa-regular fa-eye-slash"></i>';
    };
  }
}

function bindNavigationClicks() {
  document.addEventListener('click', event => {
    const sectionLink = event.target.closest('[data-section]');
    if (sectionLink) {
      event.preventDefault();
      showSection(sectionLink.dataset.section);
    }

    const authLink = event.target.closest('[data-auth]');
    if (authLink) authView(authLink.dataset.auth);

    const modalLink = event.target.closest('[data-modal]');
    if (modalLink) openModal(modalLink.dataset.modal, modalLink.dataset.type);

    const settingsTab = event.target.closest('[data-settings-tab]');
    if (settingsTab) {
      $$('[data-settings-tab]').forEach(tab => tab.classList.remove('active'));
      settingsTab.classList.add('active');
      $$('[data-settings-content]').forEach(panel => {
        panel.classList.toggle('hidden', panel.dataset.settingsContent !== settingsTab.dataset.settingsTab);
      });
    }

    const profileTab = event.target.closest('[data-profile-tab]');
    if (profileTab) {
      $$('[data-profile-tab]').forEach(tab => tab.classList.remove('active'));
      profileTab.classList.add('active');
      $$('[data-profile-content]').forEach(panel => {
        panel.classList.toggle('hidden', panel.dataset.profileContent !== profileTab.dataset.profileTab);
      });
    }
  });
}

function bindForms() {
  $('#login-form').onsubmit = handleLogin;
  $('#register-form').onsubmit = handleRegister;
  $('#forgot-form').onsubmit = handleRecovery;
  $('#company-form').onsubmit = submitCompany;
}

function bindLayoutControls() {
  $('#logout').onclick = logout;
  $('#menu-toggle').onclick = () => $('#sidebar').classList.add('open');
  $('#close-menu').onclick = () => $('#sidebar').classList.remove('open');
  $('#close-modal').onclick = closeModal;
  $('#modal').onclick = event => {
    if (event.target.id === 'modal') closeModal();
  };
  $('#transaction-search').oninput = renderTransactions;
  $('#transaction-filter').onchange = renderTransactions;
}

function bindSettingsAndProfileActions() {
  $('#save-settings').onclick = () => {
    $$('[data-module-toggle]').forEach(toggle => {
      state.modules[toggle.dataset.moduleToggle] = toggle.checked;
    });
    state.company = {
      name: $('#company-name').value,
      doc: $('#company-doc').value,
      phone: $('#company-phone').value,
      timezone: $('#company-timezone').value
    };
    state.notifications = {
      accounts: $('#notify-accounts').checked,
      events: $('#notify-events').checked
    };
    persist();
    applyModules();
    toast('Configurações salvas.');
  };

  $('#save-profile').onclick = () => {
    state.profile = {
      ...state.profile,
      name: $('#profile-name').value,
      email: $('#profile-email').value,
      phone: $('#profile-phone').value,
      twoFactor: $('#two-factor').checked
    };
    state.user = { ...state.user, name: state.profile.name, email: state.profile.email };
    persist();
    start();
    toast('Perfil atualizado.');
  };

  $('#export-data').onclick = () => exportJSON('fluxy-dados.json', {
    profile: state.profile,
    transactions: state.transactions,
    accounts: state.accounts,
    clients: state.clients,
    services: state.services,
    events: state.events
  });

  $('#backup-data').onclick = () => exportJSON(`fluxy-backup-${todayISO()}.json`, state);

  $('#end-sessions').onclick = () => {
    state.profile.logins = [];
    persist();
    renderProfile();
    toast('Sessões ativas encerradas.');
  };

  $('#delete-account').onclick = () => {
    if (confirm('Esta ação é permanente. Excluir a conta?')) {
      localStorage.clear();
      location.reload();
    }
  };

  $('#two-factor').onchange = event => {
    state.profile.twoFactor = event.target.checked;
    persist();
    toast(event.target.checked ? '2FA ativado.' : '2FA desativado.');
  };

  $('#export-report').onclick = () => {
    const lines = [
      'Data,Descrição,Categoria,Tipo,Valor',
      ...state.transactions.map(t => `${t.data},"${t.descricao}","${t.categoria || ''}",${t.tipo},${t.valor}`)
    ];
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    link.download = 'relatorio-fluxy.csv';
    link.click();
  };
}

function bind() {
  bindPasswordToggles();
  bindNavigationClicks();
  bindForms();
  bindLayoutControls();
  bindSettingsAndProfileActions();
}

function bindBrandLinksToHome() {
  $$('.brand').forEach(brand => {
    brand.style.cursor = 'pointer';
    brand.setAttribute('role', 'button');
    brand.title = 'Voltar para a tela inicial';
    brand.onclick = event => {
      event.preventDefault();
      goHome();
    };
  });
}

function bindHashNavigation() {
  window.addEventListener('hashchange', () => {
    if ($('#app').classList.contains('hidden')) return;
    const sectionId = (location.hash || '#dashboard').slice(1);
    showSection(sectionId || 'dashboard');
  });
}

function bootstrap() {
  try {
    bind();
  } catch (error) {
    console.error('[Fluxy] bind', error);
  }

  bindBrandLinksToHome();
  bindHashNavigation();

  const savedUser = get('fp_user', null);
  if (savedUser && savedUser.email && FLUXY_AUTH.isAuthenticated()) {
    state.user = savedUser;
    $('#auth').classList.add('hidden');
    start();
    return;
  }

  $('#auth').classList.remove('hidden');
  $('#app').classList.add('hidden');
  authView('login');
}

document.addEventListener('DOMContentLoaded', bootstrap);
