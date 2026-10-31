// Bing 站长 API 每日推送：从线上 sitemap 取 URL，增量提交给必应 SubmitUrlBatch
// 用法: node seo/bing-push.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const KEY = readFileSync(join(ROOT, 'bing-api-key.txt'), 'utf8').trim();
const SITE = 'https://www.lezhesoft.cn/';
const API = 'https://ssl.bing.com/webmaster/api.svc/json';
const STATE = join(ROOT, 'bing-batched.json');
const pushed = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {};

// 1. 拉线上 sitemap
const xml = await (await fetch('https://www.lezhesoft.cn/sitemap.xml')).text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
if (!urls.length) { console.error('sitemap 为空'); process.exit(2); }

// 2. 增量筛选（首页每天必推，其余只推没推过的）
const fresh = urls.filter(u => u === SITE || !pushed[u]);
if (!fresh.length) { console.log('无新增 URL，跳过'); process.exit(0); }

// 3. 分批提交（每批最多 500，日配额 100）
let ok = 0;
for (let i = 0; i < fresh.length; i += 100) {
  const batch = fresh.slice(i, i + 100);
  const r = await fetch(`${API}/SubmitUrlBatch?apikey=${KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ siteUrl: SITE, urlList: batch }),
  });
  const j = await r.json().catch(() => ({}));
  if (j.d === null || j.d === undefined) { // d:null 即成功
    ok += batch.length;
    for (const u of batch) pushed[u] = new Date().toISOString().slice(0, 10);
    console.log(`批次 ${i / 100 + 1}: 提交 ${batch.length} 条`);
  } else {
    console.error(`批次 ${i / 100 + 1} 失败:`, JSON.stringify(j));
    process.exit(2);
  }
}
writeFileSync(STATE, JSON.stringify(pushed, null, 1));
console.log(`完成：共提交 ${ok}/${fresh.length} 条给必应`);
