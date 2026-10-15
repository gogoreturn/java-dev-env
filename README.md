# Java 本地开发环境（java-dev-env）

基于 Docker Compose 的一站式本地开发中间件栈。采用 **「一个容器一个目录」** 的布局，每个服务的 `数据 / 配置 / 日志` 都收纳在各自目录下，便于备份、迁移与清理。所有容器目录统一加 **`dev-` 前缀**，避免与宿主机其它项目冲突。

> 项目名（compose 网络名）：`java-dev-env`  
> 用途：在新电脑上快速拉起一套完整的中间件开发环境。

---

## 一、目录结构

```
java-dev-env/
├── docker-compose.yml              # 主编排：仅 include 下方模块，不内联任何服务定义
├── compose/                       # ★ 一个容器一个文件：每个 *.yaml 对应一个容器
│   ├── jrebel.yaml                #   JRebel 授权服务器
│   ├── redis.yaml                 #   Redis 8
│   ├── mysql.yaml                 #   MySQL 9
│   ├── nginx.yaml                 #   Nginx
│   ├── rabbitmq.yaml              #   RabbitMQ（带管理界面）
│   ├── minio.yaml                 #   MinIO 对象存储（S3 兼容）
│   ├── elasticsearch7.yaml        #   Elasticsearch 7（内置 IK）
│   ├── elasticsearch8.yaml        #   Elasticsearch 8（内置 IK）
│   ├── elasticsearch9.yaml        #   Elasticsearch 9（内置 IK）
│   ├── kafka.yaml                 #   Kafka（KRaft 单节点）
│   ├── kafka-ui.yaml              #   Kafka UI
│   ├── cloudbeaver.yaml           #   CloudBeaver（多库 + 中文）
│   ├── navidog.yaml               #   NaviDog（MySQL 管理，本地构建）
│   ├── redisinsight.yaml          #   RedisInsight
│   ├── qdrant.yaml                #   Qdrant 向量数据库
│   └── it-tools.yaml              #   it-tools 工具箱
├── images/                        # 离线镜像（docker save 产物，见第五节）
├── script/                        # 常用运维脚本（见下方「常用脚本」）
│   ├── start.mjs                  # ★ 启动器核心逻辑（纯 Node 零依赖，不直接执行）
│   ├── sh-start.sh                #   【Linux/macOS/Git Bash】启动器包装，内部调用 start.mjs
│   ├── win-start.cmd              #   【Windows PowerShell/CMD】启动器，直接走 node，避开 WSL
│   ├── sh-stop.sh                 #   【Linux/macOS】停止/销毁全部（docker compose down，--clean 含数据卷）
│   ├── win-stop.cmd               #   【Windows】同上，直接双击用
│   ├── sh-load-images.sh          #   【Linux/macOS】新电脑一键导入镜像
│   └── sh-save-images.sh          #   【Linux/macOS】重新导出 compose 全部镜像
├── 软件包/                         # IK 分词插件离线包（各 ES 版本）
│   └── elasticsearch-analysis-ik/
├── dev-jrebel/                    # JRebel License Server（含 Dockerfile + target/）
├── dev-redis/        { data, conf, logs }
├── dev-mysql/        { data, logs }
├── dev-elasticsearch7/ { data, plugins, logs }   # ES 7.17.3（内置 IK）
├── dev-elasticsearch8/ { data, plugins, logs }   # ES 8.17.3（内置 IK）
├── dev-elasticsearch9/ { data, plugins, logs }   # ES 9.2.0（内置 IK）
├── dev-nginx/        { conf/nginx.conf, conf/conf.d, data, logs }
├── dev-rabbitmq/     { data, conf }
├── dev-kafka/        { data }
├── dev-navidog/      { Dockerfile }    # NaviDog 镜像构建上下文（本地构建）
├── dev-qdrant/       { storage, config, snapshots }   # Qdrant 向量数据库
└── dev-minio/        { data }          # MinIO 对象存储（S3 兼容）
```

> **编排方式（一个容器一个文件）**：根 `docker-compose.yml` 只做编排，通过 `include` 引入 `compose/` 下 16 个容器文件。每个文件对应一个容器，可独立编辑、按需增删；所有文件共享项目名 `java-dev-env` 与同一默认网络，因此跨文件按服务名互访（例如 `kafka-ui` → `kafka:9094`、`cloudbeaver` → `mysql`）。每个服务只声明 `profiles: [<服务名>]`——默认不激活任何 profile 时什么都不启（裸 `docker compose up` 不会启动任何容器），「引用 / 排除」某个容器 = 启动时勾选 / 不勾选它。交互式启动器在仓库根目录执行 `node script/start.mjs`（或 Windows 下 `.\script\win-start.cmd`），勾选需要的容器即可；启动器用 `docker compose up -d <服务名>` 直接点名，Compose 会自动激活其同名 profile（选择存 `.selection` 并回显）。

