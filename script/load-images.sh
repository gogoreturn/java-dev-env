#!/usr/bin/env bash
#
# 离线恢复镜像脚本
# 把本环境整套 Docker 镜像（images/*.tar）导入本地镜像库。
# 场景：整套目录拷贝到无外网的新电脑，装好 Docker Desktop 后执行本脚本，
#       随后 bash script/start.sh 即可启动。
# 用法（Windows 用 Git Bash / WSL；Linux / macOS 用终端）：
#   cd java-dev-env
#   bash script/load-images.sh
#
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_DIR="$SCRIPT_DIR/../images"
IMAGE_DIR="$(cd "$IMAGE_DIR" && pwd)"

if [ ! -d "$IMAGE_DIR" ]; then
  echo "未找到镜像目录：$IMAGE_DIR" >&2
  exit 1
fi

shopt -s nullglob
tars=("$IMAGE_DIR"/*.tar)
if [ "${#tars[@]}" -eq 0 ]; then
  echo "images 目录下没有任何 .tar 镜像文件。" >&2
  exit 1
fi

echo "准备导入 ${#tars[@]} 个镜像..."
for f in "${tars[@]}"; do
  echo ">>> 导入：$(basename "$f")"
  f_win="$(cygpath -w "$f" 2>/dev/null || echo "$f")"
  docker load -i "$f_win"
done

echo
echo "✅ 全部镜像导入完成。可继续执行： bash script/start.sh"
