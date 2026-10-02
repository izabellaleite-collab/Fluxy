window.FLUXY_AUTH = {
  isAuthenticated: () => Boolean(localStorage.getItem('fluxy_token') || localStorage.getItem('fp_user')),

  async clear() {
    try {
      if (window.FLUXY_API && !FLUXY_API.isFile && localStorage.getItem('fluxy_token')) {
        await FLUXY_API.request('/api/auth/logout', { method: 'POST' });
      }
    } catch (_error) {
    }
    localStorage.removeItem('fluxy_token');
    localStorage.removeItem('fp_user');
  }
};

async function hashLocal(password) {
  try {
    const bytes = new TextEncoder().encode('fluxy::' + password);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (_error) {
    let hash = 0;
    const seed = 'fluxy::' + password;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash * 31 + seed.charCodeAt(i)) | 0;
    }
    return 'fb' + Math.abs(hash).toString(16);
  }
}

const normalizeAnswer = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

function localUsers() {
  return get('fp_users', []);
}

function saveLocalUsers(users) {
  set('fp_users', users);
}

async function createLocalUser(payload) {
  const users = localUsers();
  if (users.some(u => u.email === payload.email)) {
    throw new Error('Este e-mail ja esta cadastrado.');
  }
  const user = {
    id: uid(),
    name: payload.name,
    email: payload.email,
    phone: payload.phone || '',
    cpf: payload.cpf || '',
    hash: await hashLocal(payload.password),
    question: payload.securityQuestion || '',
    answerHash: payload.securityAnswer ? await hashLocal(normalizeAnswer(payload.securityAnswer)) : '',
    role: 'admin',
    created: new Date().toISOString()
  };
  users.push(user);
  saveLocalUsers(users);
  return { user, source: 'local' };
}

function registerUser(payload) {
  return createUser(payload);
}

async function createUser(payload) {
  if (localUsers().some(user => user.email === payload.email)) {
    throw new Error('Este e-mail ja esta cadastrado.');
  }
  const api = window.FLUXY_API;
  if (!api) return createLocalUser(payload);

  try {
    const response = await api.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const users = localUsers();
    users.push({
      id: response?.id || uid(),
      name: payload.name,
      email: payload.email,
      phone: payload.phone || '',
      cpf: payload.cpf || '',
      hash: await hashLocal(payload.password),
      question: payload.securityQuestion || '',
      answerHash: payload.securityAnswer ? await hashLocal(normalizeAnswer(payload.securityAnswer)) : '',
      role: 'admin',
      created: new Date().toISOString(),
      remote: true
    });
    saveLocalUsers(users);
    if (response?.token) localStorage.setItem('fluxy_token', response.token);
    return { user: { ...payload, id: response?.id || null }, source: 'api' };
  } catch (error) {
    if (error.code === 'API_409' || error.message === 'API 409') {
      throw new Error('Este e-mail ja esta cadastrado.');
    }
    if (error.code === 'API_400' || error.message === 'API 400') {
      throw new Error(error.data?.message || 'Revise os dados informados.');
    }
    if (error.code === 'API_UNAVAILABLE' || String(error.code || '').startsWith('API_5')) {
      const result = await createLocalUser(payload);
      result.warning = 'Cadastro salvo neste computador (a API nao respondeu).';
      return result;
    }
    throw new Error('Nao foi possivel concluir o cadastro. Tente novamente.');
  }
}

function validateRegister(payload) {
  if (!payload.name || !payload.email || !payload.password || !payload.confirm) {
    return 'Preencha todos os campos obrigatorios.';
  }
  if (!/^\S+@\S+\.\S+$/.test(payload.email)) return 'Informe um e-mail valido.';
  if (typeof strongPassword === 'function' && !strongPassword(payload.password)) {
    return 'A senha deve ter 8 caracteres, maiuscula, minuscula e numero.';
  }
  if (payload.password !== payload.confirm) return 'As senhas nao conferem.';
  if (!payload.securityAnswer) {
    return 'Responda a pergunta de seguranca (ela sera usada para recuperar a senha).';
  }
  return '';
}

