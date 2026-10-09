# Fluxy — relatório da auditoria

Resultado em uma linha: o projeto **não estava "tudo certo"**. Havia falhas
reais de segurança e de funcionamento, que foram corrigidas no código e
cobertas por testes. Está pronto para homologação; para produção faltam os
itens da seção H.

## A. Problemas encontrados

Todos os itens abaixo foram reproduzidos na versão original antes da correção.

| # | Problema | Risco / impacto |
|---|---|---|
| 1 | `GET /%00` derrubava o servidor inteiro (exceção não tratada no servidor de arquivos) | Crítico: qualquer visitante, sem login, tirava o sistema do ar com uma requisição |
| 2 | Recuperação de senha por pergunta de segurança; nenhum envio de e-mail existia | Alto: resposta adivinhável dava acesso à conta; o prompt pedia e-mail |
| 3 | "Esqueci minha senha" devolvia a pergunta cadastrada | Alto: revelava se o e-mail tinha conta e qual era a pergunta |
| 4 | Login sem limite de tentativas (12 erros seguidos, todos aceitos) | Alto: força bruta de senha |
| 5 | CORS aberto (`*`) e nenhum cabeçalho de segurança | Médio: qualquer site podia chamar a API local; sem proteção contra XSS/clickjacking |
| 6 | O navegador guardava o hash da senha (SHA-256 sem salt) e da resposta de segurança; se o servidor recusasse o login, o site tentava entrar "localmente" | Alto: quem acessasse o navegador obtinha material para quebrar a senha; senha antiga continuava "entrando" |
| 7 | Ao sair, os dados da empresa ficavam no navegador e apareciam para a próxima conta que entrasse | Alto: vazamento entre contas no mesmo computador |
| 8 | Botões que fingiam funcionar: "Alterar senha", "Encerrar sessões", "Excluir conta", "2FA", "Salvar perfil" mostravam sucesso sem fazer nada no servidor; "Alterar foto" e o sino não tinham ação; "Lembrar acesso" era ignorado | Alto: a pessoa achava que trocou a senha ou excluiu a conta |
| 9 | Sem conexão, o registro era "salvo" só na tela e sumia na sincronização seguinte | Alto: perda silenciosa de dados |
| 10 | Erros de dados viravam erro 500: CNPJ vazio em duas empresas, código de produto repetido, data inválida, nome numérico | Médio: telas falhando com "erro interno"; configurações mostravam "salvas" sem salvar |
| 11 | Produto recusado deixava fornecedor órfão; cadastro de conta não era atômico | Médio: lixo no banco |
| 12 | Datas mudavam de dia quando o servidor estava em fuso a leste de UTC (2026-08-01 voltava 2026-07-31); no navegador "hoje" virava amanhã após as 21h | Médio: vencimentos errados |
| 13 | "Registrar saída" abria o formulário mostrando "Entrada" e sem opção de trocar; calendário pulava meses (31/jan → março) e as setas não andavam por dia | Médio |
| 14 | JSON inválido era tratado como `{}`; corpo grande demais deixava a requisição pendurada; excluir registro inexistente respondia "ok" | Baixo/médio |
| 15 | E-mails dos usuários gravados no log; `/health` devolvia a mensagem de erro do banco | Médio: dados pessoais e detalhes internos expostos |
| 16 | Chart.js carregado de CDN sem versão fixa; 4 ícones usados só existem no Font Awesome pago (apareciam vazios) | Médio: código de terceiros mutável rodando com acesso ao token |
| 17 | Tendência do saldo fixa em "12,4%"; "Bom dia" a qualquer hora | Baixo: informação falsa na tela |
| 18 | 11 chamadas à API a cada abertura; arquivos sem cache nem compressão | Desempenho |
| 19 | Backend em C: `/api/company` gravava sem login; o site inteiro respondia 403 quando iniciado por `./fluxy-api` | Alto (no backend de estudo) |

## B. Correções realizadas

**Backend (`backend/src`)**
- `server.js` — toda requisição protegida contra exceção; cabeçalhos de segurança e CSP; CORS só para origens listadas em `CORS_ORIGINS`; encerramento limpo.
- `static-server.js` — recusa caminhos malformados; ETag/304, gzip, só GET/HEAD.
- `config.js` — `NODE_ENV`, `APP_URL`, SMTP, `CORS_ORIGINS`, `TRUST_PROXY`; em produção exige configuração de banco.
- `routes/auth.js` — cadastro sem pergunta de segurança e em transação; login com limite de tentativas e "manter conectado"; pedido, validação e uso do link de redefinição; rota da pergunta desativada (410).
- `routes/account.js` (novo) — perfil, troca de senha, encerrar outras sessões, histórico de acessos, exclusão de conta.
- `routes/sync.js` (novo) — carga inicial em uma chamada.
- `routes/data.js`, `routes/company.js` — validação de todos os campos, exclusão com 404, módulos gravados em uma consulta, CNPJ vazio vira NULL.
- `routes/index.js` — erros do banco convertidos em 400/409/503 sem detalhes internos.
- `lib/smtp.js`, `lib/mailer.js` (novos) — envio de e-mail por SMTP, sem dependência nova.
- `lib/rate-limit.js`, `lib/validation.js`, `lib/maintenance.js` (novos); `lib/security.js` (scrypt assíncrono, regra de senha); `lib/db.js` (datas); `lib/lookups.js` (dentro da transação); `lib/logger.js`, `lib/http-helpers.js`, `lib/auth-middleware.js`.
- `scripts/testar-email.js` (novo) — `npm run mail:test`.

