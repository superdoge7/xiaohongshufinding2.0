@echo off
chcp 65001 >nul
title 小红书分析工具 - 全自动启动版

:: BAT 与项目根目录同级：%~dp0 即为仓库根目录
set "ROOT=%~dp0"
pushd "%ROOT%"

echo ========================================
echo   正在为你启动小红书分析工具...
echo   项目目录: %ROOT%
echo ========================================

echo [1/3] 正在开启后端引擎...
if exist ".venv\Scripts\activate.bat" (
  start "XHS_Backend" cmd /k "cd /d "%ROOT%" && call .venv\Scripts\activate.bat && python scripts\serve_local_app.py"
) else (
  start "XHS_Backend" cmd /k "cd /d "%ROOT%" && python scripts\serve_local_app.py"
)

timeout /t 2 >nul

echo [2/3] 正在开启前端界面...
start "XHS_Frontend" cmd /k "cd /d "%ROOT%desktop" && npm run dev"

echo [3/3] 准备就绪，正在打开浏览器...
timeout /t 5 >nul
start "" "http://localhost:5173"

echo ========================================
echo   启动完成！会话与历史默认保存在 tmp\redbook_history\
echo   可在应用「设置」中自定义目录（如 E:\VS code\history）。
echo   若端口不是 5173，请以「XHS_Frontend」窗口提示为准。
echo ========================================
pause
popd
