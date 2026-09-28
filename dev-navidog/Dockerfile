# NaviDog —— 轻量 Web 端 MySQL 管理工具（Navicat 风格、中文原生，仅 MySQL）
# 官方只发布 npm 包，这里自建镜像以便在 Docker / 离线环境运行。
#
# 关键修复：上游 server/index.ts 第 31 行硬编码监听 127.0.0.1，
# 容器内若只监听回环地址，宿主机端口映射无法访问。
# 此处用 sed 把它改成可被 HOST 环境变量覆盖（默认 0.0.0.0）。
# 基础镜像用本地已缓存的 node:22-alpine，避免依赖 Docker Hub 拉取。
FROM node:22-alpine

# 安装 navidog（其 dependencies 已含 tsx 运行时，全局 bin 为 navidog）
RUN npm install -g navidog

# 让监听地址可被 HOST 环境变量覆盖（默认 0.0.0.0，便于容器端口映射）
RUN sed -i "s/const host = '127.0.0.1'/const host = process.env.HOST || '0.0.0.0'/" \
    "$(npm root -g)/navidog/server/index.ts"

ENV PORT=3001
ENV HOST=0.0.0.0

EXPOSE 3001

CMD ["navidog"]
