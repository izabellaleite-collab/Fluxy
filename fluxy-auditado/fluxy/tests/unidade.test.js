const test = require('node:test');
const assert = require('node:assert/strict');

const security = require('../backend/src/lib/security');
const validation = require('../backend/src/lib/validation');
const { createRateLimiter, consume, assertNotBlocked } = require('../backend/src/lib/rate-limit');

const messageOf = fn => {
  try {
    fn();
  } catch (error) {
    return { status: error.status, message: error.message };
  }
  return null;
};

test('senha: exige 8 a 128 caracteres, maiuscula, minuscula e numero', () => {
  assert.equal(security.passwordProblem('Senha1234'), '');
  assert.match(security.passwordProblem('Abc123'), /pelo menos 8/);
  assert.match(security.passwordProblem('senha1234'), /maiúscula/);
  assert.match(security.passwordProblem('SENHA1234'), /maiúscula/);
  assert.match(security.passwordProblem('SenhaSemNumero'), /número/);
  assert.match(security.passwordProblem('Aa1' + 'x'.repeat(126)), /no máximo 128/);
  assert.match(security.passwordProblem(undefined), /pelo menos 8/);
  assert.match(security.passwordProblem({ length: 20 }), /pelo menos 8/);
});

test('senha: o hash usa salt aleatorio e confere apenas com a senha certa', async () => {
  const first = await security.passwordHash('Senha1234');
  const second = await security.passwordHash('Senha1234');

  assert.notEqual(first, second, 'duas gravacoes da mesma senha nao podem gerar o mesmo hash');
  assert.match(first, /^[a-f0-9]{32}:[a-f0-9]{128}$/);
  assert.ok(!first.includes('Senha1234'));
  assert.equal(await security.passwordMatches('Senha1234', first), true);
  assert.equal(await security.passwordMatches('senha1234', first), false);
  assert.equal(await security.passwordMatches('Senha1234', ''), false);
  assert.equal(await security.passwordMatches('Senha1234', 'texto-sem-formato'), false);
});

test('senha: hashes gravados pela versao anterior continuam validos', async () => {
  const legacy = '4f6c3ccf1aaa2f29699cf9572e05ed60:3d1d2cfcd2b0f8de0fd741a08e972c65c1aec6779dab1eaded7a86de51a5001f986d7644212e1b9084e017c3fceffd922a769bd241ac39c31641813e0a8f3337';
  assert.equal(await security.passwordMatches('Senha1234', legacy), true);
  assert.equal(await security.passwordMatches('Senha12345', legacy), false);
});

test('token: e aleatorio e so o hash dele serve para busca', () => {
  const token = security.newToken();
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.notEqual(token, security.newToken());
  assert.match(security.hashToken(token), /^[a-f0-9]{64}$/);
  assert.notEqual(security.hashToken(token), token);
});

test('e-mail: normaliza e recusa formatos que permitiriam injetar cabecalhos', () => {
  assert.equal(security.normalizeEmail('  Ana@Exemplo.COM '), 'ana@exemplo.com');
  assert.equal(security.normalizeEmail({ toString: () => 'x@y.com' }), '');
  assert.equal(security.isValidEmail('ana@exemplo.com'), true);
  assert.equal(security.isValidEmail('ana@exemplo'), false);
  assert.equal(security.isValidEmail('ana@exemplo.com\r\nbcc: x@y.com'), false);
  assert.equal(security.isValidEmail('ana <x@y.com>'), false);
  assert.equal(security.isValidEmail('a'.repeat(150) + '@x.com'), false);
});

test('validacao: textos obrigatorios, opcionais e limite de tamanho', () => {
  assert.equal(validation.requiredText('  Maria  ', 'o nome', 10), 'Maria');
  assert.deepEqual(messageOf(() => validation.requiredText('', 'o nome', 10)), { status: 400, message: 'Informe o nome.' });
  assert.equal(messageOf(() => validation.requiredText({ a: 1 }, 'o nome', 10)).status, 400);
  assert.match(messageOf(() => validation.requiredText('x'.repeat(11), 'o nome', 10)).message, /limite é de 10/);
  assert.equal(validation.optionalText('   ', 'o telefone', 20), null);
  assert.equal(validation.optionalText(12345, 'o telefone', 20), '12345');
});

test('validacao: valores em dinheiro', () => {
  assert.equal(validation.money('10,50', 'um valor'), 10.5);
  assert.equal(validation.money(0, 'o preço', { allowZero: true }), 0);
  assert.equal(validation.money(10.129, 'um valor'), 10.13);
  for (const invalid of [0, -1, 'abc', '', null, undefined, NaN, Infinity, 1e15]) {
    assert.equal(messageOf(() => validation.money(invalid, 'um valor')).status, 400, `deveria recusar ${invalid}`);
  }
});

test('validacao: datas e horarios precisam existir de verdade', () => {
  assert.equal(validation.isoDate('2026-02-28', 'a data'), '2026-02-28');
  assert.equal(validation.isoDate('', 'a data'), null);
  for (const invalid of ['2026-02-30', '2026-13-01', 'amanha', '28/02/2026', '2026-2-3', '0001-01-01']) {
    assert.equal(messageOf(() => validation.isoDate(invalid, 'a data')).status, 400, `deveria recusar ${invalid}`);
  }
  assert.equal(messageOf(() => validation.isoDate('', 'a data', { required: true })).status, 400);
  assert.equal(validation.time('09:30', 'o horário'), '09:30');
  assert.equal(validation.time('09:30:00', 'o horário'), '09:30');
  assert.equal(messageOf(() => validation.time('25:00', 'o horário')).status, 400);
});

test('validacao: inteiros, sigla de estado e booleanos', () => {
  assert.equal(validation.integer('7', 'a quantidade', { min: 1 }), 7);
  assert.equal(validation.integer('', 'a quantidade', { fallback: 0 }), 0);
  for (const invalid of ['1.5', -1, 'abc', 3000000000]) {
    assert.equal(messageOf(() => validation.integer(invalid, 'a quantidade')).status, 400, `deveria recusar ${invalid}`);
  }
  assert.equal(validation.stateCode('sp'), 'SP');
  assert.equal(validation.stateCode(''), null);
  assert.equal(messageOf(() => validation.stateCode('São Paulo')).status, 400);
  assert.equal(validation.optionalBoolean(undefined, 'x'), null);
  assert.equal(messageOf(() => validation.optionalBoolean('sim', 'x')).status, 400);
});

test('limite de tentativas: bloqueia ao estourar e libera depois da janela', async () => {
  const limiter = createRateLimiter({ windowMs: 150, max: 3 });

  consume(limiter, 'chave');
  consume(limiter, 'chave');
  consume(limiter, 'chave');
  const blocked = messageOf(() => consume(limiter, 'chave'));
  assert.equal(blocked.status, 429);
  assert.match(blocked.message, /Muitas tentativas/);

  assert.doesNotThrow(() => consume(limiter, 'outra-chave'), 'uma chave nao pode bloquear a outra');

  limiter.reset('chave');
  assert.doesNotThrow(() => assertNotBlocked(limiter, 'chave'));

  consume(limiter, 'expira');
  consume(limiter, 'expira');
  consume(limiter, 'expira');
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.doesNotThrow(() => consume(limiter, 'expira'), 'depois da janela as tentativas voltam');
});
