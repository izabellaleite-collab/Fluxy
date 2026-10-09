#!/usr/bin/env bash
# Inicia o Fluxy (site + API Node.js na mesma porta). Uso: ./iniciar-fluxy.sh
cd "$(dirname "$0")" && node backend/src/index.js
