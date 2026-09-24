# Testes reais executados

Estes nao sao testes unitarios isolados: o servidor de verdade e iniciado,
as rotas sao chamadas por HTTP e o processo e encerrado no final. E a
forma mais simples de garantir que o fluxo completo (cadastro, login,
sessao, recuperacao de senha e os arquivos estaticos) continua
funcionando depois de qualquer mudanca no codigo.

Ambiente: Node.js 18+, servidor `backend/src/index.js` na porta de teste 8099.

| Teste | Rota | Resultado |
|---|---|---|
| Saude da API | `GET /health` | 200 · `status: ok` |
| Cadastro de usuario | `POST /api/auth/register` | 201 · usuario criado com id |
| Login | `POST /api/auth/login` | 200 · token de sessao retornado |
| Sessao autenticada | `GET /api/me` | 200 |
| Frontend na mesma origem | `GET /index.html` | 200 |

Reproduza com `npm run verify` (ou `node tests/verify-local.js`).

## Backend Node — fluxo de recuperacao de senha

| Teste | Resultado |
|---|---|
| `POST /api/auth/forgot-password` | 200 · devolve a pergunta de seguranca cadastrada |
| `POST /api/auth/answer-question` (resposta certa, com maiusculas e espacos extras) | 200 · token emitido |
| `POST /api/auth/reset-password` | 200 |
| Login com a nova senha | 200 |

## Backend C — compilado com gcc e testado

| Teste | Resultado |
|---|---|
| Compilacao (`gcc -std=c11 -O2 -Wall -Wextra`, `backend/c/build.sh`) | sem erros nem avisos |
| `GET /health` | 200 · `engine: c` |
| `POST /api/auth/register` | 201 |
| Reinicio do processo + login | 200 · dados persistidos em disco (`backend/database/data/fluxy-users.db`) |
| `GET /api/me` com token | 200 |
| Senha incorreta | 401 |
| E-mail duplicado | 409 |
| Pergunta de seguranca (resposta certa / errada) | 200 / 401 |
| `POST /api/auth/reset-password` + login com a nova senha | 200 / 200 |
| Senha antiga apos o reset | 401 |
| Arquivos estaticos (`/index.html`, `/css/global.css`) | 200 / 200 |
| Rota inexistente | 404 |
