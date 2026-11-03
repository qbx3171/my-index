/**
 * IndexNow 主动推送（Bing / Yandex / Seznam 共用）——自动检测新增与变更页面
 *
 * 与 bing-push.mjs（SubmitUrlBatch，月配额 200）互补：IndexNow 无配额、分钟级响应，
 * 负责"有变更立刻通知"；bing-push 负责批量喂新 URL。
 *
 * 变更检测：sitemap.xml 全量 URL → 本地对应文件内容 md5，与上次快照比对；
 * 首次运行推全量建基线，此后只推新增/变更页（外加首页与 sitemap.xml 作为再抓取入口）。
 *
 * 用法：
 *   node seo/indexnow-push.mjs              增量推送（无变更则跳过）
 *   node seo/indexnow-push.mjs --status     只看上次快照状态
 *   node seo/indexnow-push.mjs --force <url> ...  强制推送指定 URL
 *
 * key：站点根目录 root.txt（keyLocation 即 https://www.lezhesoft.cn/root.txt），
 * 与每日巡检自动化 C3 用的 key 同源，本脚本直接读该文件，避免两处维护。
 * 状态：seo/.indexnow-state.json（本地快照，不上线也无所谓，丢了就重建基线全量推一次）
 */
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HOST = "www.lezhesoft.cn";
const ORIGIN = `https://${HOST}`;
const KEY_FILE = join(ROOT, "root.txt");
const STATE = join(ROOT, "seo", ".indexnow-state.json");
const ENDPOINT = "https://api.indexnow.org/indexnow";

const argv = process.argv.slice(2);
const key = existsSync(KEY_FILE) ? readFileSync(KEY_FILE, "utf8").trim() : "";
if (!/^[0-9a-f]{8,128}$/.test(key)) {
  console.error(`root.txt 内容不是合法 IndexNow key（得到 ${key.slice(0, 8)}…）`);
  process.exit(1);
}

const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : { hashes: {}, lastRun: null };
state.hashes = state.hashes ?? {};

// —— URL → 本地文件映射（sitemap 里出现过的路径都在仓库根目录有对应产物）——
const xml = readFileSync(join(ROOT, "sitemap.xml"), "utf8");
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
if (!urls.length) {
  console.error("sitemap.xml 为空");
  process.exit(2);
}
const fileOf = (url) => {
  const p = url.replace(ORIGIN, "").split("?")[0].split("#")[0];
  return join(ROOT, p === "/" ? "index.html" : p.replace(/^\//, ""));
};
const md5 = (buf) => createHash("md5").update(buf).digest("hex");

if (argv.includes("--status")) {
  const total = urls.length;
  const known = urls.filter((u) => state.hashes[u]).length;
  console.log(`sitemap URL：${total}；已有快照：${known}；上次运行：${state.lastRun ?? "从未"}`);
  process.exit(0);
}

// —— 计算增量 ——
const fresh = [];
for (const u of urls) {
  const f = fileOf(u);
  if (!existsSync(f)) continue; // sitemap 与磁盘短暂不一致，跳过等下一轮
  const h = md5(readFileSync(f));
  if (state.hashes[u] !== h) fresh.push(u);
}
if (argv.includes("--force")) {
  const forced = argv.filter((a) => a.startsWith("http"));
  for (const u of forced) if (!fresh.includes(u)) fresh.unshift(u);
}
// 有任何变更时，把首页与 sitemap 一起带上（入口页再抓取，让爬虫顺藤摸瓜）
if (fresh.length) {
  for (const u of [`${ORIGIN}/`, `${ORIGIN}/sitemap.xml`]) if (!fresh.includes(u)) fresh.push(u);
}

if (!fresh.length) {
  console.log(`[indexnow] 页面无变更，跳过（快照 ${Object.keys(state.hashes).length} 条）`);
  process.exit(0);
}

// —— 分批提交（单请求上限 10000，保守按 100 切批）——
let ok = 0;
const failed = [];
for (let i = 0; i < fresh.length; i += 100) {
  const batch = fresh.slice(i, i + 100);
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key, keyLocation: `${ORIGIN}/root.txt`, urlList: batch }),
  });
  if (res.status === 200 || res.status === 202) {
    ok += batch.length;
    console.log(`[indexnow] 批次 ${Math.floor(i / 100) + 1}: 提交 ${batch.length} 条（HTTP ${res.status}）`);
  } else {
    failed.push(...batch);
    console.error(`[indexnow] 批次 ${Math.floor(i / 100) + 1} 失败: HTTP ${res.status} ${await res.text().catch(() => "")}`.slice(0, 300));
    break; // IndexNow 对失败重试敏感，停在这里等下一轮
  }
}

// 只把成功提交的写入快照，失败的下一轮自动重试
if (ok) {
  for (const u of fresh.slice(0, ok)) {
    const f = fileOf(u);
    if (existsSync(f)) state.hashes[u] = md5(readFileSync(f));
    else state.hashes[u] = "missing";
  }
  state.lastRun = new Date().toISOString();
  writeFileSync(STATE, JSON.stringify(state), "utf8");
}
console.log(`[indexnow] 完成：提交 ${ok}/${fresh.length}${failed.length ? `，失败 ${failed.length} 条下轮重试` : ""}`);
if (ok === 0) process.exit(2);
