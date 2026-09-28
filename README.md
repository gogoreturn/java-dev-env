# Java 本地开发环境（java-dev-env）

基于 Docker Compose 的一站式本地开发中间件栈。采用 **「一个容器一个目录」** 的布局，每个服务的 `数据 / 配置 / 日志` 都收纳在各自目录下，便于备份、迁移与清理。所有容器目录统一加 **`dev-` 前缀**，避免与宿主机其它项目冲突。

> 项目名（compose 网络名）：`java-dev-env`  
> 用途：在新电脑上快速拉起一套完整的中间件开发环境。

---

## 一、目录结构

```
java-dev-env/
├── docker-compose.yml              # 容器编排定义
├── images/                        # 离线镜像（docker save 产物，见第五节）
├── script/                        # 常用运维脚本（见第三节下方「常用脚本」）
│   ├── start.sh                   # 启动整套 / 指定服务
│   ├── stop.sh                    # 停止 / 销毁（--clean 含数据卷）
│   ├── status.sh                  # 容器状态 + HTTP/TCP 健康探测
│   ├── load-images.sh             # 新电脑一键导入镜像
│   └── save-images.sh             # 重新导出 compose 全部镜像
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
└── dev-minio/        { data }          # MinIO 对象存储（S3 兼容）
```

> `it-tools`、`kafka-ui`、`redisinsight`、`cloudbeaver`、`navidog` 为纯前端 / 无状态工具，无持久数据，不建独立目录。

---



## 二、容器总览

| 序号 | 服务名            | 容器名              | 镜像                              | 宿主机端口         | 说明                     |
| -- | -------------- | ---------------- | ------------------------------- | ------------- | ---------------------- |
| 1  | jrebel         | dev-jrebelServer | 本地构建（见 `dev-jrebel/Dockerfile`） | 10082 → 8081  | JRebel 授权服务器           |
| 2  | redis          | dev-redis        | redis:latest                    | 6379          | 缓存 / 队列（密码 `123456`）   |
| 3  | mysql          | dev-mysql        | mysql:9                         | 3306          | 关系型数据库                 |
| 4  | elasticsearch  | dev-es           | elasticsearch:7.17.3            | 9200 / 9300   | 搜索引擎（内置 IK 分词）         |
| 4b | elasticsearch8 | dev-es8          | elasticsearch:8.17.3            | 9201 / 9301   | ES 8（内置 IK，xpack 安全关闭） |
| 4c | elasticsearch9 | dev-es9          | elasticsearch:9.2.0             | 9202 / 9302   | ES 9（内置 IK，xpack 安全关闭） |
| 5  | nginx          | dev-nginx        | nginx:latest                    | 80 / 443 / 81 | 反向代理 / 静态服务            |
| 6  | it-tools       | it-tools-cn      | qingfeng2336/it-tools:latest    | 10081 → 80    | 前端开发者工具箱               |
| 7  | rabbitmq       | dev-rabbitmq     | rabbitmq:management             | 5672 / 15672  | 消息队列（带管理界面）            |
| 8  | kafka          | dev-kafka        | apache/kafka:3.9.0              | 9092          | 消息流平台（KRaft 单节点）       |
| 8b | kafka-ui | dev-kafka-ui | provectuslabs/kafka-ui:latest | 10083 → 8080 | Kafka 可视化管理 |
| 8c | minio | dev-minio | minio/minio:latest | 9000 / 9001 | 对象存储（S3 兼容） |
| 8d | redisinsight | dev-redisinsight | redis/redisinsight:latest | 5540 | Redis 可视化管理 |
| 8f | cloudbeaver | dev-cloudbeaver | dbeaver/cloudbeaver:latest | 8978 | 数据库管理 Web（DBeaver 网页版，多库，中文） |
| 8g | navidog | dev-navidog | dev-navidog:latest（本地构建） | 3001 | MySQL 管理 Web（Navicat 风格，中文原生） |

---

## 三、各容器关键信息

### 1. JRebel License Server（`dev-jrebel`）

- **镜像**：本地 `docker build`，`build.context` 指向 `./dev-jrebel`
- **端口**：`10082`（宿主机）→ `8081`（容器）
- **数据目录**：`dev-jrebel/`（`target/` 为构建产物，已含在 build context）
- **用途**：为 IDE 提供 JRebel 热部署授权
- **重建镜像**：`docker compose build jrebel`（改了 Java 代码后需先编译出 jar，再 build）