**Banco** — `schema.sql`: só comentários (nenhuma coluna alterada, nenhuma migração necessária). `seed.sql`: conta de exemplo sem pergunta de segurança.

**Frontend**
- `index.html` — cadastro sem pergunta/resposta; tela "Recuperar acesso" por e-mail; sem script embutido; rótulos de acessibilidade; ícones corrigidos; Chart.js local; Font Awesome com verificação de integridade.
- `js/core/auth.js` — reescrito: nada de senha/hash de contas do servidor no navegador; modo local com PBKDF2.
- `js/core/api.js`, `state.js`, `sync.js`, `session.js`, `modal.js`, `js/app.js` — sessão por aba ou lembrada, aviso de sessão expirada e de falta de conexão, gravações bloqueadas sem servidor, botões com estado de carregamento, ações reais de conta.
- `js/modules/*` — sem `onclick` embutido, tendência real, gráfico reaproveitado, tabela em blocos de 100, calendário e CSV corrigidos.
- `css/global.css`, `css/login.css` — estilos de mensagem, foco pelo teclado, botão desabilitado, `textarea`, modal com rolagem, fontes com alternativa.
- Removidos: `js/modules/meta/*` (variáveis sem uso), bloco "Cadastre sua empresa" que nunca era exibido, botão "Alterar foto" sem função.

**Backend em C** — cadastro sem pergunta; `/api/company` exige login; arquivos do site voltam a ser servidos; CORS aberto removido; e-mail fora do log.

**Arquivos de configuração alterados**
- `package.json` — scripts `test`, `check`, `mail:test`; Node mínimo 18.17 (os testes usam recursos dessa versão).
- `backend/.env.example` — variáveis novas e senha de exemplo trocada por `SUA_SENHA`.

**Mudanças de comportamento que você vai notar**
- Depois do cadastro a pessoa já entra no painel (antes voltava para o login).
- Sem marcar "Manter conectado", a sessão dura 12 horas e vale só naquela aba; marcando, 30 dias.
- O e-mail do perfil não é mais editável (antes a edição só mudava a tela, não o login).
- O CSV passa a usar `;` e vírgula decimal, que é o que o Excel em português abre corretamente.
- "Dashboard" saiu da lista de módulos desligáveis (desligá-lo deixava a tela em branco).

## C. Segurança

| Verificado | Situação |
|---|---|
| Autenticação e sessão | Corrigido: limite de tentativas, token só como hash no banco, logout/troca/redefinição revogam sessões |
| Autorização | Todas as rotas de dados exigem login e filtram por empresa; testado com duas empresas |
| Injeção de SQL | Sem problema: todas as consultas usam parâmetros |
| XSS | Saída já era escapada; adicionada CSP sem script embutido |
| CSRF | Não se aplica: a API usa cabeçalho `Authorization`, não cookies |
| Armazenamento de senha | scrypt com salt (já era); hashes antigos continuam válidos |
| Segredos | Nenhum no código; `.env` fora do Git; logs sem e-mail, token ou senha |
| Validação de entrada | Corrigido em todas as rotas |
| CORS e cabeçalhos | Corrigido |
| Dependências | Única dependência: `pg`. Chart.js fixado na versão 4.5.1 e servido localmente |

**Ainda precisa de atenção**
- O token da sessão fica no armazenamento do navegador (não em cookie HttpOnly). A CSP reduz o risco, mas não o elimina.
- O cadastro responde "e-mail já cadastrado", o que revela quem tem conta. Para eliminar seria preciso confirmar o e-mail no cadastro.
- No "Esqueci minha senha" a resposta é idêntica com e sem conta, mas o tempo pode variar um pouco.
- O limite de tentativas vive na memória de um processo; com várias instâncias precisa de armazenamento compartilhado.
- CNPJ é único entre todas as empresas, então a mensagem de CNPJ repetido revela que ele existe.
- Autenticação em duas etapas não existe (a tela agora diz "Em breve").
- Google Fonts e Font Awesome continuam vindo de CDN.
- O backend em C não tem limite de tentativas nem recuperação de senha: use só para estudo.
- `npm audit` não foi executado (o ambiente de teste não acessa o registro do npm). Rode `npm.cmd audit` na sua máquina.

