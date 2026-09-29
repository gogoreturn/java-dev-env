#!/usr/bin/env node
// =============================================================================
// java-dev-env 交互式启动器（create-vue / clack 风格）
// -----------------------------------------------------------------------------
// 特性：
//   - 方向键 ↑/↓ 移动光标，空格勾选 / 取消，回车确认并启动
//   - a 全选 · n 全不选 · r 重置为「默认 6 件套」· q 退出不保存
//   - 勾选结果持久化到仓库根 .selection，下次进入自动回显
//   - 非交互：node start.mjs redis mysql   → 直接以给定服务启动并保存
//   - 辅助：node start.mjs --list          → 仅列出可启服务
//           node start.mjs --dry-run redis → 打印将执行的 docker 命令（不运行）
//
// 启动逻辑：docker compose up -d <勾选的服务名>
//   （每个服务都挂了同名 profile，但 compose 中显式点名服务即可绕过 profile 管控）
// =============================================================================

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const COMPOSE_DIR = resolve(ROOT, "compose");
const SEL_FILE = resolve(ROOT, ".selection");

// ---- 元数据：美化展示用（新增容器若不在下表，自动回退为服务名） -----------------
const DOMAIN_ORDER = ["dbcache", "object", "search", "messaging", "gateway", "gui", "tools"];
const DOMAIN_LABEL = {
  dbcache: "数据库与缓存",
  object: "对象存储",
  search: "搜索引擎",
  messaging: "消息队列",
  gateway: "网络代理",
  gui: "可视化管理",
  tools: "开发工具",
  other: "其它",
};
const META = {
  mysql: { label: "MySQL", desc: "关系型数据库", domain: "dbcache" },
  redis: { label: "Redis", desc: "缓存 / 会话", domain: "dbcache" },
  minio: { label: "MinIO", desc: "对象存储 (S3 兼容)", domain: "object" },
  elasticsearch7: { label: "Elasticsearch 7", desc: "搜索引擎", domain: "search" },
  elasticsearch8: { label: "Elasticsearch 8", desc: "搜索引擎", domain: "search" },
  elasticsearch9: { label: "Elasticsearch 9", desc: "搜索引擎", domain: "search" },
  rabbitmq: { label: "RabbitMQ", desc: "消息队列", domain: "messaging" },
  kafka: { label: "Kafka", desc: "消息队列 / 流处理", domain: "messaging" },
  "kafka-ui": { label: "Kafka UI", desc: "Kafka 可视化", domain: "messaging" },
  nginx: { label: "Nginx", desc: "反向代理", domain: "gateway" },
  redisinsight: { label: "RedisInsight", desc: "Redis 可视化管理", domain: "gui" },
  cloudbeaver: { label: "CloudBeaver", desc: "通用数据库管理", domain: "gui" },
  navidog: { label: "NaviDog", desc: "MySQL 可视化管理", domain: "gui" },
  jrebel: { label: "JRebel 授权服务器", desc: "Java 热部署授权", domain: "tools" },
  "it-tools": { label: "IT-Tools", desc: "开发常用小工具箱", domain: "tools" },
};
const CORE_DEFAULT = ["jrebel", "redis", "mysql", "nginx", "rabbitmq", "minio"];

// ---- 发现服务：解析 compose/*.yaml 中 services: 下的首个服务名 -----------------
function discoverServices() {
  const files = readdirSync(COMPOSE_DIR)
    .filter((f) => /\.ya?ml$/.test(f))
    .sort();
  const names = [];
  for (const f of files) {
    const txt = readFileSync(resolve(COMPOSE_DIR, f), "utf8");
    const m = /services:\s*\r?\n\s{2}([A-Za-z0-9_-]+):/.exec(txt);
    if (m && !names.includes(m[1])) names.push(m[1]);
  }
  return names;
}

function metaOf(name) {
  return (
    META[name] || {
      label: name,
      desc: "",
      domain: "other",
    }
  );
}

