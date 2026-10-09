# Fluxy — como abrir no VS Code

O Fluxy grava tudo (clientes, fornecedores, produtos, financeiro, agenda...)
num banco **PostgreSQL**. São 3 passos: instalar o PostgreSQL, configurar o
`.env`, rodar o projeto.

> **Windows (PowerShell):** se aparecer o erro "npm.ps1 não está assinado
> digitalmente", use `npm.cmd` no lugar de `npm` em todos os comandos abaixo
> (ex.: `npm.cmd install`, `npm.cmd start`).

## 1. Instalar o PostgreSQL (se ainda não tiver)

- Windows/macOS: https://www.postgresql.org/download/ (instalador oficial,
  marque "pgAdmin" se quiser uma interface gráfica).
- Linux (Debian/Ubuntu): `sudo apt install postgresql`

Anote a senha que você definir para o usuário `postgres` durante a instalação.

## 2. Configurar o projeto

No terminal do VS Code, dentro da pasta `fluxy/`:

```bash
npm install
cp backend/.env.example backend/.env      # Windows: copy backend\.env.example backend\.env
```

Abra `backend/.env` e troque `SUA_SENHA` pela senha do PostgreSQL:

```
DATABASE_URL=postgres://postgres:SUA_SENHA@localhost:5432/fluxy_db
```

Crie o banco (uma vez só):

```bash
createdb -U postgres fluxy_db
```

Se `createdb` não for reconhecido, abra o **pgAdmin** ou o **SQL Shell
(psql)** que vêm com o instalador e rode `CREATE DATABASE fluxy_db;`.

## 3. Criar as tabelas e rodar

```bash
npm run db:migrate    # cria as tabelas (pode rodar de novo sem problema)
npm run db:seed       # opcional: adiciona uma empresa de teste com dados
npm start             # sobe o Fluxy em http://localhost:8080
```

O navegador abre sozinho. Se você rodou `npm run db:seed`, já existe uma
conta de teste (use só no seu computador, a senha é pública):

- e-mail: `mariana@padariasaojose.com.br`
- senha: `Senha1234`

Ou clique em **Cadastre-se** e crie sua própria conta — cada conta nova já
ganha sua empresa e todos os módulos ligados.

> **Nunca abra `frontend/index.html` com dois cliques.** Isso usa `file://`
> e o Fluxy entra no modo local, sem banco de dados. Sempre use `npm start`
> e acesse `http://localhost:8080`.

## Recuperação de senha por e-mail

Em "Esqueci minha senha" a pessoa informa o e-mail e recebe um link para
criar uma nova senha. O link vale por 30 minutos, funciona uma única vez e,
ao ser usado, encerra todas as sessões abertas da conta. A tela responde a
mesma coisa para e-mails com e sem cadastro.

Para o envio funcionar, preencha no `backend/.env` os dados do seu provedor
de e-mail (o `.env.example` explica cada variável):

```
APP_URL=http://localhost:8080
SMTP_HOST=smtp.seuprovedor.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu-email@seudominio.com.br
SMTP_PASS=sua-senha-ou-senha-de-app
MAIL_FROM=Fluxy <seu-email@seudominio.com.br>
```

No Gmail, `SMTP_HOST=smtp.gmail.com` e `SMTP_PASS` precisa ser uma "senha de
app" (a senha normal da conta não funciona). Para conferir o envio de
verdade:

```bash
npm run mail:test -- seu-email@exemplo.com
```

Sem SMTP configurado, a tela avisa que a recuperação está indisponível —
nunca mostra "enviado" sem o provedor ter aceitado a mensagem. Para testar o
fluxo no seu computador sem provedor, use `MAIL_MODE=console`: nada é
enviado e o link aparece no terminal do servidor.

A antiga pergunta de segurança foi desativada. Contas criadas antes
continuam entrando normalmente e os dados antigos permanecem no banco, mas
não são mais usados.

## Estrutura do projeto

```
fluxy/
├── frontend/              # aplicação (SPA) servida ao navegador
│   ├── index.html
│   ├── css/
│   ├── vendor/              # Chart.js (versão fixa, servida pelo próprio Fluxy)
│   └── js/
│       ├── core/            # API, estado, login, sessão, sincronização, modal
│       └── modules/         # uma tela por módulo (dashboard, financeiro, ...)
├── backend/
│   ├── src/                # API Node.js
│   │   ├── routes/           # auth, conta, empresa/módulos, carga inicial, dados
│   │   └── lib/              # banco, segurança, validação, e-mail, limite de tentativas
│   ├── scripts/             # teste de envio de e-mail
│   ├── c/                   # API de autenticação em C (opcional, para estudo)
│   ├── database/
│   │   ├── schema.sql         # cria todas as tabelas (idempotente)
│   │   ├── seed.sql           # dados de exemplo (opcional)
│   │   └── migrate.js         # script que aplica os dois acima
│   ├── .env.example
│   └── logs/
├── docs/                   # notas de arquitetura e do processo de refatoração
└── tests/                  # testes automatizados contra o servidor real
```

