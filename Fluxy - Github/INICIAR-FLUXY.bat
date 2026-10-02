@echo off
title Fluxy - Sistema local
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [Fluxy] Node.js 18 ou superior nao encontrado.
  echo Instale em https://nodejs.org/ e execute este arquivo novamente.
  pause
  exit /b 1
)

if not exist "node_modules\pg" (
  echo [Fluxy] Instalando dependencias ^(primeira execucao^)...
  call npm install --omit=dev
  if errorlevel 1 (
    echo [Fluxy] Falha no npm install. Verifique sua conexao.
    pause
    exit /b 1
  )
)

if not exist "backend\.env" (
  echo [Fluxy] Arquivo backend\.env nao encontrado.
  echo Copie backend\.env.example para backend\.env e ajuste a senha do PostgreSQL.
  pause
  exit /b 1
)

echo.
echo  ===========================================
echo   Fluxy - iniciando site + API na porta 8080
echo  ===========================================
echo.

node backend\src\index.js

echo.
echo [Fluxy] O servidor foi encerrado.
pause
