# Refatoração: de "Skina" para Fluxy

Este documento resume o que foi feito na reorganização do projeto. O
objetivo em todo o trabalho foi o mesmo: **nada de comportamento mudou**
— o que mudou foi a forma como o código está organizado, nomeado e
formatado. Toda mudança abaixo foi verificada (não só revisada) antes de
ser aceita como equivalente ao original.

## Por que reorganizar

O projeto original funcionava, mas tinha sinais de código gerado
rapidamente: um arquivo JavaScript de ~35 KB com tudo dentro (estado,
autenticação, siete telas diferentes), CSS com regras espalhadas sem
critério, HTML em uma única linha por bloco, e um backend em C com
arrays globais compartilhados por todo o arquivo. Nada disso é um "bug",
mas dificulta manutenção: para mudar uma tela era preciso entender o
arquivo inteiro.

## Frontend

### HTML

`frontend/index.html` foi reformatado com um pretty-printer que constrói
uma árvore do documento e a reimprime com indentação de 2 espaços,
preservando exatamente a mesma estrutura de tags e atributos. A
equivalência foi verificada removendo espaços em branco dos dois lados
(original e reformatado) e comparando byte a byte — o resultado é
idêntico.

Além da formatação, foram adicionados comentários de seção antes de cada
bloco principal (`<section id="dashboard">`, `<section id="financeiro">`
etc.) para facilitar a navegação em um arquivo que ainda é grande por
natureza (é uma SPA de página única).

### CSS

`global.css` tinha 226 regras em uma ordem que não seguia nenhum critério
visível. Elas foram reagrupadas em 18 seções nomeadas (tokens de design,
reset, autenticação, formulários e botões, layout do app, barra superior,
KPIs, painéis do dashboard, tabelas, cartões de conta, agenda, calendário,
relatórios, configurações, perfil, modal/toast e os blocos responsivos),
cada uma com um comentário de cabeçalho.

A verificação aqui foi por multiconjunto: cada regra do CSS original e do
reformatado foi reduzida a uma tupla (contexto de `@media`, conjunto de
seletores, conjunto de declarações) e as duas listas foram comparadas
ignorando ordem. Resultado: as 226 regras batem, uma a uma — nenhuma foi
perdida, duplicada ou alterada.

Os arquivos por tela (`login.css`, `estoque.css`, `calendario.css`,
`perfil.css`) foram mantidos como estavam, já que já eram pequenos e
focados.

### JavaScript

O arquivo único de ~35 KB foi dividido por responsabilidade:

- **`js/core/`** — o que toda tela precisa: `state.js` (estado global e
  helpers como `$`, `money`, `date`), `session.js` (login/logout e
  navegação entre seções), `modal.js` (abrir/fechar/salvar os
  formulários), `api.js` (cliente HTTP para o backend) e `auth.js`
  (cadastro, login, recuperação de senha).
- **`js/modules/`** — uma tela por arquivo: `dashboard.js`,
  `financeiro.js`, `cadastros.js` (clientes/estoque/serviços/
  fornecedores), `agenda-calendario.js`, `relatorios-config.js`.
- **`js/app.js`** — o ponto de entrada: liga os eventos de navegação,
  formulários e inicializa a aplicação.

Nenhuma função foi reescrita de forma diferente — o corpo de cada função
foi movido, não reinventado. A verificação foi `node --check` em cada
arquivo individualmente e depois nos 13 arquivos concatenados na mesma
ordem em que o HTML os carrega, confirmando que o resultado é
sintaticamente idêntico a um único script.

## Backend Node.js

O arquivo único `skina.js` (423 linhas) virou:

```
backend/src/
├── config.js              # caminhos, porta, tipos MIME
├── index.js                # ponto de entrada (chama server.js)
├── server.js                # servidor HTTP e o loop de abrir o navegador
├── static-server.js          # serve os arquivos de frontend/
├── lib/
│   ├── logger.js              # log padronizado com prefixo [Fluxy]
│   ├── database.js             # carregar/salvar o banco em arquivo
│   ├── security.js              # hash de senha, criação de sessão
│   └── http-helpers.js            # ler corpo da requisição, responder JSON
└── routes/
    ├── index.js                # despacha /api/* para as rotas certas
    ├── auth.js                  # registro, login, recuperação de senha
    └── company.js                 # dados da empresa
```

