# Backend Fluxy em C (opcional)

Implementacao em C puro da mesma API do backend Node (`backend/src/`):
sockets nativos, SHA-256 escrito a mao, salt aleatorio e 120.000 iteracoes
de hash. Tambem serve o frontend, entao pode substituir o Node por
completo se preferir nao ter o Node.js instalado.

O codigo esta dividido por responsabilidade em vez de um unico arquivo:

```
backend/c/
├── include/        # cabecalhos (.h) - a interface publica de cada modulo
│   ├── platform.h       # abstracao Windows/POSIX (sockets, mkdir)
│   ├── sha256.h          # hash de senha e geracao de tokens
│   ├── json_util.h       # leitura/escrita minima de JSON
│   ├── app_paths.h       # onde ficam o frontend, o banco e a porta
│   ├── user_store.h      # cadastro de usuarios (arquivo em disco)
│   ├── session_store.h   # sessoes e tokens de redefinicao (em memoria)
│   ├── http_response.h   # respostas HTTP cruas
│   ├── static_files.h    # servidor de arquivos estaticos
│   └── routes.h          # rotas da API
└── src/             # implementacao (.c) de cada modulo acima, mais main.c
```

## Compilar

**Windows** — precisa de um compilador C instalado (MinGW-w64, via
https://www.msys2.org/). Depois:

```
build.bat
```

**Linux / macOS**

```
./build.sh
```

## Rodar

Windows: `iniciar-fluxy-c.bat` (ou `fluxy-api.exe`) · Linux/macOS: `./fluxy-api`

Sobe em http://localhost:8080. Para outra porta: `./fluxy-api 9090`
(ou a variavel de ambiente `API_PORT`).

## Onde ficam os dados

`../database/data/fluxy-users.db` — texto, um usuario por linha, campos
separados por TAB: id, nome, e-mail, telefone, CPF, salt, hash, pergunta,
salt da resposta, hash da resposta, data. Senhas e respostas nunca sao
gravadas em texto claro.

Instalacoes antigas com dados em `skina-users.db` sao migradas
automaticamente (uma unica vez) para `fluxy-users.db` na primeira
execucao apos a atualizacao.

## Rotas

`GET /health` · `POST /api/auth/register` · `POST /api/auth/login` ·
`POST /api/auth/logout` · `GET /api/me` · `POST /api/auth/forgot-password` ·
`POST /api/auth/answer-question` · `POST /api/auth/reset-password` ·
`GET|POST /api/company`

## Diferencas em relacao ao backend Node

- Sessoes ficam em memoria: ao reiniciar o servidor, e preciso logar de
  novo (os usuarios continuam salvos em disco).
- Nao envia e-mail por SMTP; a recuperacao usa a pergunta de seguranca ou
  o link local exibido na tela.
- Atende uma conexao por vez (suficiente para uso local, nao para
  internet).
