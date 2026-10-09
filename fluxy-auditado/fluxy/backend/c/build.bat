@echo off
rem Compila o backend em C (Windows, via MinGW-w64). Gera fluxy-api.exe
rem nesta mesma pasta. Uso: build.bat  ^&^&  fluxy-api.exe

cd /d "%~dp0"

where gcc >nul 2>nul
if errorlevel 1 (
  echo [Fluxy-C] gcc nao encontrado.
  echo Instale o MinGW-w64 ^(https://www.msys2.org/^) e tente de novo.
  pause
  exit /b 1
)

echo [Fluxy-C] compilando...
gcc -Wall -Wextra -std=c11 -O2 -Iinclude src\*.c -o fluxy-api.exe -lws2_32 -ladvapi32
if errorlevel 1 (
  echo [Fluxy-C] falha na compilacao.
  pause
  exit /b 1
)

echo [Fluxy-C] pronto: fluxy-api.exe
pause
