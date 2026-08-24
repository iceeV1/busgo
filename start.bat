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
node server.js
pause
