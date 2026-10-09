// Com servidor, o navegador guarda so o token da sessao. No modo local (file:// ou
// GitHub Pages, sem servidor) a conta fica no localStorage, com a senha em PBKDF2.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PASSWORD_RULE = 'A senha precisa de pelo menos 8 caracteres, com letra maiúscula, minúscula e número.';
const NOTICE_KEY = 'fluxy_notice';

function strongPassword(value) {
  return typeof value === 'string' && value.length >= 8 && value.length <= 128 &&
    /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value);
}

const LOCAL_USERS_KEY = 'fp_users';
const PBKDF2_ITERATIONS = 210000;

const localUsers = () => get(LOCAL_USERS_KEY, [], localStorage);
const saveLocalUsers = users => set(LOCAL_USERS_KEY, users, localStorage);
const toHex = bytes => [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');

async function pbkdf2Hash(password, saltHex, iterations) {
  if (!window.crypto?.subtle) {
    throw new Error('Este navegador não consegue proteger a senha neste endereço. Abra o Fluxy pelo servidor (http://localhost:8080).');
  }
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(saltHex), iterations },
    key,
    256
  );
  return toHex(bits);
}

// Formato das versoes anteriores; usado so para reconhecer contas antigas e converte-las.
async function legacyHash(password) {
  const seed = 'fluxy::' + password;
  if (window.crypto?.subtle) return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed)));
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return 'fb' + Math.abs(hash).toString(16);
}

async function setLocalPassword(user, password) {
  user.salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  user.iterations = PBKDF2_ITERATIONS;
  user.passwordHash = await pbkdf2Hash(password, user.salt, user.iterations);
  delete user.hash;
  delete user.password;
}

async function localPasswordMatches(user, password) {
  if (user.passwordHash) return user.passwordHash === await pbkdf2Hash(password, user.salt, user.iterations);
  if (user.hash) return user.hash === await legacyHash(password);
  return Boolean(user.password) && user.password === password;
}

async function createLocalUser(payload) {
  const users = localUsers();
  if (users.some(user => user.email === payload.email)) throw new Error('Este e-mail já está cadastrado.');

  const user = {
    id: uid(),
    name: payload.name,
    email: payload.email,
    phone: payload.phone || '',
    cpf: payload.cpf || '',
    role: 'admin',
    created: new Date().toISOString()
  };
  await setLocalPassword(user, payload.password);
  users.push(user);
  saveLocalUsers(users);
  return user;
}

async function authenticateLocal(email, password) {
  const users = localUsers();
  const user = users.find(candidate => candidate.email === email && !candidate.remote);
  if (!user || !(await localPasswordMatches(user, password))) throw new Error('E-mail ou senha incorretos.');

  if (!user.passwordHash) {
    await setLocalPassword(user, password);
    saveLocalUsers(users);
  }
  return { name: user.name, email: user.email, phone: user.phone || '', role: user.role || 'admin', created: user.created };
}

async function changeLocalPassword(email, currentPassword, newPassword) {
  const users = localUsers();
  const user = users.find(candidate => candidate.email === email);
  if (!user || !(await localPasswordMatches(user, currentPassword))) throw new Error('A senha atual não confere.');
  await setLocalPassword(user, newPassword);
  saveLocalUsers(users);
}

// Versoes anteriores copiavam para o navegador o hash da senha das contas do servidor.
function removeServerAccountCopies() {
  const users = localUsers();
  const onlyLocal = users.filter(user => !user.remote);
  if (onlyLocal.length !== users.length) saveLocalUsers(onlyLocal);
}

const hasLocalOnlyAccount = email => localUsers().some(user => user.email === email && !user.remote);

window.FLUXY_AUTH = {
  isAuthenticated() {
    const hasUser = Boolean(get('fp_user', null)?.email);
    return FLUXY_API.localOnly ? hasUser : hasUser && Boolean(FLUXY_API.token());
  },

  async signOut() {
    if (FLUXY_API.localOnly) {
      localStorage.removeItem('fp_user');
      return;
    }
    if (FLUXY_API.token()) await FLUXY_API.post('/api/auth/logout').catch(() => {});
    FLUXY_API.clearToken();
    clearAccountData();
  }
};

