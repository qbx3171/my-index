/**
 * 线上静态资源探活：逐个 HEAD 线上图片，抓「本地有、线上 404」这类远程漂移
 *
 * 为什么需要它：site-check/audit 查的是磁盘，磁盘上文件都在也不代表线上有。
 * 2026-11-06 教程封面全 404 时，本地 11 张 PNG 一张不少，本地体检全绿。
 *
 * 用法：node seo/live-assets.mjs
 * 退出码：0 全 200；2 有非 200
 */
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://www.lezhesoft.cn";
const DIRS = ["tutorial/cover", "assets/ai-logos"];

const targets = [];
for (const d of DIRS) {
  let names = [];
  try {
    names = (await readdir(join(ROOT, d))).filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f));
  } catch {
    continue;
  }
  for (const n of names) targets.push({ dir: d, name: n, url: `${BASE}/${d}/${n}` });
}

// 首屏静态快照也要探活：它 404 时页面不会报错，只会静默退回经代理的 REST（慢一倍），
// 从界面完全看不出来 —— 属于典型的「静默退化」，必须单独查。
let snapLocal = null;
try {
  snapLocal = JSON.parse(await readFile(join(ROOT, "data", "software.json"), "utf8"));
  targets.push({ dir: "data", name: "software.json", url: `${BASE}/data/software.json` });
} catch {
  console.log("⚠ 本地没有 data/software.json，跳过快照探活（跑一次 node seo/generate.mjs 生成）");
}

const bad = [];
const check = async (t) => {
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(t.url, { method: "HEAD", cache: "no-store" });
      if (r.ok) return;
      if (i === 1) bad.push(`${r.status} ${t.dir}/${t.name}`);
    } catch (e) {
      if (i === 1) bad.push(`ERR ${t.dir}/${t.name} ${e.message.slice(0, 30)}`);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
};

// 并发 8，避免把 Pages 打太狠
for (let i = 0; i < targets.length; i += 8) {
  await Promise.all(targets.slice(i, i + 8).map(check));
}

const byDir = {};
for (const t of targets) byDir[t.dir] = (byDir[t.dir] || 0) + 1;
console.log("===== 线上资源探活 =====");
for (const [d, n] of Object.entries(byDir)) console.log(`${d}: ${n} 个`);
// 内容校验：线上快照能否解析、条数是否与本地一致（防止推上去的是半截/空文件）
if (snapLocal) {
  try {
    const r = await fetch(`${BASE}/data/software.json`, { cache: "no-store" });
    const live = await r.json();
    const liveCount = Array.isArray(live.software) ? live.software.length : 0;
    const localCount = Array.isArray(snapLocal.software) ? snapLocal.software.length : 0;
    if (!liveCount) bad.push(`EMPTY data/software.json（线上解析出 0 条）`);
    else if (liveCount !== localCount) console.log(`ℹ 快照条数：线上 ${liveCount} / 本地 ${localCount}（发布后差几条属 CDN 缓存的正常时差）`);
    else console.log(`快照内容：线上 ${liveCount} 条，与本地一致`);
  } catch (e) {
    bad.push(`BAD data/software.json 解析失败 ${e.message.slice(0, 40)}`);
  }
}

if (bad.length) {
  console.log(`\n❌ 线上缺失 ${bad.length} 个：`);
  bad.forEach((b) => console.log("  - " + b));
  console.log("\n处理：先 `node seo/api-push.mjs \"补推缺失资源\"`（会自动补「本地有、远程没有」的文件），再等 60s 重跑本脚本。");
} else {
  console.log(`\n✅ 全部 ${targets.length} 个资源线上可访问`);
}
process.exit(bad.length ? 2 : 0);
