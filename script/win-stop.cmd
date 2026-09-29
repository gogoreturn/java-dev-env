@echo off
REM 停止并移除全部容器（含 profile 管控的服务）
REM 用法：.\script\stop.cmd          正常停止
REM       .\script\stop.cmd --clean  额外删除数据卷
cd /d "%~dp0.."
docker compose down %*