async function submitRegister(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"],button:not([type])');
  const payload = {
    name: $('#register-name')?.value.trim(),
    email: $('#register-email')?.value.trim().toLowerCase(),
    phone: $('#register-phone')?.value.trim(),
    cpf: $('#register-cpf')?.value.trim(),
    password: $('#register-password')?.value,
    confirm: $('#register-confirm')?.value,
    securityQuestion: $('#register-question')?.value || '',
    securityAnswer: $('#register-answer')?.value.trim() || ''
  };

  const validationMessage = validateRegister(payload);
  if (validationMessage) {
    toast(validationMessage);
    return false;
  }

  if (button) {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.textContent = 'Criando conta...';
  }

  try {
    const result = await registerUser(payload);
    state.profile = { ...state.profile, name: payload.name, email: payload.email, phone: payload.phone, created: new Date().toISOString() };
    persist();
    localStorage.removeItem('fluxy_token');
    toast(result.warning || 'Conta criada com sucesso. Faca login para entrar.');
    form.reset();
    goHome();
    $('#login-email').value = payload.email;
    $('#login-password').value = '';
    $('#login-password').focus();
  } catch (error) {
    toast(error?.message || 'Nao foi possivel criar a conta. Tente novamente.');
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = button.dataset.originalText || 'Criar conta';
    }
  }
  return false;
}

function handleRegister(event) {
  return submitRegister(event);
}

async function authenticateLocal(email, password) {
  const hash = await hashLocal(password);
  const user = localUsers().find(u => u.email === email && (u.hash === hash || u.password === password));
  if (!user) throw new Error('E-mail ou senha incorretos.');
  return { name: user.name, email: user.email, phone: user.phone, role: user.role || 'admin' };
}

async function authenticateUser(email, password) {
  const api = window.FLUXY_API;
  if (!api) return authenticateLocal(email, password);

  try {
    const response = await api.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (response?.token) localStorage.setItem('fluxy_token', response.token);
    const local = localUsers().find(user => user.email === email) || {};
    return {
      ...local,
      name: response?.name || local.name || 'Usuario',
      email,
      phone: response?.phone || local.phone || '',
      role: response?.role || local.role || 'admin'
    };
  } catch (error) {
    if (error.code === 'API_401' || error.message === 'API 401') {
      try {
        return await authenticateLocal(email, password);
      } catch (_local) {
        throw new Error('E-mail ou senha incorretos.');
      }
    }
    if (error.code === 'API_UNAVAILABLE' || String(error.code || '').startsWith('API_5')) {
      return authenticateLocal(email, password);
    }
    throw new Error('Nao foi possivel entrar. Tente novamente.');
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"],button:not([type])');
  const email = $('#login-email')?.value.trim().toLowerCase();
  const password = $('#login-password')?.value;

  if (!email || !password) {
    toast('Informe e-mail e senha.');
    return false;
  }

  if (button) {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.textContent = 'Entrando...';
  }

  try {
    state.user = await authenticateUser(email, password);
    state.profile = {
      ...state.profile,
      name: state.user.name || state.profile.name || 'Usuario',
      email,
      phone: state.user.phone || state.profile.phone || ''
    };
    state.profile.logins = [
      { date: new Date().toISOString(), device: navigator.userAgent.includes('Mobile') ? 'Celular' : 'Navegador' },
      ...(state.profile.logins || [])
    ].slice(0, 5);
    set('fp_user', state.user);
    persist();
    location.hash = '#dashboard';
    start();
  } catch (error) {
    toast(error?.message || 'Nao foi possivel entrar. Tente novamente.');
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = button.dataset.originalText || 'Entrar no painel';
    }
  }
  return false;
}

async function submitCompany(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = {
    name: $('#company-legal')?.value.trim(),
    trade: $('#company-trade')?.value.trim(),
    doc: $('#company-cnpj')?.value.trim(),
    segment: $('#company-segment')?.value.trim(),
    phone: $('#company-tel')?.value.trim(),
    email: $('#company-email')?.value.trim(),
    address: $('#company-address')?.value.trim(),
    city: $('#company-city')?.value.trim(),
    state: $('#company-state')?.value.trim(),
    cep: $('#company-cep')?.value.trim()
  };

  if (!payload.name || !payload.segment) {
    toast('Preencha o nome da empresa e o segmento.');
    return false;
  }

  const button = form.querySelector('button[type="submit"],button:not([type])');
  if (button) {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.textContent = 'Salvando empresa...';
  }

  try {
    await FLUXY_API.request('/api/company', { method: 'POST', body: JSON.stringify(payload) });
  } catch (_error) {
  }

  state.company = { ...state.company, ...payload };
  persist();
  toast('Empresa cadastrada com sucesso.');

  if (button) {
    button.disabled = false;
    button.textContent = button.dataset.originalText || 'Salvar e acessar painel';
  }
  setTimeout(() => start(), 300);
  return false;
}

