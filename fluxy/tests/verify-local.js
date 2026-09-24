/*
 * Teste real (nao um mock) do backend Node do Fluxy: sobe o servidor de
 * verdade em uma porta separada, faz cadastro, login, sessao autenticada,
 * o fluxo completo de recuperacao de senha e confirma que o frontend
 * responde na mesma origem - depois encerra o processo.
 *
 * Uso: npm run verify   (ou: node tests/verify-local.js)
 */
const { spawn } = require('child_process');
const path = require('path');

const PORT = 8099;
const baseUrl = `http://127.0.0.1:${PORT}`;
const projectRoot = path.join(__dirname, '..');

const env = {
  ...process.env,
  API_PORT: String(PORT),
  FLUXY_NO_OPEN: '1',
  DB_FILE: path.join(projectRoot, 'backend', 'database', 'data', 'verify.json'),
};

const server = spawn(process.execPath, [path.join(projectRoot, 'backend', 'src', 'index.js')], {
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function postJson(pathname, payload, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return { response, data: await response.json() };
}

async function run() {
  let allPassed = false;

  try {
    await wait(1200);

    const email = `teste${Date.now()}@fluxy.local`;

    const health = await (await fetch(`${baseUrl}/health`)).json();
    console.log('health:', health.status, '| usuarios:', health.users);

    const { response: registerResponse, data: registerData } = await postJson('/api/auth/register', {
      name: 'Teste Real',
      email,
      password: 'Senha1234',
      securityQuestion: 'Qual e o nome do seu primeiro animal de estimacao?',
      securityAnswer: 'Rex',
    });
    console.log('register:', registerResponse.status, registerData.id ? `id=${registerData.id}` : registerData.message);

    const { response: loginResponse, data: loginData } = await postJson('/api/auth/login', { email, password: 'Senha1234' });
    console.log('login:', loginResponse.status, loginData.token ? 'token recebido' : loginData.message);

    const meResponse = await fetch(`${baseUrl}/api/me`, { headers: { Authorization: `Bearer ${loginData.token}` } });
    console.log('me:', meResponse.status);

    const { data: forgotData } = await postJson('/api/auth/forgot-password', { email });
    console.log('forgot-password:', forgotData.question ? `pergunta="${forgotData.question}"` : 'sem pergunta');

    const { response: answerResponse, data: answerData } = await postJson('/api/auth/answer-question', { email, answer: '  REX ' });
    console.log('resposta de seguranca:', answerResponse.status, answerData.token ? 'token emitido' : answerData.message);

    const { response: resetResponse } = await postJson('/api/auth/reset-password', { token: answerData.token, password: 'NovaSenha1' });
    console.log('reset-password:', resetResponse.status);

    const { response: reloginResponse } = await postJson('/api/auth/login', { email, password: 'NovaSenha1' });
    console.log('login com a nova senha:', reloginResponse.status);

    const pageResponse = await fetch(`${baseUrl}/index.html`);
    console.log('index.html:', pageResponse.status);

    allPassed = registerResponse.status === 201
      && loginResponse.status === 200
      && meResponse.status === 200
      && pageResponse.status === 200
      && answerResponse.status === 200
      && resetResponse.status === 200
      && reloginResponse.status === 200;
  } catch (error) {
    console.error('falhou:', error.message);
  } finally {
    server.kill();
    console.log(allPassed ? '\nRESULTADO: TUDO FUNCIONANDO' : '\nRESULTADO: FALHOU');
    process.exit(allPassed ? 0 : 1);
  }
}

run();
