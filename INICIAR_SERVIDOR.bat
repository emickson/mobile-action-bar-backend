@echo off
echo.
echo ========================================
echo   Iniciando Servidor Local
echo ========================================
echo.
echo Verificando Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERRO] Node.js nao encontrado!
    echo.
    echo Por favor, instale Node.js:
    echo https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo Node.js encontrado!
echo.
echo Iniciando servidor na porta 3000...
echo.
echo ========================================
echo   Servidor Iniciado!
echo ========================================
echo.
echo Abra no navegador:
echo   http://localhost:3000
echo.
echo Para parar: Pressione Ctrl+C
echo.
echo ========================================
echo.

node server.js

pause