## D. Recuperação de senha

- **Fluxo:** e-mail → link `APP_URL/index.html#redefinir=<token>` → nova senha → login.
- **Token:** 256 bits aleatórios; só o hash SHA-256 vai para o banco; vale 30 minutos; uso único (inclusive com dois usos simultâneos); um novo pedido cancela o anterior; ao usar, todas as sessões caem.
- **Resposta:** igual para e-mail com e sem conta; o link nunca usa o cabeçalho `Host`.
- **Falha de envio:** responde erro 502 e cancela o link; sem SMTP configurado responde 503. Nunca mostra "enviado" sem o servidor de e-mail ter aceitado a mensagem.
- **Testado:** sim, de ponta a ponta, contra um servidor SMTP de teste local (21 testes) e no navegador.
- **Envio real confirmado:** **não**. Não tenho as credenciais do seu provedor. Depois de preencher o `.env`, confirme com `npm.cmd run mail:test -- seu@email.com`.
- **Contas antigas:** continuam entrando; pergunta e resposta guardadas não foram apagadas, apenas deixaram de ser usadas.

## E. Desempenho

Medido no Chromium, mesma base de dados, antes e depois:

| Cenário | Antes | Depois |
|---|---|---|
| Entrar e carregar o painel | 12 chamadas à API, 7,6 KB | 2 chamadas, 3,2 KB |
| Recarregar a página já logada | 34 requisições, 136 KB | 21 requisições, 16 KB (18 respostas 304) |
| Primeira abertura (arquivos do próprio Fluxy) | 129 KB | 51 KB com gzip |

- Chart.js (70 KB compactado) passou do CDN para o próprio servidor, com cache permanente.
- Módulos gravados em 1 consulta em vez de 10; senha calculada sem travar o servidor.
- Não implementado: paginação no servidor (os indicadores do painel são calculados com a lista completa; exigiria rotas de resumo) e empacotamento do JavaScript (o projeto não tem etapa de build).

## F. Testes

**Executados e aprovados**
- `npm test`: **102 de 102** — unidade (10), cliente SMTP (16), API (35), recuperação de senha (21), segurança (20). Rodados com Node 22 e PostgreSQL 16 reais.
- `npm run verify`: 11 de 11. `npm run check`: 45 arquivos sem erro de sintaxe.
- Navegador (Chromium), fora da suíte do projeto: 51 verificações do fluxo com servidor, 16 do modo local, 9 de múltiplas abas e link colado; sem erro de console nem violação de CSP.
- Backend em C: compilado com `gcc -Wall -Wextra` sem avisos e conferido por `curl`.
- Revisão independente do código final; os achados válidos foram corrigidos e ganharam teste.

**Falharam:** nenhum na versão final.

**Dependem de configuração externa / não executados**
- Entrega real de e-mail (credenciais SMTP).
- `npm audit` (acesso ao registro do npm).
- Linter e build: o projeto não tem ESLint nem etapa de build; não foram adicionados.
- Execução no Windows e no Node 24: não testado aqui.
- Observação: o driver `pg` usado nos testes foi a versão 8.13.1 obtida do repositório oficial, porque o registro do npm não estava acessível.

## G. Configurações pendentes

Em `backend/.env` (modelo em `backend/.env.example`):

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | conexão com o PostgreSQL (você já usa) |
| `APP_URL` | endereço do site que entra no link do e-mail (local: `http://localhost:8080`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | servidor de e-mail do provedor |
| `SMTP_USER`, `SMTP_PASS` | login do provedor (no Gmail, "senha de app") |
| `MAIL_FROM` | remetente, ex.: `Fluxy <voce@dominio.com.br>` |
| `NODE_ENV=production`, `TRUST_PROXY=true` | apenas no servidor publicado |
| `CORS_ORIGINS` | apenas se o site ficar em endereço diferente da API |

Passos: `npm.cmd install` → copiar o seu `backend/.env` atual para a pasta nova e acrescentar as variáveis acima → `npm.cmd run db:migrate` → `npm.cmd start`. O banco existente não precisa de migração.

## H. Estado final

- **Homologação:** pronto.
- **Produção:** ainda não. Impedimentos: (1) confirmar o envio real de e-mail; (2) publicar atrás de HTTPS; (3) rodar `npm.cmd audit`; (4) decidir sobre os itens de "ainda precisa de atenção" da seção C; (5) LGPD: publicar política de privacidade e definir por quanto tempo o histórico de acessos é guardado (exclusão de conta e exportação de dados já funcionam).