function readSelection(all) {
  if (!existsSync(SEL_FILE)) return null;
  const lines = readFileSync(SEL_FILE, "utf8")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const valid = lines.filter((s) => all.includes(s));
  return valid.length ? valid : null;
}

function buildModel(all) {
  // 按域分组，保持 DOMAIN_ORDER 顺序，未知域归到 other
  const byDomain = {};
  for (const name of all) {
    const d = metaOf(name).domain;
    (byDomain[d] ||= []).push(name);
  }
  const groups = [];
  for (const d of [...DOMAIN_ORDER, "other"]) {
    if (byDomain[d]) groups.push({ domain: d, names: byDomain[d] });
  }
  return groups;
}

// ---- ANSI 颜色 ---------------------------------------------------------------
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  gray: "\x1b[90m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

// ---- 非交互模式 -------------------------------------------------------------
function runNonInteractive(selected, dryRun) {
  const all = discoverServices();
  const valid = selected.filter((s) => all.includes(s));
  const invalid = selected.filter((s) => !all.includes(s));
  if (invalid.length) {
    console.log(`${c.yellow}忽略未知服务：${invalid.join(", ")}${c.reset}`);
  }
  if (!valid.length) {
    console.log(`${c.red}没有可启动的已知服务。${c.reset}`);
    process.exit(1);
  }
  writeFileSync(SEL_FILE, valid.join("\n") + "\n");
  const cmd = `docker compose up -d ${valid.join(" ")}`;
  console.log(`${c.cyan}▶ 已保存选择 → ${c.reset}${valid.join(", ")}`);
  if (dryRun) {
    console.log(`${c.dim}（dry-run）将执行：${cmd}${c.reset}`);
    return;
  }
  console.log(`${c.cyan}▶ 执行：${c.reset}${cmd}\n`);
  const r = spawnSync("docker", ["compose", "up", "-d", ...valid], {
    cwd: ROOT,
    stdio: "inherit",
  });
  process.exit(r.status ?? 0);
}

function listServices() {
  const groups = buildModel(discoverServices());
  for (const g of groups) {
    console.log(`${c.bold}${DOMAIN_LABEL[g.domain] || g.domain}${c.reset}`);
    for (const n of g.names) {
      const m = metaOf(n);
      console.log(
        `  ${c.green}●${c.reset} ${n.padEnd(16)} ${c.dim}${m.label}${
          m.desc ? " — " + m.desc : ""
        }${c.reset}`
      );
    }
  }
}

