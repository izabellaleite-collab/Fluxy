#!/usr/bin/env bash
# Inicia o Fluxy (site + API Node.js na mesma porta). Uso: ./iniciar-fluxy.sh
set -e
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "[Fluxy] Instale o Node.js 18+ (https://nodejs.org/)"; exit 1; }
[ -d node_modules/pg ] || npm install --omit=dev
[ -f backend/.env ] || { echo "[Fluxy] Copie backend/.env.example para backend/.env e ajuste a senha do PostgreSQL."; exit 1; }
node backend/src/index.js