### 2. Redis（`dev-redis`）

- **镜像**：`redis:latest`
- **端口**：`6379`
- **目录映射**：
  - `./dev-redis/data` → `/data`（RDB / AOF 持久化文件）
  - `./dev-redis/conf` → `/usr/local/etc/redis`（配置文件，缺失时容器自动生成全量默认配置）
  - `./dev-redis/logs` → `/var/log/redis`
- **关键配置（默认生成）**：`bind 0.0.0.0`、`protected-mode no`、`appendonly yes`、`maxmemory 512mb`、`allkeys-lru`
- **密码**：`requirepass 123456`（配置文件已写入；自动生成的默认配置也会带上该密码）
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

- **镜像**：`nginx:latest`
- **端口**：`80` / `443` / `81`
- **目录映射**：
  - `./dev-nginx/conf/nginx.conf` → `/etc/nginx/nginx.conf`
  - `./dev-nginx/conf/conf.d` → `/etc/nginx/conf.d`（站点配置）
  - `./dev-nginx/data` → `/data`（站点静态资源）
  - `./dev-nginx/logs` → `/var/log/nginx`
- **用途**：反向代理、静态资源服务、多站点托管

### 6. IT-Tools（`it-tools`）

- **镜像**：`qingfeng2336/it-tools:latest`
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

- **镜像**：`provectuslabs/kafka-ui:latest`（已拉取并导出到 `images/kafka-ui-latest.tar`）
- **端口**：`10083`（宿主机）→ `8080`（容器）
- **连接 Kafka**：`kafka:9094`（compose 内 INTERNAL 监听器，见上方 Kafka 多监听器说明）
- **数据**：无状态（不建独立目录）
- **用途**：Kafka 集群可视化管理（Topic / 消费组 / 消息浏览 / 分区）
- **启用**：镜像已就绪，`docker compose up -d kafka-ui` 即可（访问 `http://localhost:10083`）
- **访问**：`http://localhost:10083`（启用后）

### 10. MinIO（`minio`）

- **镜像**：`minio/minio:latest`
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
- **镜像**：`redis/redisinsight:latest`
- **端口**：`5540`（宿主机）→ `5540`（容器）
- **数据**：无状态（不建独立目录）
- **用途**：Redis 可视化管理（键值浏览、内存分析、慢查询等）
- **连接 Redis**：在 UI 中添加连接，主机填 `redis`、端口 `6379`、密码 `123456`（同 compose 网络内用服务名 `redis` 即可访问）
- **访问**：`http://localhost:5540`

### 12. 数据库管理（CloudBeaver + NaviDog）

两套数据库管理 Web 工具并存，按需选用（均通过浏览器访问，无状态）：

#### 12a. CloudBeaver（`cloudbeaver`）
- **镜像**：`dbeaver/cloudbeaver:latest`
- **端口**：`8978`（宿主机）→ `8978`（容器）
- **数据**：无状态（不建独立目录）
- **用途**：DBeaver 网页版，现代 IDE 式 UI、内置简体中文（跟随浏览器语言），支持 **MySQL / PostgreSQL / SQLite / MariaDB** 等多库
- **连接 MySQL**：新增连接时选 `MySQL`，主机填 `mysql`、端口 `3306`、用户 `root`、密码 `ruoyi`、库 `dev_db`（同 compose 网络内用服务名 `mysql` 访问）
- **访问**：`http://localhost:8978`

#### 12b. NaviDog（`navidog`，本地构建）
- **镜像**：`dev-navidog:latest`（由 `dev-navidog/Dockerfile` 本地构建；上游 npm 包硬编码监听 `127.0.0.1`，已在 Dockerfile 内改为 `HOST` 可配，默认 `0.0.0.0`）
- **端口**：`3001`（宿主机）→ `3001`（容器）
- **数据**：无状态（不建独立目录）
- **用途**：轻量 Web 端 MySQL 管理工具，Navicat 风格、中文原生，功能含 SQL 编辑器、表格内增删改、CSV/Excel/JSON/SQL 导入导出、表结构设计、索引/外键；**仅支持 MySQL**
- **连接 MySQL**：工具栏「连接」→ 主机 `mysql`、端口 `3306`、用户 `root`、密码 `ruoyi`（同 compose 网络内用服务名 `mysql` 访问）
- **访问**：`http://localhost:3001`

