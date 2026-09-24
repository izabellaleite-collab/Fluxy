function authView(view) {
  $('#login-form').classList.toggle('hidden', view !== 'login');
  $('#register-form').classList.toggle('hidden', view !== 'register');
  $('#forgot-form').classList.toggle('hidden', view !== 'forgot');
  $('.auth-switch').classList.toggle('hidden', view === 'forgot');
}

function strongPassword(value) {
  return value.length >= 8 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value);
}

function start() {
  if (!state.user) return;

  $('#company-onboarding').classList.add('hidden');
  $('#auth').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#user-name').textContent = state.profile.name || 'Usuário';
  $('#greeting-name').textContent = (state.profile.name || 'Usuário').split(' ')[0];

  try {
    applyModules();
  } catch (error) {
    console.error('[Fluxy] applyModules', error);
  }

  try {
    renderAll();
  } catch (error) {
    console.error('[Fluxy] renderAll', error);
  }

  let target = (location.hash || '#dashboard').slice(1);
  if (!target || !document.getElementById(target)) target = 'dashboard';

  try {
    showSection(target);
  } catch (error) {
    console.error('[Fluxy] showSection', error);
    showSection('dashboard');
  }
}

function goHome() {
  if (state.user && FLUXY_AUTH.isAuthenticated()) {
    location.hash = '#dashboard';
    showSection('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  $('#app').classList.add('hidden');
  $('#auth').classList.remove('hidden');
  $('#company-onboarding').classList.add('hidden');
  $('.auth-card')?.classList.remove('hidden');
  authView('login');
}
window.goHome = goHome;

async function logout() {
  try {
    await FLUXY_AUTH.clear();
  } catch (_error) {
  }
  localStorage.removeItem('fp_user');
  localStorage.removeItem('fluxy_token');
  location.hash = '';
  location.reload();
}

const SECTION_TITLES = {
  dashboard: 'Visão geral',
  fornecedores: 'Fornecedores',
  financeiro: 'Movimentações',
  contas: 'Contas a pagar/receber',
  clientes: 'Clientes',
  servicos: 'Serviços e comprovantes',
  agenda: 'Agenda de serviços',
  calendario: 'Calendário empresarial',
  relatorios: 'Relatórios financeiros',
  configuracoes: 'Configurações',
  perfil: 'Meu perfil'
};

function showSection(id) {
  if (!id || !document.getElementById(id)) id = 'dashboard';
  if (!['configuracoes', 'perfil'].includes(id) && state.modules[id] === false) return;

  $$('.section').forEach(section => section.classList.add('hidden'));
  const target = $(`#${id}`);
  if (!target) return;
  target.classList.remove('hidden');

  $$('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.section === id));

  $('#page-title').textContent = SECTION_TITLES[id] || 'Fluxy';
  $('#page-eyebrow').textContent = id === 'dashboard'
    ? 'PAINEL PRINCIPAL'
    : 'GESTÃO / ' + (SECTION_TITLES[id] || id).toUpperCase();

  if (id === 'calendario') renderCalendar();
  if (innerWidth < 760) $('#sidebar').classList.remove('open');
}

const TOGGLEABLE_MODULES = [
  'dashboard', 'financeiro', 'contas', 'estoque', 'clientes',
  'fornecedores', 'servicos', 'agenda', 'calendario', 'relatorios'
];

function applyModules() {
  TOGGLEABLE_MODULES.forEach(moduleKey => {
    const navButton = $(`#nav [data-section="${moduleKey}"]`);
    if (navButton) navButton.classList.toggle('hidden', state.modules[moduleKey] === false);

    const section = $(`#${moduleKey}`);
    if (section && state.modules[moduleKey] === false) section.classList.add('hidden');
  });

  const navButtons = $$('#nav [data-section]');
  const seenSections = new Set();
  navButtons.forEach(button => {
    if (seenSections.has(button.dataset.section)) button.remove();
    else seenSections.add(button.dataset.section);
  });

  const currentSectionId = $('.section:not(.hidden)')?.id;
  if (currentSectionId && state.modules[currentSectionId] === false) showSection('dashboard');
}
