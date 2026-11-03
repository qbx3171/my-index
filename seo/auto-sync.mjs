/**
 * 本地自动同步守卫：对比 Supabase 数据指纹，有变更才重新生成并推送上线。
 * 由 WorkBuddy 定时自动化调用；也可手动运行：node seo/auto-sync.mjs
 * 幂等：无变更时零操作；生成器乱码自愈重试 3 次；推送用 git credential 管理器里的令牌。
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
process.chdir(ROOT);

const indexHtml = readFileSync("index.html", "utf8");
const U = indexHtml.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/)[1];
const K = indexHtml.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/)[1];
const H = { apikey: K, Authorization: `Bearer ${K}` };

async function get(url) {
  const r = await fetch(url, { headers: H });
  if (!r.ok) throw new Error(`${url.split("/rest/v1/")[1]?.split("?")[0]}: ${r.status}`);
  return r.json();
}

async function fingerprint() {
  const fp = {};
  // AI 两表行数少：全量内容哈希（编辑/删除也能检测到）
  for (const t of ["ai_collections", "ai_tools", "tutorials"]) {
    const rows = await get(`${U}/rest/v1/${t}?select=*`);
    fp[t] = createHash("md5").update(JSON.stringify(rows)).digest("hex").slice(0, 10);
  }
  // software 表大：条数 + 最新 created_at（新增可检测；编辑由每日任务兜底）
  const sw = await get(`${U}/rest/v1/software?select=created_at&order=created_at.desc&limit=1`);
  const swAll = await get(`${U}/rest/v1/software?select=id`);
  fp.software = `${swAll.length}:${sw[0]?.created_at || "none"}`;
  return fp;
}

function sameFp(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function sh(cmd) {
  return execSync(cmd, { encoding: "utf8", cwd: ROOT, timeout: 600000 });
}

const STATE_FILE = "seo/.sync-state.json";
let prev = null;
if (existsSync(STATE_FILE)) {
  try { prev = JSON.parse(readFileSync(STATE_FILE, "utf8")); } catch {}
}

const now = new Date().toISOString().slice(11, 19);
let fp;
try {
  fp = await fingerprint();
} catch (e) {
  console.error(`[${now}] 拉取数据失败: ${e.message}`);
  process.exit(1);
}

if (prev && sameFp(prev, fp)) {
  console.log(`[${now}] 数据无变更，跳过`);
  process.exit(0);
}

console.log(`[${now}] 检测到数据变更，开始重新生成…`);
let ok = false;
for (let i = 1; i <= 3; i++) {
  try {
    sh("node seo/generate.mjs");
    ok = true;
    break;
  } catch (e) {
    console.log(`第${i}次生成失败（疑似传输乱码），重试`);
  }
}
if (!ok) {
  console.error("连续 3 次生成失败");
  process.exit(2);
}

// 推送（本地 push 被墙，走 GitHub API 脚本；Windows execSync 走 cmd，须用 env 传令牌）
const dirty = sh("git status --porcelain -uall").trim();
if (dirty) {
  const token = sh('printf "protocol=https\\nhost=github.com\\n\\n" | git credential fill | grep "^password=" | cut -d= -f2- | tr -d "\\r\\n"').trim();
  try {
    const out = execSync('node seo/api-push.mjs "auto: 同步后台数据变更（自动守卫）"', {
      encoding: "utf8", cwd: ROOT, timeout: 600000,
      env: { ...process.env, GH_TOKEN: token },
    });
    console.log(out.trim().split("\n").pop());
  } catch (e) {
    console.error("推送失败:", String(e.stderr || e.message).slice(0, 300));
    process.exit(3);
  }
} else {
  console.log("生成产物与线上一致，无需推送");
}

writeFileSync(STATE_FILE, JSON.stringify(fp, null, 1));
console.log(`[${now}] 同步完成 ✓`);
