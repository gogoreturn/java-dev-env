#!/usr/bin/env bash
#
# 停止 / 销毁开发环境
# 用法：
#   cd java-dev-env
#   bash script/stop.sh            # 停止并移除容器、网络（保留数据卷，数据不丢）
#   bash script/stop.sh --clean    # 额外移除数据卷（⚠️ redis / mysql / es 等持久数据会被清空）
#
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ "${1:-}" = "--clean" ]; then
  echo ">>> 停止并清理容器 / 网络 / 数据卷（⚠️ 持久数据将被删除）..."
  docker compose down -v
else
  echo ">>> 停止并移除容器 / 网络（保留数据卷）..."
  docker compose down
fi

echo
echo "✅ 已停止。"