> `it-tools`、`kafka-ui`、`navidog` 为纯前端 / 无状态工具，无持久数据，不建独立目录；`redisinsight` 与 `cloudbeaver` 已挂出数据目录持久化连接配置（见第十一 / 十二节），`navidog` 的连接信息存浏览器 `localStorage`（容器内挂卷无效）。

---



## 二、容器总览

| 分类 | 服务名 | 容器名 | 镜像 | 宿主机端口 | 说明 |
| --- | --- | --- | --- | --- | --- |
| 数据库与缓存 | mysql | dev-mysql | mysql:9 | 3306 | 关系型数据库 |
| 数据库与缓存 | redis | dev-redis | redis:8.10.1 | 6379 | 缓存 / 队列（密码 `123456`） |
| 对象存储 | minio | dev-minio | minio/minio:RELEASE.2024-12-18T13-15-44Z | 9000 / 9001 | 对象存储（S3 兼容） |
| 搜索引擎 | elasticsearch7 | dev-es7 | elasticsearch:7.17.3 | 9200 / 9300 | 搜索引擎（内置 IK 分词） |
| 搜索引擎 | elasticsearch8 | dev-es8 | elasticsearch:8.17.3 | 9201 / 9301 | ES 8（内置 IK，xpack 安全关闭） |
| 搜索引擎 | elasticsearch9 | dev-es9 | elasticsearch:9.2.0 | 9202 / 9302 | ES 9（内置 IK，xpack 安全关闭） |
| 消息队列 | rabbitmq | dev-rabbitmq | rabbitmq:management | 5672 / 15672 | 消息队列（带管理界面） |
| 消息队列 | kafka | dev-kafka | apache/kafka:3.9.0 | 9092 | 消息流平台（KRaft 单节点） |
| 消息队列 | kafka-ui | dev-kafka-ui | provectuslabs/kafka-ui:v0.7.2 | 10083 → 8080 | Kafka 可视化管理 |
| 网络代理 | nginx | dev-nginx | nginx:1.31.4 | 80 / 443 / 81 | 反向代理 / 静态服务 |
| 可视化管理 | redisinsight | dev-redisinsight | redis/redisinsight@sha256:b5e19ee240abef6edb435871b90ff8a210995422e8e018ab61c0339d318a1f84 | 5540 | Redis 可视化管理 |
| 可视化管理 | cloudbeaver | dev-cloudbeaver | dbeaver/cloudbeaver:24.04 | 8978 | 数据库管理 Web（DBeaver 网页版，多库，中文） |
| 可视化管理 | navidog | dev-navidog | dev-navidog:latest（本地构建） | 3001 | MySQL 管理 Web（Navicat 风格，中文原生） |
| 开发工具 | jrebel | dev-jrebelServer | 本地构建（见 `dev-jrebel/Dockerfile`） | 10082 → 8081 | JRebel 授权服务器 |
| 开发工具 | it-tools | it-tools-cn | qingfeng2336/it-tools@sha256:1263d4d3b6d76afc6db32b57f78eb12567f5d0272e16f7f7b6c01c78e517bc5c | 10081 → 80 | 前端开发者工具箱 |
| 向量数据库 | qdrant | dev-qdrant | qdrant/qdrant:v1.19.0 | 6333 / 6334 | 向量数据库（RAG/AI 语义检索，REST + gRPC） |

---

## 三、各容器关键信息

### 1. JRebel License Server（`dev-jrebel`）

- **镜像**：本地 `docker build`，`build.context` 指向 `./dev-jrebel`
- **端口**：`10082`（宿主机）→ `8081`（容器）
- **数据目录**：`dev-jrebel/`（`target/` 为构建产物，已含在 build context）
- **用途**：为 IDE 提供 JRebel 热部署授权
- **重建镜像**：`docker compose build jrebel`（改了 Java 代码后需先编译出 jar，再 build）

### 2. Redis（`dev-redis`）

- **镜像**：`redis:8.10.1`
- **端口**：`6379`
- **目录映射**：
  - `./dev-redis/data` → `/data`（RDB / AOF 持久化文件）
  - `./dev-redis/conf` → `/usr/local/etc/redis`（配置文件 `redis.conf`，已提交在仓库，直接用其启动）
  - `./dev-redis/logs` → `/var/log/redis`
- **关键配置（见 `dev-redis/conf/redis.conf`）**：`bind 0.0.0.0`、`protected-mode no`、`appendonly yes`、`maxmemory 512mb`、`allkeys-lru`
- **密码**：`requirepass 123456`（已写进 `dev-redis/conf/redis.conf`）
- **连接**：`redis-cli -h localhost -p 6379 -a 123456`（无密码连接会被拒绝 `NOAUTH`）

### 3. MySQL（`dev-mysql`）

