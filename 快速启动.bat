@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo CodeBuddy Launcher v2.0
echo ======================
echo.
echo 选择工作目录后启动 CodeBuddy...
echo.

node launcher.js %*
pause