Testado com o servidor real: subido em uma porta de teste, com chamadas
HTTP de verdade (`curl`) para cadastro, login, arquivos estáticos e uma
rota inexistente (404) — e conferindo que o arquivo de banco em disco
ficou com o usuário e a sessão esperados.

## Backend em C

`c-backend/skina_api.c` (687 linhas, tudo em um arquivo, com arrays
globais como `users[]` e `sessions[]` acessados de qualquer lugar) virou:

```
backend/c/
├── include/        # a interface (.h) de cada módulo
└── src/             # a implementação (.c) de cada módulo, mais main.c
```

Os módulos são: `platform` (diferenças Windows/POSIX em um único lugar),
`sha256` (hash e geração de tokens), `json_util` (leitura/escrita mínima
de JSON), `app_paths` (onde ficam os arquivos), `user_store` (usuários em
disco), `session_store` (sessões e tokens em memória), `http_response`
(respostas HTTP), `static_files` (arquivos estáticos) e `routes` (as
rotas da API).

A mudança estrutural mais importante foi trocar os arrays globais por
estado `static` de arquivo, acessível só através de funções (`user_store_*`,
`session_store_*`, `app_*`) — nenhum outro arquivo do projeto enxerga o
array `users[]` diretamente, então adicionar um campo ou mudar o formato
de armazenamento não exige caçar todo lugar que mexe nele.

Durante a divisão, um bug legado foi corrigido: a compilação para Windows
chamava `_mkdir` sem incluir `<direct.h>`, o que não compilava. Isso não é
uma mudança de comportamento — é a mesma criação de pasta que já existia,
só que agora ela realmente compila no Windows.

O backend foi recompilado do zero com `gcc -std=c11 -Wall -Wextra -O2` —
zero avisos — e testado com um servidor real: cadastro, login, sessão,
pergunta de segurança, redefinição de senha e persistência dos dados após
reiniciar o processo.

## Renomeação Skina → Fluxy

O nome mudou em toda parte visível ao usuário (título da página, marca no
menu, avatar de perfil, textos de configurações) e em todo identificador
interno (nomes de arquivo, variáveis de ambiente, chaves de
armazenamento). Para não quebrar uma instalação que já existia com dados
salvos sob o nome antigo, três migrações automáticas foram adicionadas —
cada uma roda uma única vez, na primeira execução após a atualização, e
nunca apaga o arquivo/chave antigo:

1. `localStorage` do navegador (`skina_token` → `fluxy_token`, etc.)
2. Banco do backend Node (`skina-data.json` → `fluxy-data.json`)
3. Banco do backend em C (`skina-users.db` → `fluxy-users.db`)

## Estrutura final de pastas

```
frontend/
├── pages/       # atalhos de compatibilidade (redirecionam para index.html#secao)
├── assets/
├── css/
├── js/
│   ├── core/
│   └── modules/
backend/
├── src/          # API Node.js
├── c/             # API em C (opcional)
├── database/
├── logs/
docs/
tests/
```

## Recuperação de senha: só dentro do app

A recuperação de senha por link de e-mail foi removida: o envio dependia de
configurar um servidor SMTP externo (`backend/config/email.json`), e sem essa
configuração o e-mail simplesmente não saía. Isso tornava o fluxo padrão não
funcional para quem não configurasse SMTP.

O fluxo agora é só um: informar o e-mail, responder a pergunta de segurança
cadastrada no cadastro e definir a nova senha — tudo dentro da própria
aplicação, sem depender de nenhum serviço externo. `backend/src/lib/mailer.js`
e o passo de escolha entre "link por e-mail" ou "pergunta de segurança" na
tela de recuperação (`frontend/index.html` e `frontend/js/core/auth.js`)
foram removidos.

## Banco de dados PostgreSQL (substitui o arquivo JSON e o localStorage)

As duas seções acima ("Backend Node.js" e a migração `skina-data.json` →
`fluxy-data.json`) descrevem uma etapa anterior, em que o backend Node
gravava tudo num arquivo JSON local e todo o resto (clientes, produtos,
financeiro, agenda...) vivia só no `localStorage` do navegador — sem sair da
máquina de quem estava usando.