- **镜像**：`mysql:9`
- **端口**：`3306`
- **目录映射**：
  - `./dev-mysql/data` → `/var/lib/mysql`
  - `./dev-mysql/logs` → `/var/log/mysql`
- **账号 / 字符集**：
  - **root 密码**：`ruoyi`
  - 初始化库：`dev_db`
  - 字符集：`utf8mb4` / `utf8mb4_unicode_ci`
- **连接**：`jdbc:mysql://localhost:3306/<db>?user=root&password=ruoyi`


### 4. Elasticsearch 三实例（7 / 8 / 9，均内置 IK 分词）

三个实例均挂载 IK 分词插件（`plugins/analysis-ik/`），可直接使用 `ik_max_word` / `ik_smart` 分词器。插件离线包来自 `软件包/elasticsearch-analysis-ik/`，各版本对应解压到各自 `dev-elasticsearch*/plugins/analysis-ik/`。

| 实例      | 镜像                   | 宿主端口        | 说明                                    |
| ------- | -------------------- | ----------- | ------------------------------------- |
| dev-es  | elasticsearch:7.17.3 | 9200 / 9300 | 单节点；ES7 默认无安全                         |
| dev-es8 | elasticsearch:8.17.3 | 9201 / 9301 | `xpack.security.enabled=false`（开发免鉴权） |
| dev-es9 | elasticsearch:9.2.0  | 9202 / 9302 | `xpack.security.enabled=false`（开发免鉴权） |

- **公共目录映射**（每个实例同名子目录）：
  - `./dev-elasticsearch*/data` → `/usr/share/elasticsearch/data`
  - `./dev-elasticsearch*/plugins` → `/usr/share/elasticsearch/plugins`
  - `./dev-elasticsearch*/logs` → `/usr/share/elasticsearch/logs`
- **公共关键配置**：`discovery.type=single-node`、`ES_JAVA_OPTS=-Xms512m -Xmx512m`
- **连接（免密码）**：
  - `http://localhost:9200`（es7）
  - `http://localhost:9201`（es8）
  - `http://localhost:9202`（es9）
- **IK 分词验证**：`POST /_analyze` 用 `{"analyzer":"ik_max_word","text":"中华人民共和国"}` 可返回中文分词结果，即说明 IK 已加载。

> 注意：ES 8 / 9 官方镜像默认开启安全（TLS + 账号），本环境为开发便利统一设置 `xpack.security.enabled=false`。**切勿在生产沿用此配置。**

### 5. Nginx（`dev-nginx`）

- **镜像**：`nginx:1.31.4`
- **端口**：`80` / `443` / `81`
- **目录映射**：
  - `./dev-nginx/conf/nginx.conf` → `/etc/nginx/nginx.conf`
  - `./dev-nginx/conf/conf.d` → `/etc/nginx/conf.d`（站点配置）
  - `./dev-nginx/data` → `/data`（站点静态资源）
  - `./dev-nginx/logs` → `/var/log/nginx`
- **用途**：反向代理、静态资源服务、多站点托管

### 6. IT-Tools（`it-tools`）

- **镜像**：`qingfeng2336/it-tools@sha256:1263d4d3b6d76afc6db32b57f78eb12567f5d0272e16f7f7b6c01c78e517bc5c`
- **端口**：`10081`（宿主机）→ `80`（容器）
- **数据**：无持久化数据（纯前端）
- **用途**：开发者常用小工具集合（编解码、格式化、哈希、正则等）
- **访问**：`http://localhost:10081`

### 7. RabbitMQ（`dev-rabbitmq`）

- **镜像**：`rabbitmq:management`（自带管理界面插件）
- **端口**：
  - `5672`：AMQP 协议端口（应用连接）
  - `15672`：管理界面 Web UI
- **目录映射**：
  - `./dev-rabbitmq/data` → `/var/lib/rabbitmq`（mnesia 数据 + 日志）
  - `./dev-rabbitmq/conf` → `/etc/rabbitmq`（含 `enabled_plugins` / `rabbitmq.conf`）
- **账号**：
  - **用户名**：`admin`
  - **密码**：`admin`
- **访问管理界面**：`http://localhost:15672`

### 8. Kafka（`dev-kafka`）

- **镜像**：`apache/kafka:3.9.0`
- **端口**：`9092`（宿主机 / 应用连接）
- **目录映射**：`./dev-kafka/data` → `/var/lib/kafka/data`
- **架构**：KRaft 单节点（无 Zookeeper），`node.id=1`，`broker+controller` 合一
- **关键配置**：
  - 集群 ID：`MkU3OEVBNTcwNTJENDM2Qk`（首次启动自动格式化存储）