FLUXY_API.onSessionExpired = () => {
  if (!FLUXY_API.token()) return;
  FLUXY_API.clearToken();
  clearAccountData();
  sessionStorage.setItem(NOTICE_KEY, 'Sua sessão expirou. Entre novamente.');
  location.hash = '';
  location.reload();
};

function showPendingNotice() {
  const notice = sessionStorage.getItem(NOTICE_KEY);
  if (!notice) return;
  sessionStorage.removeItem(NOTICE_KEY);
  toast(notice);
}

function enterApp(user) {
  state.user = { name: user.name, email: user.email, phone: user.phone || '', role: user.role || 'admin' };
  state.profile = {
    ...state.profile,
    name: user.name || 'Usuário',
    email: user.email,
    phone: user.phone || '',
    created: user.created || state.profile.created || new Date().toISOString()
  };
  set('fp_user', state.user);
  persist();
  location.hash = '#dashboard';
  start();
}

function connectionProblem() {
  return new Error('Não foi possível conectar ao servidor. Confira se o Fluxy está em execução e tente de novo.');
}

function validateRegister(payload) {
  if (!payload.name || !payload.email || !payload.password || !payload.confirm) {
    return 'Preencha nome, e-mail, senha e a confirmação da senha.';
  }
  if (!EMAIL_PATTERN.test(payload.email)) return 'Informe um e-mail válido.';
  if (!strongPassword(payload.password)) return PASSWORD_RULE;
  if (payload.password !== payload.confirm) return 'As senhas não conferem.';
  return '';
}

async function registerUser(payload) {
  if (FLUXY_API.localOnly) return createLocalUser(payload);

  try {
    const account = await FLUXY_API.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: payload.name, email: payload.email, phone: payload.phone, cpf: payload.cpf, password: payload.password
      }),
      skipAuth: true
    });
    clearAccountData();
    FLUXY_API.setToken(account.token, false);
    return account;
  } catch (error) {
    if (isConnectionError(error)) throw connectionProblem();
    throw new Error(error.data?.message || 'Não foi possível concluir o cadastro. Tente novamente.');
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = {
    name: $('#register-name').value.trim(),
    email: $('#register-email').value.trim().toLowerCase(),
    phone: $('#register-phone').value.trim(),
    cpf: $('#register-cpf').value.trim(),
    password: $('#register-password').value,
    confirm: $('#register-confirm').value
  };

  const problem = validateRegister(payload);
  if (problem) return toast(problem, 'error');

  await withBusyButton(form.querySelector('button.primary'), 'Criando conta...', async () => {
    try {
      const account = await registerUser(payload);
      form.reset();
      toast('Conta criada. Boas-vindas ao Fluxy!');
      enterApp(account);
    } catch (error) {
      toast(error.message, 'error');
    }
  });
}

async function authenticateUser(email, password, remember) {
  if (FLUXY_API.localOnly) return authenticateLocal(email, password);

  try {
    const account = await FLUXY_API.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, remember }),
      skipAuth: true
    });
    clearAccountData();
    FLUXY_API.setToken(account.token, remember);
    return account;
  } catch (error) {
    if (isConnectionError(error)) throw connectionProblem();
    if (error.code === 'API_401' && hasLocalOnlyAccount(email)) {
      throw new Error('Esta conta existe só neste navegador (foi criada sem conexão com o servidor). Faça um novo cadastro para usar o Fluxy.');
    }
    throw new Error(error.data?.message || 'Não foi possível entrar. Tente novamente.');
  }
}

function recordLocalLogin() {
  state.profile.logins = [
    { date: new Date().toISOString(), device: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'Celular' : 'Computador', success: true },
    ...(state.profile.logins || [])
  ].slice(0, 5);
}

async function handleLogin(event) {
  event.preventDefault();
  const email = $('#login-email').value.trim().toLowerCase();
  const password = $('#login-password').value;
  const remember = $('#remember-login').checked;

  if (!email || !password) return toast('Informe e-mail e senha.', 'error');

  await withBusyButton(event.currentTarget.querySelector('button.primary'), 'Entrando...', async () => {
    try {
      const account = await authenticateUser(email, password, remember);
      $('#login-password').value = '';
      if (FLUXY_API.localOnly) recordLocalLogin();
      enterApp(account);
    } catch (error) {
      toast(error.message, 'error');
    }
  });
}

