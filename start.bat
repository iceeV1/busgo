@echo off
chcp 65001 >nul
title BusGo Server
echo =========================================
echo   BusGo Server
echo   หน้าเว็บหลัก : http://localhost:3000
echo   หลังบ้าน     : http://localhost:3000/admin
echo   Admin Key    : admin1234
echo   (กด Ctrl+C เพื่อหยุดเซิร์ฟเวอร์)
echo =========================================
cd /d "%~dp0"
set "NODE_BIN=node"
where node >nul 2>nul
if %errorlevel% neq 0 (
  if exist "%LOCALAPPDATA%\node\node-v22.14.0-win-x64\node.exe" (
    set "NODE_BIN=%LOCALAPPDATA%\node\node-v22.14.0-win-x64\node.exe"
  )
)
"%NODE_BIN%" server.js
pause