Essa etapa foi substituída por um banco PostgreSQL de verdade:

- `backend/src/lib/database.js` (o arquivo JSON) foi removido.
  `backend/src/lib/db.js` entra no lugar: um pool de conexões (`pg`) com
  duas funções, `query()` e `withTransaction()`, usadas por todas as rotas.
- `backend/database/schema.sql` cria as 17 tabelas do sistema (empresa,
  usuário, sessão, cliente, fornecedor, produto, movimentação de estoque,
  transação, conta, serviço, evento de agenda, categoria, módulos e
  configurações) com chaves estrangeiras, `CHECK`s e índices. É idempotente
  — pode ser aplicado de novo sem apagar nada.
- `backend/database/seed.sql` insere uma empresa de exemplo (opcional).
  `backend/database/migrate.js` aplica os dois via `npm run db:migrate` /
  `npm run db:seed`.
- `backend/src/routes/auth.js` e `company.js` foram reescritos para consultar
  o banco em vez do arquivo JSON. Um arquivo novo,
  `backend/src/routes/data.js`, adiciona as rotas REST que faltavam:
  clientes, fornecedores, produtos, movimentações de estoque, transações,
  contas, serviços e eventos — cada uma sempre filtrada pela empresa do
  usuário logado (multiempresa: uma conta nunca vê os dados de outra).
- No frontend, `frontend/js/core/sync.js` é novo: ao entrar no painel, ele
  busca as 8 coleções de dados da API de uma vez e substitui o que estava no
  `localStorage`. `core/modal.js` (salvar/remover registros) e
  `core/session.js` (`start()`) foram ajustados para chamar a API primeiro;
  se a API não responder, o comportamento antigo (só local) continua valendo
  como reserva, para o sistema nunca travar.
- Texto livre que a tela sempre tratou como string solta — categoria e
  cliente numa transação, fornecedor num produto — agora vira uma referência
  de verdade (`categoria_id`, `cliente_id`, `fornecedor_id`), criando o
  cadastro na hora se ele ainda não existir. É uma melhoria de modelagem, não
  uma mudança de comportamento: quem usa o sistema continua só digitando um
  nome no campo.

Testado de ponta a ponta com o servidor e o banco reais: schema aplicado,
dados de exemplo inseridos, todas as rotas exercitadas via `curl` (login,
CRUD de cada entidade, movimentação de estoque com estoque insuficiente,
troca de status de conta, recuperação de senha) e, por cima disso, um teste
de navegador de verdade (Playwright) fazendo login pela tela, cadastrando
registros pelos modais e confirmando que os dados sobrevivem a um F5 — ou
seja, vieram do banco, não só da memória da página.

## Revisão de segurança e desempenho

Esta etapa substituiu a recuperação por pergunta de segurança (descrita
acima) por um link enviado por e-mail e fechou os pontos encontrados na
auditoria:

- **Senha:** link de redefinição por e-mail (SMTP próprio em
  `backend/src/lib/smtp.js`), com token guardado só como hash, validade de
  30 minutos e uso único. As colunas `pergunta_seguranca` e
  `resposta_seguranca_hash` continuam no banco, sem uso.
- **Proteção:** limite de tentativas em login, cadastro e recuperação;
  CORS fechado por padrão; cabeçalhos de segurança e CSP sem script
  embutido; validação central dos dados (`lib/validation.js`); erros do
  banco convertidos em mensagens 4xx sem detalhes internos.
- **Conta:** rotas reais para trocar senha, encerrar outras sessões, editar
  perfil, ver acessos e excluir a conta (`routes/account.js`).
- **Navegador:** nenhuma senha ou hash de contas do servidor fica no
  `localStorage`; sem conexão, as gravações são bloqueadas em vez de
  ficarem só na tela.
- **Desempenho:** `GET /api/sync` troca 11 chamadas por 1 na abertura do
  painel; arquivos estáticos com ETag (304) e gzip; Chart.js servido
  localmente em versão fixa.
- **Testes:** `npm test` (unidade, API, recuperação de senha, segurança e
  cliente SMTP).