- `listeners=PLAINTEXT://:9092,INTERNAL://:9094`；`advertised.listeners=PLAINTEXT://localhost:9092,INTERNAL://kafka:9094`（双监听器：对外 `localhost:9092` 供本机经端口映射访问，对内 `kafka:9094` 供 compose 内服务如 kafka-ui 直连）
- `auto.create.topics.enable=true`（允许自动建主题）
- **连接（从本机）**：`localhost:9092`
- **⚠️ Kafka 多监听器（宿主机 / 容器内区分）**：Kafka 配了两个非控制监听器——`PLAINTEXT://:9092`（对外，advertised `localhost:9092`，供本机 Java 应用经端口映射访问）与 `INTERNAL://:9094`（对内，advertised `kafka:9094`，供 compose 内服务如 kafka-ui 直连，避免拿到 `localhost` 而连不上）。**compose 内其它容器连 Kafka 一律用 `kafka:9094`**。

### 9. Kafka UI（`kafka-ui`）

- **镜像**：`provectuslabs/kafka-ui:v0.7.2`（已拉取并导出到 `images/kafka-ui-v0.7.2.tar`）
- **端口**：`10083`（宿主机）→ `8080`（容器）
- **连接 Kafka**：`kafka:9094`（compose 内 INTERNAL 监听器，见上方 Kafka 多监听器说明）
- **数据**：无状态（不建独立目录）
- **用途**：Kafka 集群可视化管理（Topic / 消费组 / 消息浏览 / 分区）
- **启用**：镜像已就绪，`docker compose up -d kafka-ui` 即可（访问 `http://localhost:10083`）
- **访问**：`http://localhost:10083`（启用后）

### 10. MinIO（`minio`）

- **镜像**：`minio/minio:RELEASE.2024-12-18T13-15-44Z`
- **端口**：
  - `9000`：S3 API（应用程序通过 SDK / 兼容 S3 的客户端访问）
  - `9001`：控制台 Web UI
- **目录映射**：`./dev-minio/data` → `/data`（对象存储落盘目录）
- **账号**：
  - **Access Key（用户名）**：`admin`
  - **Secret Key（密码）**：`admin123`（MinIO 要求 ≥ 8 位）
- **访问控制台**：`http://localhost:9001`
- **用途**：S3 兼容对象存储，文件上传 / 附件 / 静态资源 / 大文件场景的高频刚需
- **健康校验**：`GET http://localhost:9000/minio/health/live` 返回 200 即正常

### 11. RedisInsight（`redisinsight`）
- **镜像**：`redis/redisinsight@sha256:b5e19ee240abef6edb435871b90ff8a210995422e8e018ab61c0339d318a1f84`
- **端口**：`5540`（宿主机）→ `5540`（容器）
- **数据持久化**：`./dev-redisinsight/data` → `/data`（RedisInsight 的已保存连接、设置均在此目录；挂出后可跨容器重启 / 镜像重建保留，**不再每次丢失连接信息**）
- **用途**：Redis 可视化管理（键值浏览、内存分析、慢查询等）
- **连接 Redis**：在 UI 中添加连接，主机填 `redis`、端口 `6379`、密码 `123456`（同 compose 网络内用服务名 `redis` 即可访问）
- **访问**：`http://localhost:5540`

### 12. 数据库管理（CloudBeaver + NaviDog）

两套数据库管理 Web 工具并存，按需选用：

#### 12a. CloudBeaver（`cloudbeaver`）
- **镜像**：`dbeaver/cloudbeaver:24.04`
- **端口**：`8978`（宿主机）→ `8978`（容器）
- **数据持久化**：`./dev-cloudbeaver/data` → `/opt/cloudbeaver/workspace`（连接配置、会话在此目录；挂出后可跨重启保留）
- **用途**：DBeaver 网页版，现代 IDE 式 UI、内置简体中文（跟随浏览器语言），支持 **MySQL / PostgreSQL / SQLite / MariaDB** 等多库
- **连接 MySQL**：新增连接时选 `MySQL`，主机填 `mysql`、端口 `3306`、用户 `root`、密码 `ruoyi`、库 `dev_db`（同 compose 网络内用服务名 `mysql` 访问）
- **访问**：`http://localhost:8978`

#### 12b. NaviDog（`navidog`，本地构建）
- **镜像**：`dev-navidog:latest`（由 `dev-navidog/Dockerfile` 本地构建；上游 npm 包硬编码监听 `127.0.0.1`，已在 Dockerfile 内改为 `HOST` 可配，默认 `0.0.0.0`）
- **端口**：`3001`（宿主机）→ `3001`（容器）
- **数据**：**连接信息存浏览器 `localStorage`**（官方明确：连接密码在浏览器端，不在容器内）。因此容器挂卷无法持久化连接——**不要用无痕模式、不要清浏览器数据**，同一浏览器下容器重启不会丢连接；若要换浏览器/清缓存，先在 UI 里「导出连接」（支持 Navicat `.ncx`）备份。
- **用途**：轻量 Web 端 MySQL 管理工具，Navicat 风格、中文原生，功能含 SQL 编辑器、表格内增删改、CSV/Excel/JSON/SQL 导入导出、表结构设计、索引/外键；**仅支持 MySQL**
- **连接 MySQL**：工具栏「连接」→ 主机 `mysql`、端口 `3306`、用户 `root`、密码 `ruoyi`（同 compose 网络内用服务名 `mysql` 访问）
- **访问**：`http://localhost:3001`

