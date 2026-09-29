#!/usr/bin/env bash
# java-dev-env 启动器包装（Linux / macOS / Git Bash 用户）
# 真实逻辑在 start.mjs（纯 Node，零依赖）。Windows 用户建议直接用 win-start.cmd。
#
# 关键点 1：先用 BASH_SOURCE 拿到脚本绝对目录并 cd 进去，再用【相对路径】start.mjs
# 调 node。不要直接把 POSIX 绝对路径（如 /e/docker/.../start.mjs）传给 node.exe——
# Git Bash 的 MSYS 路径翻译会把 /e/... 错译成 E:\e\...，导致 MODULE_NOT_FOUND。
# 关键点 2：Git Bash 下 node.exe 常拿不到原生 TTY（isTTY=false），交互界面无法进入原始
# 键盘模式。若装了 winpty（很多 Git Bash / ConEmu / cmder 自带），用它启动 node 即可获得
# 真正的控制台，交互界面正常；否则退回直接跑（此时 start.mjs 会提示改用 start.cmd）。
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1
if command -v winpty >/dev/null 2>&1; then
  exec winpty node "start.mjs" "$@"
else
  exec node "start.mjs" "$@"
fi
