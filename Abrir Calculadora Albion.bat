@echo off
title Calculadora Albion
cd /d "%~dp0"

echo.
echo  ===== Calculadora Albion =====
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  O Node.js nao esta instalado neste computador.
  echo  Vou abrir a pagina de download. Instale a versao LTS e
  echo  depois abra este arquivo de novo.
  start "" "https://nodejs.org/pt-br/download"
  echo.
  pause
  exit /b 1
)

rem Confere no GitHub se ha versao nova e aplica antes de abrir.
node scripts\atualizar.mjs

rem O resto fica num arquivo separado, que pode ser atualizado sem problemas.
call scripts\iniciar.cmd
