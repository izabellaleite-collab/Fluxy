# Testes do Fluxy

Rode com `npm test` (no PowerShell do Windows: `npm.cmd test`).

Os testes sobem o servidor de verdade em uma porta livre e falam com ele por
HTTP, gravando no PostgreSQL configurado em `backend/.env`. O envio de e-mail
é testado contra um servidor SMTP de mentira que roda na própria máquina —
nenhum e-mail sai para a internet. As contas criadas usam o domínio
`@teste.fluxy.invalid` e são apagadas no final.

| Arquivo | O que cobre | Precisa do PostgreSQL |
|---|---|---|
| `unidade.test.js` | regra de senha, hash, tokens, validações, limite de tentativas | não |
| `smtp.test.js` | cliente SMTP: entrega, login, STARTTLS, TLS direto, falhas e tempo esgotado | não (os 3 testes de TLS pedem o `openssl` instalado) |
| `api.test.js` | cadastro sem pergunta de segurança, login, proteção das rotas, isolamento entre empresas, dados, estoque, configurações, perfil, troca de senha, sessões, exclusão de conta | sim |
| `recuperacao-senha.test.js` | pedido do link, e-mail recebido, token com hash, validade, uso único, uso simultâneo, resposta igual com e sem conta, falhas do provedor | sim |
| `seguranca.test.js` | cabeçalhos, CSP, CORS, endereços malformados, arquivos fora da pasta do site, cache, bloqueio por tentativas, banco fora do ar | sim |

Sem banco configurado, `npm test` roda só os arquivos que não dependem dele
e lista os demais como "não executados".

Outros comandos:

- `npm run verify` — conferência rápida (cadastra, entra, confere a sessão e
  apaga a conta de teste).
- `npm run check` — sintaxe de todos os arquivos JavaScript.
- `npm run mail:test -- voce@exemplo.com` — envia um e-mail real pelo SMTP do
  `backend/.env`. É o único teste que confirma a entrega de verdade.

## O que não é coberto por testes automáticos

- **Entrega real de e-mail:** depende das credenciais do seu provedor. Use
  `npm run mail:test`.
- **Telas no navegador:** conferidas manualmente (cadastro, login,
  recuperação, painel, modais, celular e modo local), sem suíte automática
  dentro do projeto.
- **Backend em C:** compilado com `gcc -Wall -Wextra` e conferido por `curl`
  (cadastro, login, sessão, rota da empresa com e sem login, arquivos
  estáticos).
