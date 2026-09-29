@echo off
REM java-dev-env 启动器（PowerShell / CMD 直接双击或 .\script\start.cmd）
REM 纯 Node 实现，零依赖；不走 bash，避免 WSL 路由问题。
cd /d "%~dp0.."
node "%~dp0start.mjs" %*