---

## 四、常用操作

```bash
# 启动全部
docker compose up -d

# 仅启动某个服务
docker compose up -d rabbitmq kafka

# 查看状态
docker compose ps

# 查看某服务日志
docker compose logs -f kafka

# 停止并移除
docker compose down

# 重建某个镜像（如 jrebel）
docker compose build jrebel && docker compose up -d jrebel
```

---


## 五、离线镜像（新电脑快速部署）

为在无外网 / 拉取受限的新电脑上快速复现整套环境，本目录 `images/` 已用 `docker save` 预导出 compose 实际引用的全部镜像（标签中的 `:` 已转为 `-` 以兼容 Windows 文件名）：

| 文件                       | 对应镜像                          |                               |
| ------------------------ | ----------------------------- | ----------------------------- |
| dev-jrebel.tar           | dev-jrebel:latest（本地构建）       |                               |
| redis-latest.tar         | redis:latest                  |                               |
| mysql-9.tar              | mysql:9                       |                               |
| elasticsearch-7.17.3.tar | elasticsearch:7.17.3          |                               |
| elasticsearch-8.17.3.tar | elasticsearch:8.17.3          |                               |
| elasticsearch-9.2.0.tar  | elasticsearch:9.2.0           |                               |
| nginx-latest.tar         | nginx:latest                  |                               |
| it-tools-latest.tar      | qingfeng2336/it-tools:latest  |                               |
| rabbitmq-management.tar  | rabbitmq:management           |                               |
| kafka-3.9.0.tar          | apache/kafka:3.9.0            |                               |
| kafka-ui-latest.tar | provectuslabs/kafka-ui:latest |
| minio-latest.tar         | minio/minio:latest            |                               |
| redisinsight-latest.tar | redis/redisinsight:latest |
| cloudbeaver-latest.tar | dbeaver/cloudbeaver:latest |
| dev-navidog-latest.tar | dev-navidog:latest（本地构建） |

**新电脑恢复步骤**：

1. 安装并启动 Docker Desktop；
2. 把整个 `java-dev-env/` 目录（含 `images/`）拷到新电脑；
3. 在本目录下执行镜像导入脚本：
   ```bash
   # Windows（Git Bash / WSL）或 Linux / macOS 终端
   bash script/load-images.sh
   ```
   脚本会遍历 `images/*.tar` 逐个 `docker load` 导入；
4. 导入完成后直接启动：
   ```bash
   docker compose up -d
   ```

> 若镜像有变动（升级版本 / 新增服务），重新执行 `docker save -o images/<name>-<tag>.tar <repo>:<tag>` 覆盖对应文件即可。

---

### 常用脚本（`script/`）

本目录集中管理常用运维脚本（均为 Git Bash / WSL / Linux / macOS 可用的 bash 脚本；从 `script/` 内调用时会自动切到 `java-dev-env/` 根目录执行）：

| 脚本 | 用途 |
|------|------|
| `script/start.sh` | 启动整套环境（`docker compose up -d`，可带服务名参数） |
| `script/stop.sh` | 停止并移除容器（`docker compose down`） |
| `script/status.sh` | 一键检查所有服务的容器状态与 HTTP 健康 |
| `script/load-images.sh` | 离线恢复：把 `images/*.tar` 全部 `docker load` 导入 |
| `script/save-images.sh` | 重新导出 compose 引用的全部镜像到 `images/`（升级版本后刷新离线包） |

> 新电脑离线部署推荐顺序：`script/load-images.sh` → `script/start.sh` → `script/status.sh` 验证。

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

当前栈已覆盖缓存、关系库、搜索引擎、消息队列、对象存储、反向代理、授权服务器、Kafka 可视化、Redis GUI、数据库管理与开发者工具箱。若想进一步贴近真实 Java / Spring Boot 微服务开发，还可考虑补充（按需加入 `docker-compose.yml`）：

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

> 引入新组件时，建议同样遵循「一个容器一个 `dev-` 目录」的约定，并在本 README 第二节 / 第三节同步登记。

---

*最后更新：2026-09-28*
