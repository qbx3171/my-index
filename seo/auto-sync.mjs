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

// 传输层会把汉字随机截成 U+FFFD（同一份数据连读两次坏在不同位置）。
// 直接用 JSON 全量哈希会让「内容没变」也判成变了 → 每小时白跑一次生成与推送。
// 对策：单表读 3 次按行按字段合并（优先取无乱码的值），再剔除 U+FFFD 后哈希。
// 真实编辑仍会改变哈希（其余字符变了），只有「整段恰好被乱码吃掉」才会漏检，概率可忽略。
const FFD = "\uFFFD";
const ffdN = (s) => String(s).split(FFD).length - 1;
const stripFFD = (o) =>
  Array.isArray(o)
    ? o.map(stripFFD)
    : o && typeof o === "object"
      ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, stripFFD(v)]))
      : typeof o === "string"
        ? o.split(FFD).join("")
        : o;

async function stableRows(t) {
  const reads = [];
  for (let i = 0; i < 3; i++) {
    try {
      reads.push(await get(`${U}/rest/v1/${t}?select=*`));
    } catch {
      /* 单次失败不致命 */
    }
  }
  if (!reads.length) throw new Error(`${t}: 三次读取全部失败`);
  const merged = new Map();
  for (const arr of reads) {
    for (const row of arr) {
      const key = row.id ?? JSON.stringify(row);
      if (!merged.has(key)) {
        merged.set(key, { ...row });
        continue;
      }
      const acc = merged.get(key);
      for (const [k, v] of Object.entries(row)) {
        if (typeof v !== "string" || typeof acc[k] !== "string") {
          if (acc[k] === undefined) acc[k] = v;
          continue;
        }
        if (ffdN(v) < ffdN(acc[k])) acc[k] = v;
      }
    }
  }
  return [...merged.values()];
}

// 整表读合并后仍脏的行：按「单字段小响应」重拉（响应越小越不易被截断），
// 并轮换 select 顺序以绕开「坏响应被代理缓存」——同一 URL 反复拿到同一份坏数据。
async function healRows(t, rows) {
  const dirtyFields = (row) =>
    Object.entries(row).filter(([, v]) => typeof v === "string" && v.includes(FFD)).map(([k]) => k);
  for (const row of rows) {
    for (let round = 0; round < 4 && dirtyFields(row).length; round++) {
      const fields = dirtyFields(row);
      for (const f of fields) {
        const sel = round % 2 ? `id,${f}` : `${f},id`;
        try {
          const rr = await get(`${U}/rest/v1/${t}?select=${encodeURIComponent(sel)}&id=eq.${encodeURIComponent(row.id)}`);
          const fresh = rr[0]?.[f];
          if (typeof fresh === "string" && !fresh.includes(FFD)) row[f] = fresh;
        } catch {
          /* 单字段重拉失败不影响其它字段 */
        }
      }
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  return rows;
}

// 指纹分两段：
//   s = 结构哈希（id 集合 + 名称/标题/排序/发布状态等短字段），长度短、几乎不会被截断，恒稳；
//   c = 内容哈希（全字段，剔除 U+FFFD 后），只在三次读取合并后确实无乱码时才更新，
//       否则沿用上一轮的 c（读不到干净版本 ≠ 内容变了）。
// 判定变更：s 变了，或 c 在两侧都有值时变了。
// 取舍：教程正文这类长文本的「纯文字微调」在脏读时可能延迟一轮才发现，由
// 后台保存时的 ai-sync dispatch 与每日巡检兜底；新增/删除/改名永远即时生效。
const structural = (row) =>
  Object.fromEntries(
    Object.entries(row).filter(([k, v]) => {
      if (k === "id") return true;
      if (typeof v === "string") return v.length <= 200;
      return typeof v === "number" || typeof v === "boolean" || v === null;
    })
  );

async function fingerprint(prev) {
  const fp = {};
  for (const t of ["ai_collections", "ai_tools", "tutorials"]) {
    const rows = await healRows(t, await stableRows(t));
    const clean = rows.every((r) => !Object.values(r).some((v) => typeof v === "string" && v.includes(FFD)));
    const s = createHash("md5").update(JSON.stringify(rows.map((r) => stripFFD(structural(r))))).digest("hex").slice(0, 10);
    const c = clean
      ? createHash("md5").update(JSON.stringify(stripFFD(rows))).digest("hex").slice(0, 10)
      : (prev?.[t] && typeof prev[t] === "object" ? prev[t].c : null);
    fp[t] = { s, c };
  }
  // software 表大：条数 + 最新 created_at（新增可检测；编辑由每日任务兜底）
  const sw = await get(`${U}/rest/v1/software?select=created_at&order=created_at.desc&limit=1`);
  const swAll = await get(`${U}/rest/v1/software?select=id`);
  fp.software = `${swAll.length}:${sw[0]?.created_at || "none"}`;
  return fp;
}

function sameFp(a, b) {
  return Object.keys({ ...a, ...b }).every((k) => {
    const x = a?.[k];
    const y = b?.[k];
    if (x && y && typeof x === "object" && typeof y === "object") {
      if (x.s !== y.s) return false;
      return !(x.c && y.c) || x.c === y.c;
    }
    return JSON.stringify(x) === JSON.stringify(y);
  });
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
// --dry：只打印当前指纹（不生成、不推送），用于排查「是否真的变了」与重建状态文件
const DRY = process.argv.includes("--dry");
let fp;
try {
  fp = await fingerprint(prev);
} catch (e) {
  console.error(`[${now}] 拉取数据失败: ${e.message}`);
  process.exit(1);
}

if (DRY) {
  console.log(JSON.stringify(fp, null, 1));
  process.exit(0);
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
