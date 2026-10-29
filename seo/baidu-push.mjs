/**
 * 百度搜索资源平台 —— 普通收录「主动推送」
 *
 * 用法：
 *   1. 在百度搜索资源平台 → 站点管理 → 普通收录 → API 提交 里获取 token
 *   2. 把 token 存到 seo/baidu-token.txt（仅一行，已加入 .gitignore，不会提交）
 *   3. node seo/baidu-push.mjs            推送 sitemap.xml 里的全部 URL
 *      node seo/baidu-push.mjs <url> ...  只推送指定的 URL
 *
 * 配额说明：普通收录每日有提交额度（新站通常 10-100 条/天，随站点质量提升），
 * 超额度会返回 error=over quota，第二天再推即可。
 */
import { readFile, writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://www.lezhesoft.cn";
const TOKEN_FILE = join(ROOT, "seo", "baidu-token.txt");
const LOG_FILE = join(ROOT, "seo", "baidu-pushed.json");

const exists = async (p) => access(p).then(() => true).catch(() => false);

let token = process.env.BAIDU_TOKEN?.trim();
if (!token && (await exists(TOKEN_FILE))) token = (await readFile(TOKEN_FILE, "utf8")).trim();
if (!token) {
  console.error("缺少 token：请把百度搜索资源平台的推送 token 写入 seo/baidu-token.txt，或设置 BAIDU_TOKEN 环境变量。");
  process.exit(1);
}

const args = process.argv.slice(2).filter((a) => a.startsWith("http"));
let urls = args;
if (!urls.length) {
  const xml = await readFile(join(ROOT, "sitemap.xml"), "utf8");
  urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}
if (!urls.length) {
  console.error("没有可推送的 URL。");
  process.exit(1);
}

// 百度限制单次 ≤1000 条，分批提交
const BATCH = 1000;
let totalSuccess = 0;
let totalRemain = null;
const failed = [];

for (let i = 0; i < urls.length; i += BATCH) {
  const batch = urls.slice(i, i + BATCH);
  const res = await fetch(`http://data.zz.baidu.com/urls?site=${encodeURIComponent(SITE)}&token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: batch.join("\n"),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* 非 JSON 响应原样打印 */
  }
  if (json?.success) {
    totalSuccess += json.success;
    totalRemain = json.remain ?? totalRemain;
    console.log(`批次 ${i / BATCH + 1}：成功 ${json.success} 条，今日剩余额度 ${json.remain ?? "未知"}`);
    if (json.not_same_site?.length) console.log(`  站点不符 ${json.not_same_site.length} 条`);
    if (json.not_valid?.length) console.log(`  格式错误 ${json.not_valid.length} 条，例：${json.not_valid[0]}`);
  } else {
    console.error(`批次 ${i / BATCH + 1} 失败（HTTP ${res.status}）：${text}`);
    failed.push(...batch);
  }
}

const stamp = new Date().toISOString();
await writeFile(
  LOG_FILE,
  JSON.stringify({ lastRun: stamp, pushed: totalSuccess, remain: totalRemain, failed: failed.length, urls }, null, 2),
  "utf8"
);
console.log(`完成：成功 ${totalSuccess}/${urls.length} 条${totalRemain !== null ? `，今日剩余额度 ${totalRemain}` : ""}`);
console.log(`记录已写入 seo/baidu-pushed.json`);
if (failed.length) process.exitCode = 1;