### 13. Qdrant 向量数据库（`dev-qdrant`）

- **镜像**：`qdrant/qdrant:v1.19.0`（离线环境请改用本地 `images/` 下已 load 的镜像 tag，并保持与 `compose/qdrant.yaml` 中一致）
- **端口**：
  - `6333` — REST API（浏览器 / HTTP 客户端 / 多数 Web 框架默认走这里）
  - `6334` — gRPC API（官方 Python / Java / Go SDK 默认 `prefer_grpc=True` 走这里，**两个端口都要暴露**，否则 SDK 会静默连不上）
- **目录映射（可挂载项已全部挂出）**：
  - `./dev-qdrant/storage` → `/qdrant/storage`（所有集合、向量、payload 的持久化数据）
  - `./dev-qdrant/config` → `/qdrant/config`（配置文件 `config.yaml`，已提交在仓库，直接用其启动）
  - `./dev-qdrant/snapshots` → `/qdrant/snapshots`（快照导出目录，便于备份 / 迁移）
- **配置**：`dev-qdrant/config/config.yaml` 已显式设置 `service.host=0.0.0.0`、REST `6333`、gRPC `6334`、`storage_path=/qdrant/storage`、`snapshots_path=/qdrant/snapshots`
- **鉴权**：默认**不启用 API Key**（与本项目其他开发中间件一致，仅本机 / 内网使用）；如需对外暴露，在 `compose/qdrant.yaml` 加 `environment: QDRANT__SERVICE__API_KEY=xxx` 即可开启
- **健康检查**：`curl http://localhost:6333/healthz` → `{"status":"ok"}`
- **快速验证**：`curl -X PUT http://localhost:6333/collections/test -H 'Content-Type: application/json' -d '{"vectors":{"size":4,"distance":"Cosine"}}'`
- **跨容器访问**：同 compose 网络内用服务名 `qdrant` 直连（如 `http://qdrant:6333`），供后端 Spring Boot / Python 服务对接

---

## 四、常用操作（勾选需要的容器启动）

每个服务只声明 `profiles: [<服务名>]`，默认不激活任何 profile 时什么都不启。
「引用 / 排除」某个容器 = 启动时勾选 / 不勾选它——选择通过交互式启动器完成。

### 交互式启动

启动器用方向键 + 空格勾选，**不是**敲编号。在仓库根目录执行：

```bash
# Windows（PowerShell / CMD，推荐，避开 bash→WSL 路由问题，且保证交互界面拿到原生控制台）
.\script\win-start.cmd

# 或 Git Bash / Linux / macOS
bash script/sh-start.sh
# 也可直接： node script/start.mjs
```

> **交互界面进不去？** Git Bash 下 node.exe 有时拿不到原生 TTY（`isTTY=false`），方向键界面无法进入原始键盘模式。`sh-start.sh` 已内置：若检测到 `winpty` 会自动用它启动（推荐 Git Bash 用户先装好 winpty）；否则请改用 PowerShell / cmd 跑 `.\script\win-start.cmd`，或直接 `node script/start.mjs redis mysql` 非交互指定。`--list` / 非交互模式不受 TTY 影响，任何终端都能用。

界面长这样（方向键移动光标，空格切换勾选，回车启动）：

```
◆  java-dev-env 启动器
  勾选需要的容器，回车启动（选择已持久化到 .selection）

  数据库与缓存
  ❯ ● redis              Redis — 缓存 / 会话
    ○ mysql              MySQL — 关系型数据库
  对象存储
    ○ minio              MinIO — 对象存储 (S3 兼容)
  搜索引擎
    ○ elasticsearch7     Elasticsearch 7 — 搜索引擎
  消息队列
    ○ rabbitmq           RabbitMQ — 消息队列
  ...（共 7 个分类：数据库与缓存 / 对象存储 / 搜索引擎 / 消息队列 / 网络代理 / 可视化管理 / 开发工具）

  ↑/↓ 移动  空格 勾选  a 全选  n 全不选  r 重置  enter 启动  q 退出
  已选 1 / 15  （已读取上次选择）
```

快捷键：`↑/↓` 移动 · `空格` 勾选/取消 · `a` 全选 · `n` 全不选 · `r` 重置为「默认 6 件套」· `enter` 保存并启动 · `q` 退出（不保存）。
勾选结果持久化到仓库根 `.selection`，**下次进入自动回显上次的勾选**（列表右下角会提示「已读取上次选择」）。

