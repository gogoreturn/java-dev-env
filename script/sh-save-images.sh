#!/usr/bin/env bash
#
# 把 compose 实际引用的全部镜像导出到 images/（用于离线拷贝到新电脑）
# 命名规则：取镜像最后一段路径名，':' 替换为 '-'（兼容 Windows 文件名），追加 .tar
#   例：dbeaver/cloudbeaver:latest -> cloudbeaver-latest.tar；mysql:9 -> mysql-9.tar
# 用法：
#   cd java-dev-env
#   bash script/sh-save-images.sh
#
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

IMAGE_DIR="$(pwd)/images"
mkdir -p "$IMAGE_DIR"

echo ">>> 解析 compose 镜像列表..."
mapfile -t IMAGES < <(docker compose config | awk '/^[[:space:]]*image:[[:space:]]*/ {print $2}' | sort -u)

if [ "${#IMAGES[@]}" -eq 0 ]; then
  echo "未从 compose 解析到任何 image。" >&2
  exit 1
fi

echo ">>> 共 ${#IMAGES[@]} 个镜像，导出到 $IMAGE_DIR"
for img in "${IMAGES[@]}"; do
  base="$(basename "$img")"          # 去掉 registry / 组织前缀
  safe="${base//:/-}"                # ':' -> '-'（Windows 文件名友好）
  out="$IMAGE_DIR/${safe}.tar"
  echo ">>> 导出：$img  ->  $(basename "$out")"
  out_win="$(cygpath -w "$out" 2>/dev/null || echo "$out")"
  docker save -o "$out_win" "$img"
done

echo
echo "✅ 全部镜像已导出到 images/ 。把整个 java-dev-env 目录拷到新电脑后执行："
echo "   bash script/sh-load-images.sh"