function handleRecovery(event) {
  if (event) event.preventDefault();
  return false;
}

const RECOVERY = { email: '', question: '', token: '' };

function recoveryStep(step) {
  ['email', 'question', 'reset'].forEach(name => {
    const el = $(`#forgot-step-${name}`);
    if (el) el.classList.toggle('hidden', name !== step);
  });
  const hints = {
    email: 'Informe o e-mail da sua conta para continuar.',
    question: 'Responda a pergunta cadastrada no seu perfil.',
    reset: 'Defina sua nova senha.'
  };
  const hint = $('#forgot-hint');
  if (hint) hint.textContent = hints[step] || '';
}

function localUserByEmail(email) {
  return localUsers().find(u => u.email === email);
}

async function recoveryContinue() {
  const email = $('#forgot-email')?.value.trim().toLowerCase();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return toast('Informe um e-mail valido.');

  RECOVERY.email = email;
  RECOVERY.token = '';
  RECOVERY.question = '';

  const local = localUserByEmail(email);
  RECOVERY.question = local?.question || '';

  try {
    const data = await FLUXY_API.request('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
      skipAuth: true
    });
    if (data.question) RECOVERY.question = data.question;
  } catch (_error) {
  }

  if (!RECOVERY.question) {
    return toast('Esta conta nao tem pergunta de seguranca cadastrada.');
  }

  const label = $('#forgot-question-label');
  if (label) label.firstChild.textContent = RECOVERY.question;
  $('#forgot-answer').value = '';
  recoveryStep('question');
}

async function recoveryCheckAnswer() {
  const answer = $('#forgot-answer')?.value;
  if (!answer) return toast('Digite sua resposta.');

  try {
    const data = await FLUXY_API.request('/api/auth/answer-question', {
      method: 'POST',
      body: JSON.stringify({ email: RECOVERY.email, answer }),
      skipAuth: true
    });
    RECOVERY.token = data.token;
    recoveryStep('reset');
    return;
  } catch (error) {
    if (error.code === 'API_401') return toast('Resposta incorreta.');
  }

  const local = localUserByEmail(RECOVERY.email);
  if (local?.answerHash && local.answerHash === (await hashLocal(normalizeAnswer(answer)))) {
    RECOVERY.token = 'local';
    recoveryStep('reset');
    return;
  }

  toast('Resposta incorreta.');
}

async function recoverySavePassword() {
  const password = $('#reset-password')?.value;
  const confirm = $('#reset-confirm')?.value;

  if (!strongPassword(password)) {
    return toast('A nova senha deve ter 8 caracteres, maiuscula, minuscula e numero.');
  }
  if (password !== confirm) return toast('As senhas nao conferem.');

  let done = false;

  if (RECOVERY.token && RECOVERY.token !== 'local') {
    try {
      await FLUXY_API.request('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: RECOVERY.token, password }),
        skipAuth: true
      });
      done = true;
    } catch (error) {
      if (error.code === 'API_400') {
        return toast(error.data?.message || 'Link de redefinicao invalido ou expirado.');
      }
    }
  }

  const users = localUsers();
  const local = users.find(u => u.email === RECOVERY.email);
  if (local) {
    local.hash = await hashLocal(password);
    saveLocalUsers(users);
    done = true;
  }

  if (!done) return toast('Nao foi possivel redefinir a senha. Tente novamente.');

  localStorage.removeItem('fluxy_token');
  toast('Senha alterada com sucesso. Faca login com a nova senha.');
  $('#login-email').value = RECOVERY.email;
  $('#login-password').value = '';
  authView('login');
}

document.addEventListener('DOMContentLoaded', () => {
  const on = (selector, handler) => {
    const el = $(selector);
    if (el) el.onclick = handler;
  };

  on('#forgot-continue', recoveryContinue);
  on('#forgot-check-answer', recoveryCheckAnswer);
  on('#forgot-save-password', recoverySavePassword);
  recoveryStep('email');
});