非交互 / 自动化用法：

```bash
node script/start.mjs redis mysql        # 直接以给定服务启动并保存选择
node script/start.mjs --list             # 仅列出全部可启服务
node script/start.mjs --dry-run redis    # 打印将执行的 docker 命令（不真正运行）
```

### 操作手册（改动如何生效）

日常所有「让配置改动落地」的动作，本质上都是**重跑启动器**——它执行 `docker compose up -d <勾选的服务>`，而 Compose 会自动比对配置哈希，发现 `compose/<name>.yaml` 变了就重建（recreate）对应容器。下面按场景说明。

#### 场景 1：改了挂载路径 / 端口 / 环境变量 / 镜像 tag（最常见）
无需手动删容器，三步即可：
1. 确认该容器在 `.selection` 里仍被勾选（重跑启动器时它会默认勾上，或已被回显）；
2. 重跑启动器：Windows 用 `.\script\win-start.cmd`，Git Bash / Linux / macOS 用 `bash script/sh-start.sh`；
3. 启动器检测到配置变化，自动 recreate 受影响的容器，新挂载立即生效。

> 等价的原生命令：`docker compose up -d redis`（直接点名服务即可，不必带 `--profile`）。

#### 场景 2：改了「本地构建镜像」的 Dockerfile / 构建上下文
本项目中**只有 `jrebel` 和 `navidog` 是 `build:` 镜像**。`up -d` 不会自动重新构建镜像，改了它们必须显式 build：
```bash
docker compose build jrebel                 # 改了 jrebel 的 Dockerfile / dev-jrebel/ 上下文
docker compose up -d --build jrebel         # build + 启动一步到位（推荐）
```
其余 13 个都是 `image:` 现成镜像，不存在这个问题。

#### 场景 3：补启 / 排除容器
- **补启一个之前没勾选的容器**：重跑启动器，把新容器勾上 → 回车。Compose 的 `up` 是增量的，只确保勾选的起来，已运行的其它容器不受影响。
- **排除一个正在运行的容器**：取消它的勾选 → 回车（仅 `up` 不会自动停掉未勾选的），再单独 `docker compose stop <服务名>` 或 `docker compose down <服务名>` 把它停掉。

#### 场景 4：验证配置 & 兜底重建
| 目的 | 命令 |
|------|------|
| 改完先预览最终解析配置（排查 YAML 写错） | `docker compose config`（列出全部服务定义，不受 profile 影响） |
| 极少数 Compose 没检测到变化、没重建 | `docker compose up -d --force-recreate <服务名>` |
| 确认挂载是否真的生效 | `docker inspect <容器名> --format '{{json .Mounts}}'` |
| 看运行状态（全部） | `docker ps`（按项目名 java-dev-env 过滤）；看单个：`docker compose ps <服务名>` |
| 看实时日志 | `docker compose logs -f <服务名>` |

#### ⚠️ 数据安全提醒
- 改的是挂载的**宿主机路径**（如把 `../dev-redis` 改成 `../dev-redis2`），Compose 只按新路径起容器——**旧路径里的数据不会自动搬过去**，要保留得自己先把目录挪过去。
- 若是命名卷（named volume）且没改，数据原样保留。
- 停止时用 `--clean`（`win-stop.cmd` / `sh-stop.sh --clean` = `down -v`）会**删除数据卷**，⚠️ 持久数据清空，慎用。

#### 停止 / 移除
- 停止并移除全部：`bash script/sh-stop.sh` 或 Windows 下 `.\script\win-stop.cmd`；加 `--clean` 额外删数据卷。
- 只停某个：`docker compose stop <服务名>`（保留容器）或 `docker compose down <服务名>`（移除容器，`down -v` 删卷）。
- **移除一个容器**：反向操作——删掉根 `docker-compose.yml` 里对应的 `include` 行 + 删除 `compose/<name>.yaml`；若容器正在运行，先 `docker compose down <服务名>` 停掉，再清理对应的 `dev-xxx/` 数据目录。

#### 新增一个容器
1. 在 `compose/` 下新建 `<name>.yaml`，照搬现有文件写法：声明 `profiles: [<name>]`，挂载用 `../dev-xxx` 指向仓库根数据目录；
2. 到根 `docker-compose.yml` 的 `include` 列表加一行 `compose/<name>.yaml`；
3. 重跑启动器，即可看到新容器并勾选启动（启动器会自动从 `compose/*.yaml` 发现它）。

### 原生命令（进阶 / 自动化）

