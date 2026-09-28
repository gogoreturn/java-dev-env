#!/usr/bin/env bash
#
# 查看服务状态 + HTTP / TCP 健康探测
# 用法：
#   cd java-dev-env
#   bash script/status.sh
#
set -uo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==================== Docker Compose 状态 ===================="
docker compose ps
echo

# HTTP 类服务（带 Web UI）：服务名 -> 本地 URL
declare -A HTTP_CHECKS=(
  [jrebel]="http://localhost:10082"
  [elasticsearch7]="http://localhost:9200"
  [elasticsearch8]="http://localhost:9201"
  [elasticsearch9]="http://localhost:9202"
  [nginx]="http://localhost:80"
  [it-tools]="http://localhost:10081"
  [rabbitmq]="http://localhost:15672"
  [kafka-ui]="http://localhost:10083"
  [minio]="http://localhost:9000"
  [redisinsight]="http://localhost:5540"
  [cloudbeaver]="http://localhost:8978"
  [navidog]="http://localhost:3001"
)

echo "==================== HTTP 健康探测 ===================="
# 健康探测段不受 set -e 影响：单个 curl 失败不应中断整脚本
set +e
for svc in "${!HTTP_CHECKS[@]}"; do
  url="${HTTP_CHECKS[$svc]}"
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$url" 2>/dev/null)
  code="${code:-000}"
  if [ "$code" = "000" ]; then
    printf "  %-16s %-34s ❌ 无法连接\n" "$svc" "$url"
  else
    printf "  %-16s %-34s ✅ HTTP %s\n" "$svc" "$url" "$code"
  fi
done

echo
echo "==================== TCP 端口探测（非 HTTP 服务） ===================="
tcp_check() {
  local name="$1" host="$2" port="$3"
  if timeout 2 bash -c "exec 3<>/dev/tcp/$host/$port" 2>/dev/null; then
    printf "  %-16s tcp %s:%s ✅ 端口可达\n" "$name" "$host" "$port"
  else
    printf "  %-16s tcp %s:%s ❌ 端口不可达\n" "$name" "$host" "$port"
  fi
}
tcp_check "redis" localhost 6379
tcp_check "mysql" localhost 3306
tcp_check "kafka" localhost 9092
set -e

echo
echo "提示：容器存活以 docker compose ps 为准；上方探测仅验证端口可达性。"