// ---- 交互模式 ---------------------------------------------------------------
function interactive() {
  const all = discoverServices();
  const groups = buildModel(all);
  const flat = groups.flatMap((g) => g.names); // 扁平可选项顺序

  // 初始勾选：上次选择 → 否则核心默认
  const saved = readSelection(all);
  const selected = new Set(saved || CORE_DEFAULT.filter((s) => all.includes(s)));
  let cursor = 0; // 在 flat 中的索引

  const stdout = process.stdout;
  const stdin = process.stdin;

  function render() {
    const count = selected.size;
    let out = "\x1b[2J\x1b[3J\x1b[H\x1b[?25l";
    out += `${c.cyan}${c.bold}◆  java-dev-env 启动器${c.reset}\n`;
    out += `${c.dim}  勾选需要的容器，回车启动（选择已持久化到 .selection）${c.reset}\n\n`;

    let fi = 0;
    for (const g of groups) {
      out += `${c.blue}${c.bold}${DOMAIN_LABEL[g.domain] || g.domain}${c.reset}\n`;
      for (const name of g.names) {
        const isCursor = fi === cursor;
        const on = selected.has(name);
        const m = metaOf(name);
        const box = on ? `${c.green}●${c.reset}` : `${c.gray}○${c.reset}`;
        const pointer = isCursor ? `${c.cyan}❯${c.reset}` : " ";
        const nameStr = isCursor
          ? `${c.bold}${name}${c.reset}`
          : name;
        const desc = m.desc ? `${c.dim}  ${m.label} — ${m.desc}${c.reset}` : `${c.dim}  ${m.label}${c.reset}`;
        out += `  ${pointer} ${box} ${nameStr.padEnd(18)}${desc}\n`;
        fi++;
      }
      out += "\n";
    }

    out += `${c.dim}  ↑/↓ 移动  空格 勾选  a 全选  n 全不选  r 重置  enter 启动  q 退出${c.reset}\n`;
    out += `${c.green}  已选 ${count} / ${flat.length}${c.reset}`;
    if (saved) out += `${c.dim}  （已读取上次选择）${c.reset}`;
    out += "\n\x1b[?25h";
    stdout.write(out);
  }

  function confirm() {
    cleanup();
    const chosen = flat.filter((n) => selected.has(n));
    if (!chosen.length) {
      console.log(`${c.yellow}未勾选任何容器，已退出。${c.reset}`);
      process.exit(0);
    }
    writeFileSync(SEL_FILE, chosen.join("\n") + "\n");
    const cmd = `docker compose up -d ${chosen.join(" ")}`;
    console.log(`${c.cyan}▶ 已保存选择 → ${c.reset}${chosen.join(", ")}`);
    console.log(`${c.cyan}▶ 执行：${c.reset}${cmd}\n`);
    const r = spawnSync("docker", ["compose", "up", "-d", ...chosen], {
      cwd: ROOT,
      stdio: "inherit",
    });
    process.exit(r.status ?? 0);
  }

  function cleanup() {
    stdin.setRawMode(false);
    stdin.removeAllListeners("data");
    stdin.pause();
  }

  function quit() {
    cleanup();
    console.log(`${c.dim}已退出，未保存本次修改。${c.reset}`);
    process.exit(0);
  }

  // 注：Git Bash / MSYS2 下 node 有时把交互终端误判为 !isTTY，但原始键盘模式其实可用。
  // 所以以「能否真正开启原始模式」为准，而非死守 isTTY——开启失败（真正非终端）才回退。
  try {
    stdin.setRawMode(true);
  } catch {
    console.log(
      `${c.yellow}当前不是交互式终端，无法启动勾选界面。${c.reset}\n` +
        `  Git Bash 下可先装 winpty，或用 PowerShell / cmd 跑 ${c.cyan}.\\script\\start.cmd${c.reset}（保证拿到原生控制台）。\n` +
        `  列出服务：${c.cyan}node script/start.mjs --list${c.reset}\n` +
        `  直接指定：${c.cyan}node script/start.mjs redis mysql${c.reset}`
    );
    process.exit(1);
  }
  stdin.resume();
  stdin.on("data", (buf) => {
    const s = buf.toString();
    if (s === "\x03") return quit(); // Ctrl+C
    if (s === "\x1b[A") {
      cursor = (cursor - 1 + flat.length) % flat.length;
      return render();
    }
    if (s === "\x1b[B") {
      cursor = (cursor + 1) % flat.length;
      return render();
    }
    if (s === " ") {
      const name = flat[cursor];
      selected.has(name) ? selected.delete(name) : selected.add(name);
      return render();
    }
    if (s === "\r" || s === "\n") return confirm();
    if (s === "a" || s === "A") {
      flat.forEach((n) => selected.add(n));
      return render();
    }
    if (s === "n" || s === "N") {
      selected.clear();
      return render();
    }
    if (s === "r" || s === "R") {
      selected.clear();
      CORE_DEFAULT.filter((s) => all.includes(s)).forEach((n) => selected.add(n));
      cursor = 0;
      return render();
    }
    if (s === "q" || s === "Q") return quit();
  });

  render();
}

// ---- 入口 -------------------------------------------------------------------
const args = process.argv.slice(2);
if (args.includes("--list")) {
  listServices();
} else if (args.includes("--dry-run")) {
  const picked = args.filter((a) => !a.startsWith("--"));
  runNonInteractive(picked, true);
} else if (args.length && !args.some((a) => a.startsWith("--"))) {
  runNonInteractive(args, false);
} else {
  interactive();
}