```bash
# 启动指定服务：直接点名（推荐，Compose 会自动激活其同名 profile）
docker compose up -d redis mysql
# 等价写法：逐个开同名 profile（--profile 是全局 flag，必须放在 up 之前）
docker compose --profile redis --profile mysql up -d

# 查看状态 / 日志（注意：ps 受 profile 影响，裸 docker compose ps 只显示已激活的同名 profile 服务；
# 想看全部运行态用 docker ps，或显式 docker compose ps <服务名>）
docker ps
docker compose logs -f kafka

# 重建本地构建镜像（如 jrebel）后再启动
docker compose build jrebel && docker compose up -d jrebel
```

> **服务名 = profile 名**：每个容器的 profile 就是它自己的服务名（`redis` / `mysql` / `elasticsearch8` …），可单独 `docker compose --profile <服务名> up -d` 起任意一个。
> 例：`docker compose --profile elasticsearch8 up -d` 只起 ES 8；`docker compose --profile cloudbeaver --profile navidog up -d` 只起两个 MySQL 管理界面。
> 注：早期版本里的「域 profile」（`core`/`search`/`messaging`/`dbgui`/`tools`）与伞形 `all` 已移除——批量启停交给交互式启动器负责。

---


## 五、离线镜像（新电脑快速部署）

为在无外网 / 拉取受限的新电脑上快速复现整套环境，本目录 `images/` 已用 `docker save` 预导出 compose 实际引用的全部镜像（标签中的 `:` 已转为 `-` 以兼容 Windows 文件名）：

| 文件 | 对应镜像 |
| --- | --- |
| dev-jrebel-latest.tar | dev-jrebel:latest（本地构建） |
| redis-8.10.1.tar | redis:8.10.1 |
| mysql-9.tar | mysql:9 |
| elasticsearch-7.17.3.tar | elasticsearch:7.17.3 |
| elasticsearch-8.17.3.tar | elasticsearch:8.17.3 |
| elasticsearch-9.2.0.tar | elasticsearch:9.2.0 |
| nginx-1.31.4.tar | nginx:1.31.4 |
| it-tools@sha256-1263d4d3b6d76afc6db32b57f78eb12567f5d0272e16f7f7b6c01c78e517bc5c.tar | qingfeng2336/it-tools@sha256:1263…（digest 锁版） |
| rabbitmq-management.tar | rabbitmq:management |
| kafka-3.9.0.tar | apache/kafka:3.9.0 |
| kafka-ui-v0.7.2.tar | provectuslabs/kafka-ui:v0.7.2 |
| minio-RELEASE.2024-12-18T13-15-44Z.tar | minio/minio:RELEASE.2024-12-18T13-15-44Z |
| redisinsight@sha256-b5e19ee240abef6edb435871b90ff8a210995422e8e018ab61c0339d318a1f84.tar | redis/redisinsight@sha256:b5e19…（digest 锁版） |
| cloudbeaver-24.04.tar | dbeaver/cloudbeaver:24.04 |
| dev-navidog-latest.tar | dev-navidog:latest（本地构建） |

**新电脑恢复步骤**：

1. 安装并启动 Docker Desktop；
2. 把整个 `java-dev-env/` 目录（含 `images/`）拷到新电脑；
3. 在本目录下执行镜像导入脚本：
   ```bash
   # Windows（Git Bash / WSL）或 Linux / macOS 终端
   bash script/sh-load-images.sh
   ```
   脚本会遍历 `images/*.tar` 逐个 `docker load` 导入；
4. 导入完成后直接启动（全启，等价于 `.\script\win-start.cmd` 或 `node script/start.mjs`）：
   ```bash
   docker compose --profile jrebel --profile redis --profile mysql --profile nginx \
     --profile rabbitmq --profile minio --profile elasticsearch7 --profile elasticsearch8 \
     --profile elasticsearch9 --profile kafka --profile kafka-ui --profile redisinsight \
     --profile cloudbeaver --profile navidog --profile it-tools up -d
   ```
   > 嫌长就直接用 `.\script\win-start.cmd`（或 `node script/start.mjs`，会自动拉起勾选的服务）；只想跑默认 6 件套就 `docker compose up -d jrebel redis mysql nginx rabbitmq minio`。

> 若镜像有变动（升级版本 / 新增服务），重新执行 `docker save -o images/<name>-<tag>.tar <repo>:<tag>` 覆盖对应文件即可。

---

### 常用脚本（`script/`）

本目录集中管理常用运维脚本。启动器为**纯 Node（零依赖）**，Windows 下推荐用 `win-start.cmd` / `win-stop.cmd` 直接走 `node`，避开 PowerShell 里 `bash` 被路由到 WSL 的坑；Git Bash / Linux / macOS 可用 `sh-start.sh` / `sh-stop.sh` 包装器（内部同样调用 Node）。所有脚本从 `script/` 内调用时会自动切到 `java-dev-env/` 根目录执行：

