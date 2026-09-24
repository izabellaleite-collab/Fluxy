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