## O que o sistema guarda no banco

Todas as telas do Fluxy leem e gravam no PostgreSQL: empresa, usuários e
sessões, clientes, fornecedores, produtos e movimentações de estoque,
transações (entradas/saídas), contas a pagar/receber, serviços prestados,
eventos da agenda, categorias, módulos ativos e preferências. Cada empresa só
enxerga os próprios dados (`empresa_id` em cada tabela).

O navegador guarda apenas o token da sessão e uma cópia dos dados para a
tela abrir rápido. Se o servidor não responder, o Fluxy mostra essa cópia
com um aviso e **bloqueia gravações** até a conexão voltar — nada é salvo
"só na tela". Ao sair, a cópia é apagada.

## Requisitos

- Node.js 18.17 ou superior (recomendado: 20 ou mais recente): https://nodejs.org
- PostgreSQL 14 ou superior: https://www.postgresql.org/download/

## Comandos úteis

```
npm install          # instala o driver do PostgreSQL (só na primeira vez)
npm run db:migrate   # cria/atualiza as tabelas
npm run db:seed      # cria as tabelas + insere uma empresa de exemplo
npm start            # inicia o Fluxy (frontend + API), porta 8080
npm test             # suíte completa de testes (precisa do PostgreSQL configurado)
npm run verify       # conferência rápida: sobe, cadastra, entra e apaga a conta de teste
npm run check        # confere a sintaxe de todos os arquivos JavaScript
npm run mail:test -- voce@exemplo.com   # envia um e-mail de teste pelo SMTP configurado
```

Senha válida: de 8 a 128 caracteres, com maiúscula, minúscula e número (ex.:
`Senha1234`). A regra é conferida no navegador e no servidor.

## Testes

`npm test` sobe o servidor de verdade em uma porta livre, usa o PostgreSQL
do `backend/.env` e um servidor de e-mail de mentira (nada sai para a
internet). As contas criadas pelos testes usam o domínio
`@teste.fluxy.invalid` e são apagadas no final. Se o banco não estiver
configurado, só os testes que não dependem dele rodam e o resumo avisa quais
ficaram de fora.

## Publicar em produção

- `NODE_ENV=production`, `DATABASE_URL` e `APP_URL` (endereço público com
  `https://`) são obrigatórios; `SMTP_*` e `MAIL_FROM` ativam a recuperação
  de senha.
- O Fluxy fala HTTP. Coloque-o atrás de um proxy ou plataforma com HTTPS
  (Nginx, Render, Railway...) e ligue `TRUST_PROXY=true`.
- O limite de tentativas de login fica na memória do processo: funciona com
  uma instância. Com várias, é preciso um armazenamento compartilhado.
- Faça backup do PostgreSQL (`pg_dump fluxy_db > backup.sql`) antes de
  atualizar. O `schema.sql` só cria o que falta; nada é apagado.
- Nunca rode `npm run db:seed` em produção.

## Apagar todos os dados

```bash
psql -U postgres -c "DROP DATABASE fluxy_db;" -c "CREATE DATABASE fluxy_db;"
npm run db:migrate
```

Para apagar só uma conta, use **Meu perfil → Conta → Excluir conta
permanentemente**: a conta, a empresa e todos os registros dela são
removidos do banco (pede a senha para confirmar).

## Modo local (sem servidor)

Aberto por `file://` ou em hospedagem só de arquivos (GitHub Pages), o Fluxy
funciona como demonstração: contas e dados ficam apenas naquele navegador,
com a senha protegida por PBKDF2. Nesse modo não há envio de e-mail, então
não existe recuperação de senha.

## Backend em C

A pasta `backend/c/` traz a API de autenticação reescrita em C, com seu
próprio armazenamento de usuários em arquivo (`backend/c/LEIA-ME.md` explica
a estrutura). Ela não usa o PostgreSQL, não tem as rotas de dados nem envio
de e-mail — é uma versão independente, só para estudo. O backend Node é o
recomendado para uso normal.

## Migração automática (se você já usava o nome antigo)

O projeto se chamava "Skina" antes desta reorganização. As chaves antigas de
`localStorage` do navegador (`skina_token`, etc.) continuam sendo copiadas
automaticamente para as novas (`fluxy_token`, etc.) na primeira execução.
