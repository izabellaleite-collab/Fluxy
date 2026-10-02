# Fluxy — gestão financeira

O Fluxy tem duas partes:

| Parte | Pasta | Onde roda |
|---|---|---|
| Site (HTML/CSS/JS) | `frontend/` | GitHub Pages **ou** localmente |
| API + banco PostgreSQL | `backend/` | Render (ou outro serviço Node) **ou** localmente |

> **Por que separar?** O GitHub Pages só hospeda arquivos estáticos: ele não
> executa Node.js nem PostgreSQL. Por isso a API e o banco ficam num serviço
> que roda Node (aqui: Render + banco Neon), e o site no Pages chama essa API.
> Sem API configurada, o site no Pages funciona em **modo local**: os dados
> ficam salvos só no navegador de quem está usando.

## Estrutura

Estes arquivos ficam **na raiz do repositório** (sem nenhuma pasta por fora):

```
Fluxy/
├── .github/
│   └── workflows/
│       └── pages.yml             # publica frontend/ no GitHub Pages
├── frontend/
│   ├── index.html
│   ├── config.js                 # URL da API em produção
│   ├── css/
│   └── js/ (core/ e modules/)
├── backend/
│   ├── src/                      # API Node.js
│   ├── database/                 # schema.sql, seed.sql, migrate.js
│   └── .env.example
├── package.json
├── render.yaml                   # configuração da API no Render
├── README.md
├── .gitignore
├── INICIAR-FLUXY.bat
└── iniciar-fluxy.sh
```

## 1. Rodar no seu computador

Requisitos: Node.js 18+ e PostgreSQL 14+.

```bash
npm install
cp backend/.env.example backend/.env    # Windows: copy backend\.env.example backend\.env
# edite backend/.env e coloque a senha do seu PostgreSQL em DATABASE_URL
createdb -U postgres fluxy_db           # ou, no pgAdmin/psql: CREATE DATABASE fluxy_db;
npm run db:seed                         # opcional: empresa e dados de exemplo
npm start                               # abre http://localhost:8080
```

As tabelas são criadas sozinhas ao iniciar (`schema.sql` pode rodar várias vezes
sem problema). No Windows, também dá para dar dois cliques em `INICIAR-FLUXY.bat`.

Conta de exemplo (se você rodou `npm run db:seed`):
`mariana@padariasaojose.com.br` / `Senha1234`.

> Não abra `frontend/index.html` com dois cliques (`file://`). Use `npm start`.

## 2. Publicar

### 2.1 Banco de dados (Neon, gratuito)
1. Crie uma conta em https://neon.tech e um projeto.
2. Copie a *connection string* (começa com `postgres://` e termina com `?sslmode=require`).

### 2.2 API (Render, gratuito)
1. Envie o projeto para o GitHub (seção 3).
2. No Render: **New → Blueprint** → escolha o repositório `Fluxy` (ele lê o `render.yaml`).
3. Preencha `DATABASE_URL` com a connection string do Neon. O `CORS_ORIGINS` já
   vem preenchido com `https://izabellaleite-collab.github.io`.
4. Ao terminar o deploy, abra `https://SEU-SERVICO.onrender.com/health`. Deve
   mostrar `"database":"connected"`.

### 2.3 Site (GitHub Pages)
1. Em `frontend/config.js`, coloque a URL da API:
   `apiUrl: 'https://SEU-SERVICO.onrender.com'` (com `https`, sem `/` no final).
2. Faça commit e push.
3. No GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Acompanhe a aba **Actions**. O site fica em
   https://izabellaleite-collab.github.io/Fluxy/

## 3. Enviar para o GitHub

O `package.json`, a pasta `frontend/` e a pasta `.github/` precisam aparecer
**direto na página inicial do repositório**, e não dentro de outra pasta.

### Pelo terminal (recomendado: envia também os arquivos ocultos)

Dentro da pasta `Fluxy` extraída do zip:

```bash
git init
git add .
git commit -m "Fluxy: estrutura na raiz para GitHub Pages e Render"
git branch -M main
git remote add origin https://github.com/izabellaleite-collab/Fluxy.git
git push -u origin main --force   # substitui o conteúdo atual do repositório
```

### Pelo site do GitHub (Add file → Upload files)

O envio pelo navegador **ignora arquivos e pastas que começam com ponto**
(`.github/`, `.gitignore`, `backend/.env.example`). Por isso:

1. Apague do repositório as pastas antigas (`fluxy-corrigido/`).
2. Abra a pasta `Fluxy` no computador, selecione **o conteúdo dela** (`frontend`,
   `backend`, `package.json`, `render.yaml`, `README.md`, os dois scripts) e
   arraste para a página de upload. Não arraste a pasta `Fluxy` em si.
3. Crie o workflow à mão: **Add file → Create new file**, digite o nome
   `.github/workflows/pages.yml`, cole o conteúdo do arquivo de mesmo nome que
   está no zip e confirme o commit.
4. Repita o passo 3 para `.gitignore` e, se quiser, `backend/.env.example`.

Depois do primeiro `npm install`, faça commit também do `package-lock.json` gerado.

## Limitações conhecidas

- **Render gratuito:** a API "dorme" depois de cerca de 15 min sem uso. A primeira
  requisição depois disso pode levar até cerca de 1 minuto. Se ela falhar, o site
  usa o modo local naquele momento.
- **Modo local (sem API):** os cadastros feitos enquanto a API está fora ficam só
  naquele navegador e não são enviados ao banco depois.
- Fontes, ícones e gráficos vêm de CDNs (Google Fonts, cdnjs, jsDelivr) e
  precisam de internet.
