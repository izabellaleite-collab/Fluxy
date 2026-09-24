#!/bin/sh
# Compila o backend em C (Linux/macOS). Gera o executavel fluxy-api nesta
# mesma pasta. Uso: ./build.sh && ./fluxy-api
set -e

cd "$(dirname "$0")"

gcc -Wall -Wextra -std=c11 -O2 \
    -Iinclude \
    src/*.c \
    -o fluxy-api

echo "Build concluido: backend/c/fluxy-api"
