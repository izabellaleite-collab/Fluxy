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

```
fluxy/
├── .github/workflows/pages.yml   # publica frontend/ no GitHub Pages
├── frontend/
│   ├── index.html
│   ├── config.js                 # URL da API em produção
│   ├── .nojekyll
│   ├── css/
│   └── js/ (core/ e modules/)
├── backend/
│   ├── src/                      # API Node.js
│   ├── database/                 # schema.sql, seed.sql, migrate.js
│   └── .env.example
├── tests/verify-local.js         # teste real: API + banco
├── render.yaml                   # configuração da API no Render
├── INICIAR-FLUXY.bat / iniciar-fluxy.sh
└── package.json
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

Teste completo (cadastro, login, recuperação de senha e site): `npm run verify`.

> Não abra `frontend/index.html` com dois cliques (`file://`). Use `npm start`.

## 2. Publicar

### 2.1 Banco de dados (Neon, gratuito)
1. Crie uma conta em https://neon.tech e um projeto.
2. Copie a *connection string* (começa com `postgres://` e termina com `?sslmode=require`).

### 2.2 API (Render, gratuito)
1. Envie o projeto para o GitHub (seção 3).
2. No Render: **New → Blueprint** → escolha o repositório (ele lê o `render.yaml`).
3. Preencha as variáveis pedidas:
   - `DATABASE_URL`: a connection string do Neon;
   - `CORS_ORIGINS`: `https://SEU-USUARIO.github.io`.
4. Ao terminar o deploy, abra `https://SEU-SERVICO.onrender.com/health`. Deve
   mostrar `"database":"connected"`.

### 2.3 Site (GitHub Pages)
1. Em `frontend/config.js`, coloque a URL da API:
   `apiUrl: 'https://SEU-SERVICO.onrender.com'` (com `https`, sem `/` no final).
2. Faça commit e push.
3. No GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Acompanhe a aba **Actions**. O site fica em
   `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.

## 3. Enviar para o GitHub

```bash
git init
git add .
git commit -m "Fluxy: estrutura corrigida para GitHub Pages + API"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/NOME-DO-REPOSITORIO.git
git push -u origin main
```

O `package.json` precisa ficar **na raiz** do repositório, e não dentro de uma
subpasta `fluxy/`. Depois do primeiro `npm install`, faça commit também do
`package-lock.json` gerado.

## Limitações conhecidas

- **Render gratuito:** a API "dorme" depois de cerca de 15 min sem uso. A primeira
  requisição depois disso pode levar até cerca de 1 minuto. Se ela falhar, o site
  usa o modo local naquele momento.
- **Modo local (sem API):** os cadastros feitos enquanto a API está fora ficam só
  naquele navegador e não são enviados ao banco depois.
- Fontes, ícones e gráficos vêm de CDNs (Google Fonts, cdnjs, jsDelivr) e
  precisam de internet.
