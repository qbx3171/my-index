/**
 * 百度搜索资源平台 —— 普通收录「主动推送」（按配额优先推送）
 *
 * 背景：百度普通收录每日额度很小（本站实测 10 条/天），所以不能一次推 177 条，
 * 必须按价值排序、逐条推送，并在配额耗尽时立即停止。
 *
 * 用法：
 *   node seo/baidu-push.mjs            推送到当日配额用尽（优先首页 > 分类页 > 最新软件页）
 *   node seo/baidu-push.mjs --status   只查看配额与已推记录，不推送
 *   node seo/baidu-push.mjs --force <url> ...  强制推送指定 URL（忽略历史去重）
 *
 * token 来源：seo/baidu-token.txt（已 gitignore）或 BAIDU_TOKEN 环境变量
 * 历史记录：seo/baidu-pushed.json（已 gitignore），记录已成功推送的 URL 与时间
 */
import { readFile, writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "www.lezhesoft.cn"; // 百度要求纯域名，带协议会返回 site init fail
const ORIGIN = `https://${SITE}`;
const TOKEN_FILE = join(ROOT, "seo", "baidu-token.txt");
const LOG_FILE = join(ROOT, "seo", "baidu-pushed.json");

const exists = async (p) => access(p).then(() => true).catch(() => false);
const argv = process.argv.slice(2);

let token = process.env.BAIDU_TOKEN?.trim();
if (!token && (await exists(TOKEN_FILE))) token = (await readFile(TOKEN_FILE, "utf8")).trim();
if (!token) {
  console.error("缺少 token：写入 seo/baidu-token.txt 或设置 BAIDU_TOKEN");
  process.exit(1);
}

// —— 已推历史 ——
let history = { pushed: [], lastRun: null, remain: null };
if (await exists(LOG_FILE)) {
  try {
    history = JSON.parse(await readFile(LOG_FILE, "utf8"));
  } catch {
    /* 损坏则重建 */
  }
}
if (!Array.isArray(history.pushed)) history.pushed = [];
const pushedSet = new Set(history.pushed.map((p) => (typeof p === "string" ? p : p.url)));

if (argv.includes("--status")) {
  console.log(`已成功推送：${history.pushed.length} 条`);
  console.log(`上次运行：${history.lastRun ?? "从未"}`);
  console.log(`上次剩余配额：${history.remain ?? "未知"}`);
  process.exit(0);
}

// —— 候选 URL：按价值排序 ——
// 首页 > 分类页（按收录软件数降序，分类页是分发到详情页的枢纽）> 软件详情页 > 教程页
const xml = await readFile(join(ROOT, "sitemap.xml"), "utf8");
const allUrls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

const { readdir } = await import("node:fs/promises");
const catFiles = await readdir(join(ROOT, "cat"));
const catWeight = new Map();
for (const f of catFiles) {
  if (!f.endsWith(".html")) continue;
  const html = await readFile(join(ROOT, "cat", f), "utf8");
  catWeight.set(f.replace(/\.html$/, ""), (html.match(/href="[^"]*\/soft\//g) || []).length);
}
const homepage = [`${ORIGIN}/`];
const catUrls = allUrls
  .filter((u) => u.includes("/cat/"))
  .sort((a, b) => {
    const w = (u) => catWeight.get(u.split("/cat/")[1]?.replace(/\.html$/, "")) ?? 0;
    return w(b) - w(a);
  });
const softUrls = allUrls.filter((u) => u.includes("/soft/"));
const tutUrls = allUrls.filter((u) => u.includes("/tutorial/"));
const ordered = [...homepage, ...catUrls, ...softUrls, ...tutUrls];
const candidates = [...new Set(ordered)];

const forceUrls = argv.filter((a) => a.startsWith("http"));
const queue = forceUrls.length ? forceUrls : candidates.filter((u) => !pushedSet.has(u));

if (!queue.length) {
  console.log("没有待推送的新 URL（全部已推过）。加 --force <url> 可强制重推。");
  process.exit(0);
}

console.log(`候选 ${queue.length} 条待推；已推历史 ${history.pushed.length} 条`);

// —— 逐条推送，配额耗尽即停 ——
let success = 0;
let remain = null;
let stopReason = "";

for (const url of queue) {
  const api = `http://data.zz.baidu.com/urls?site=${SITE}&token=${encodeURIComponent(token)}`;
  let res, text;
  try {
    res = await fetch(api, { method: "POST", headers: { "Content-Type": "text/plain" }, body: url });
    text = await res.text();
  } catch (e) {
    stopReason = `网络异常：${e.message}`;
    break;
  }
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* ignore */
  }
  if (json?.success) {
    success++;
    remain = json.remain ?? remain;
    if (!pushedSet.has(url)) {
      pushedSet.add(url);
      history.pushed.push({ url, at: new Date().toISOString() });
    }
    console.log(`✓ ${url}（剩余额度 ${remain}）`);
    if (remain === 0) {
      stopReason = "今日配额已用尽";
      break;
    }
  } else {
    stopReason = `停止：${text}`;
    if (json?.not_same_site?.length) console.log(`  ${url} 不属于本站，跳过`);
    break;
  }
}

history.lastRun = new Date().toISOString();
history.remain = remain;
await writeFile(LOG_FILE, JSON.stringify(history, null, 2), "utf8");

console.log(`\n本次成功推送 ${success} 条，剩余额度 ${remain ?? "未知"}`);
if (stopReason) console.log(`结束原因：${stopReason}`);
console.log(`累计已推 ${history.pushed.length} 条；记录：seo/baidu-pushed.json`);