| 脚本 | 用途 |
|------|------|
| `script/start.mjs` | ★ 启动器核心逻辑（纯 Node 零依赖，**不直接执行**，由下方包装器调用） |
| `script/win-start.cmd` / `script/sh-start.sh` | 启动器包装：Windows 用 `win-start.cmd`，Linux/macOS/Git Bash 用 `sh-start.sh`；内部调用 `start.mjs`；也可 `node script/start.mjs redis mysql` 非交互直接启 |
| `script/win-stop.cmd` / `script/sh-stop.sh` | 停止并移除【全部】容器（`docker compose down`，`--clean` 含数据卷） |
| `script/sh-load-images.sh` | 离线恢复：把 `images/*.tar` 全部 `docker load` 导入 |
| `script/sh-save-images.sh` | 重新导出 compose 引用的全部镜像到 `images/`（升级版本后刷新离线包） |

> 新电脑离线部署推荐顺序：`script/sh-load-images.sh` → `.\script\win-start.cmd`（勾选要用的容器）。

---

## 六、部署与排错备忘

- **数据持久化**：所有有状态服务的数据均通过 bind mount 落到宿主机对应子目录，`docker compose down` 不会丢失数据。
- **`dev-` 前缀**：所有容器目录统一加 `dev-` 前缀，便于区分、迁移，也避免与宿主机其它项目命名冲突。
- **Kafka 监听写法坑**：apache 官方镜像的 KRaft 格式化会拦截监听器 host 写成字面量 `0.0.0.0`。当前对外采用省略 host 的 `PLAINTEXT://:9092`（等价于监听全部网卡并通过校验）；为让 compose 内服务（如 kafka-ui）直连，另加 `INTERNAL://:9094` 监听器（advertised `kafka:9094`）。
- **RabbitMQ 管理插件坑**：`rabbitmq:management` 靠 `/etc/rabbitmq/enabled_plugins` 启用管理插件；挂载空 `conf/` 覆盖默认值会导致插件不启用。已在 `dev-rabbitmq/conf/` 内置 `enabled_plugins` 与 `rabbitmq.conf` 修复。
- **ES 8/9 安全坑**：官方镜像默认开启 xpack 安全，本环境统一关闭以方便本地调用；切勿直接用于生产。
- **IK 插件版本对齐**：IK 分词插件主版本必须与 ES 主版本一致（7↔7.17.3、8↔8.17.3、9↔9.2.0），错配会导致 ES 启动失败（`NoSuchMethodError` 等）。当前三套均已对齐验证。
- **重建 jrebel 镜像**：其 `target/` 已包含在 `./dev-jrebel` build context 中，行为与原始布局一致。

---

## 七、可补充的开发工具 / 平台建议

当前栈已覆盖缓存、关系库、搜索引擎、消息队列、对象存储、反向代理、授权服务器、Kafka 可视化、Redis GUI、数据库管理与开发者工具箱。若想进一步贴近真实 Java / Spring Boot 微服务开发，还可考虑补充（在 `compose/` 下新增一个 `<name>.yaml` 并在根 `docker-compose.yml` 的 `include` 里加一行，例如新消息中间件加 `compose/<broker>.yaml`）：

- **对象存储**：`minio/minio` ✅ 已加入（见第十节），开箱即用
- **配置 / 注册中心**：`nacos/nacos`（阿里开源，配置管理 + 服务发现，国内 Spring Cloud Alibaba 标配）
- **分布式任务调度**：`xuxueli/xxl-job-admin` 或 `techpower/PowerJob`（定时任务）
- **流控熔断**：`bladex/sentinel-dashboard`（Spring Cloud 生态常用）
- **可视化运维 UI**：
  - `provectuslabs/kafka-ui` ✅ 已加入（见第九节），开箱即用
  - `redis/redisinsight` ✅ 已加入（见第十一节）
  - `dbeaver/cloudbeaver` ✅ 已加入（见第十二节，多库 + 中文）
  - `dev-navidog`（本地构建）✅ 已加入（见第十二节，仅 MySQL + 中文原生）
  - `portainer/portainer-ce`（Docker 容器管理面板）
- **监控**：`prom/prometheus` + `grafana/grafana`（指标采集 + 看板）
- **文档 / 知识库**：`linuxserver/bookstack` 或 `outlinewiki/outline`（团队文档）
- **其它数据库**：`postgres:16`（PG）、`mongo:7`（文档库）、`clickhouse/clickhouse-server`（OLAP 分析）
- **认证**：`quay.io/keycloak/keycloak`（统一身份 / SSO）

> 引入新组件时：在 `compose/` 下新增 `<name>.yaml`（声明 `profiles: [<name>]`），在根 `docker-compose.yml` 的 `include` 追加一行，并遵循「一个容器一个 `dev-` 目录」的约定，在本 README 第二节 / 第三节同步登记。

---

*最后更新：2026-09-29*
