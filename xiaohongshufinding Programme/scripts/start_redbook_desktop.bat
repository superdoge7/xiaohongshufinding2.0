@echo off
chcp 65001 >nul
title 小红书分析工具 - 一键启动

set "ROOT=%~dp0.."
pushd "%ROOT%"

echo [1/2] 正在启动后端服务...
start "XHS_Backend" cmd /k cd /d "%ROOT%" ^&^& if exist .venv\Scripts\activate.bat call .venv\Scripts\activate.bat ^&^& python scripts\serve_local_app.py

timeout /t 3 >nul

echo [2/2] 正在启动桌面前端（Vite + Electron）...
start "XHS_Frontend" cmd /k cd /d "%ROOT%\desktop" ^&^& npm run dev

timeout /t 5 >nul
echo 正在打开浏览器（若端口不是 5173，请以终端提示为准）...
start "" "http://localhost:5173"

echo.
echo ========================================
echo   后端与前端已在独立窗口运行。
echo   会话与历史默认保存在：项目\tmp\redbook_history\
echo   可在应用「设置」中改为自定义目录（如 E:\VS code\history）。
echo ========================================
pause
popd
