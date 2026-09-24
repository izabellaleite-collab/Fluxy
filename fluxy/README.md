# Fluxy — como abrir (1 passo)

1. Dê **dois cliques em `INICIAR-FLUXY.bat`** (Windows) ou rode `./iniciar-fluxy.sh` (Linux/macOS).
2. O navegador abre sozinho em **http://localhost:8080**.
3. Clique em **Cadastre-se**, crie a conta, e você volta para a tela de login já com o e-mail preenchido.
4. Entre com e-mail e senha. Pronto.

> **Nunca abra `frontend/index.html` com dois cliques.** Isso usa `file://`, o
> navegador bloqueia as chamadas para a API e aparecem os erros `Failed to
> fetch`, `ERR_CONNECTION_REFUSED` e `Unsafe attempt to load URL file:///...`.
> Se fizer isso, uma faixa vermelha avisa você no topo da tela.

## Estrutura do projeto

```
fluxy/
├── frontend/            # aplicação (SPA) servida ao navegador
│   ├── index.html
│   ├── pages/            # atalhos de compatibilidade (redirecionam para index.html#secao)
│   ├── css/
│   ├── js/
│   │   ├── core/          # estado, sessão, modal, cliente de API, autenticação
│   │   └── modules/        # uma tela por módulo (dashboard, financeiro, ...)
│   └── assets/
├── backend/
│   ├── src/              # API Node.js (servidor padrão, sem dependências)
│   ├── c/                 # a mesma API reescrita em C (opcional, veja backend/c/LEIA-ME.md)
│   ├── database/          # banco local em arquivo (criado ao rodar)
│   └── logs/
├── docs/                 # notas de arquitetura e do processo de refatoração
└── tests/                 # teste de ponta a ponta contra o servidor real
```

## O que o sistema oferece

- **Zero dependências externas.** Só precisa de Node.js 18+ — sem `npm install`,
  sem `express`, sem `cors`, sem driver de banco.
- **Um servidor só** (`backend/src/index.js`), na porta 8080, servindo o site e
  a API na **mesma origem** — sem problema de CORS entre portas diferentes.
- **Banco local em arquivo**: `backend/database/data/fluxy-data.json` (senhas
  com scrypt).
- **Cadastro nunca trava**: se por algum motivo a API não responder, a conta é
  criada localmente no navegador e o login continua funcionando.
- **Clicar na marca Fluxy** (logo do topo/menu) sempre volta para a tela
  inicial: painel, se você estiver logado; tela de login, se não estiver.
- **Sessão persistente**: ao recarregar a página você continua logado.
- Se a porta 8080 já estiver ocupada, o script entende que o Fluxy já está no
  ar, abre o navegador e não derruba nada.

## Requisitos

Node.js 18 ou superior: https://nodejs.org

## Comandos úteis

```
node backend/src/index.js   # inicia tudo
npm start                    # mesma coisa
npm run verify                # teste real: sobe, cadastra, loga e confere
```

Senha válida: mínimo 8 caracteres, com maiúscula, minúscula e número (ex.: `Senha1234`).

## Apagar todos os usuários

Apague o arquivo `backend/database/data/fluxy-data.json` e, no navegador,
`F12 → Application → Local Storage → limpar`.

## Recuperação de senha

No cadastro existe uma **pergunta de segurança** obrigatória. A resposta é
gravada com hash (nunca em texto claro) e comparada ignorando maiúsculas e
espaços extras.

Na tela "Esqueci minha senha", tudo acontece dentro da própria aplicação, sem
depender de e-mail: informe o e-mail da conta, responda a pergunta de
segurança cadastrada e defina a nova senha na hora. O token de validação é de
uso único e todas as sessões abertas daquele usuário são encerradas após a
troca.

## Banco de dados

Já vem pronto, sem instalar nada: `backend/database/data/fluxy-data.json`,
gravado pelo próprio servidor (escrita atômica, senhas com scrypt + salt).
Não é SQLite nem MySQL de propósito — um servidor de banco separado exigiria
instalação e serviço rodando, o que quebraria o "dois cliques e funciona". Se
um dia o sistema for para um servidor de verdade, o ponto de troca é só as
funções `loadDb`/`saveDb` em `backend/src/lib/database.js`.

## Backend em C

A pasta `backend/c/` traz o backend inteiro reescrito em C, com a mesma API e
o mesmo frontend (`backend/c/LEIA-ME.md` explica a estrutura de arquivos).
Foi compilado (sem avisos, `-Wall -Wextra`) e testado de ponta a ponta:
cadastro, login, `/api/me`, pergunta de segurança, redefinição de senha e
persistência dos dados após reiniciar o processo.

**Aviso honesto sobre o C**: ele não substitui o Node por padrão, e o motivo é
prático, não técnico. Um `.c` não roda sozinho — precisa ser compilado, e o
Windows não vem com compilador. Para usar essa versão você precisaria
instalar o MinGW-w64 (~500 MB) em cada máquina, ou receber um `.exe`
pré-compilado, que o Windows Defender costuma bloquear por vir de origem
desconhecida. Fora isso, **C não deixa o sistema mais seguro aqui**: a
segurança depende de hash de senha, token de sessão e validação de entrada —
que já estão feitos igualmente nos dois backends. C na verdade adiciona um
risco que o JavaScript não tem (estouro de buffer, uso de memória liberada).
Por isso a recomendação é manter o Node como padrão e usar a versão em C só
se você quiser mesmo, tiver compilador na máquina e aceitar o trade-off.

## Migração automática (se você já usava o nome antigo)

O projeto se chamava "Skina" antes desta reorganização. Para quem já tinha
uma instalação rodando, os dados antigos são migrados automaticamente, uma
única vez, na primeira execução — nada precisa ser feito manualmente:

- `localStorage` do navegador: as chaves antigas (`skina_token`, etc.) são
  copiadas para as novas (`fluxy_token`, etc.).
- Banco do backend Node: `skina-data.json` é copiado para `fluxy-data.json`.
- Banco do backend em C: `skina-users.db` é copiado para `fluxy-users.db`.
