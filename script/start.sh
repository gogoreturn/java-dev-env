#!/usr/bin/env bash
#
# 启动开发环境
# 用法（Windows 用 Git Bash / WSL；Linux / macOS 用终端）：
#   cd java-dev-env
#   bash script/start.sh            # 启动全部服务
#   bash script/start.sh redis mysql  # 仅启动指定服务
#
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ "$#" -gt 0 ]; then
  echo ">>> 启动指定服务：$*"
  docker compose up -d "$@"
else
  echo ">>> 启动全部服务..."
  docker compose up -d
fi

echo
echo "✅ 启动完成。执行 bash script/status.sh 查看状态与可达性。"