const RECOVERY_HINTS = {
  email: 'Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha.',
  sent: 'Abra o e-mail e clique no link para criar a nova senha.',
  reset: 'Crie a sua nova senha.'
};

let resetToken = '';
let recoveryStep = 'email';

function showRecoveryMessage(text, kind = 'info') {
  const box = $('#forgot-message');
  box.textContent = text || '';
  box.className = `form-message ${kind}`;
  box.classList.toggle('hidden', !text);
}

function showRecoveryStep(step) {
  recoveryStep = step;
  ['email', 'sent', 'reset'].forEach(name => $(`#forgot-step-${name}`).classList.toggle('hidden', name !== step));
  $('#forgot-hint').textContent = RECOVERY_HINTS[step];
}

function openRecovery() {
  resetToken = '';
  showRecoveryMessage('');
  showRecoveryStep('email');
}

async function requestResetLink() {
  const email = $('#forgot-email').value.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return showRecoveryMessage('Informe um e-mail válido.', 'error');

  if (FLUXY_API.localOnly) {
    return showRecoveryMessage(
      'No modo local não há servidor para enviar e-mail, então a senha não pode ser recuperada por aqui. ' +
      'Os dados desta conta ficam apenas neste navegador.',
      'error'
    );
  }

  await withBusyButton($('#forgot-send'), 'Enviando...', async () => {
    try {
      const response = await FLUXY_API.request('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
        skipAuth: true
      });
      showRecoveryStep('sent');
      showRecoveryMessage(response.message, 'success');
    } catch (error) {
      showRecoveryMessage(
        error.code === 'API_UNAVAILABLE'
          ? connectionProblem().message
          : error.data?.message || 'Não foi possível enviar o link agora. Tente novamente em alguns minutos.',
        'error'
      );
    }
  });
}

async function saveNewPassword() {
  const password = $('#reset-password').value;
  const confirmation = $('#reset-confirm').value;

  if (!strongPassword(password)) return showRecoveryMessage(PASSWORD_RULE, 'error');
  if (password !== confirmation) return showRecoveryMessage('As senhas não conferem.', 'error');

  await withBusyButton($('#forgot-save-password'), 'Salvando...', async () => {
    try {
      await FLUXY_API.request('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: resetToken, password }),
        skipAuth: true
      });
    } catch (error) {
      if (error.data?.error === 'invalid_token') {
        showRecoveryStep('email');
        return showRecoveryMessage(error.data.message, 'error');
      }
      return showRecoveryMessage(
        error.code === 'API_UNAVAILABLE' ? connectionProblem().message : error.data?.message || 'Não foi possível salvar a nova senha. Tente novamente.',
        'error'
      );
    }

    resetToken = '';
    $('#reset-password').value = '';
    $('#reset-confirm').value = '';
    authView('login');
    toast('Senha alterada com sucesso. Entre com a nova senha.');
    $('#login-password').focus();
  });
}

function handleRecovery(event) {
  event.preventDefault();
  if (recoveryStep === 'reset') return saveNewPassword();
  if (recoveryStep === 'email') return requestResetLink();
  return undefined;
}

function takeResetTokenFromUrl() {
  const match = location.hash.match(/^#redefinir=([a-f0-9]{64})$/i);
  if (!match) return '';
  history.replaceState(null, '', location.pathname + location.search);
  return match[1];
}

async function openResetLink(token) {
  $('#app').classList.add('hidden');
  $('#auth').classList.remove('hidden');
  authView('forgot');
  resetToken = token;
  showRecoveryMessage('');
  showRecoveryStep('reset');

  // Sem resposta agora, o link e conferido de novo quando a senha for salva.
  const { valid } = await FLUXY_API.request('/api/auth/reset-password/validate', {
    method: 'POST',
    body: JSON.stringify({ token }),
    skipAuth: true
  }).catch(() => ({ valid: true }));

  if (!valid) {
    resetToken = '';
    showRecoveryStep('email');
    showRecoveryMessage('Este link de redefinição é inválido ou já expirou. Peça um novo link.', 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!FLUXY_API.localOnly) removeServerAccountCopies();
  $('#forgot-again').addEventListener('click', openRecovery);
});
