#!/usr/bin/env bash
#
# 停止 / 销毁开发环境（停止【全部】容器）
# 各服务虽声明了 profiles: [<服务名>]，但 `docker compose down` 是按「整个项目」销毁的，
# 不受 profile 是否激活影响——实测可正确停掉并移除经 `up -d <服务名>` 启动的容器。
# 用法：
#   cd java-dev-env
#   bash script/sh-stop.sh            # 停止并移除容器、网络（保留数据卷，数据不丢）
#   bash script/sh-stop.sh --clean    # 额外移除数据卷（⚠️ redis / mysql / es 等持久数据会被清空）
#
set -uo pipefail
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
