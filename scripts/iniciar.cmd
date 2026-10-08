@echo off
rem Chamado pelo "Abrir Calculadora Albion.bat". Prepara e abre o app.
cd /d "%~dp0.."

if not exist "backend\node_modules" (
  echo  Instalando as pecas do servidor. Pode levar alguns minutos...
  call npm install --prefix backend --omit=dev --no-audit --no-fund
  if errorlevel 1 goto erro
)

if not exist "frontend\node_modules" (
  echo  Instalando as pecas da tela. Pode levar alguns minutos...
  call npm install --prefix frontend --no-audit --no-fund
  if errorlevel 1 goto erro
)

node scripts\precisa-montar-tela.mjs
if not errorlevel 1 (
  echo  Montando a tela do app...
  call npm run build --prefix frontend
  if errorlevel 1 goto erro
)

rem Abre o navegador alguns segundos depois, quando o servidor ja estiver de pe.
start "" /min cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3001"

node backend\src\index.js
echo.
echo  O app foi fechado.
pause
exit /b 0

:erro
echo.
echo  Algo deu errado na preparacao. Tire um print desta janela e mande para o Claude.
pause
exit /b 1
