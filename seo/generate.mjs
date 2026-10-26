/**
 * 乐哲软件静态 SEO 页生成器（GitHub Pages 版）
 * 数据源：Supabase（经腾讯 CloudBase 代理）；key 从 index.html 动态读取，与前端保持同源
 * 产物：/soft/*.html  /cat/*.html  /tutorial/*.html  sitemap.xml  sitemap.html
 * 运行：node seo/generate.mjs
 */
import { mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  renderSoftPage,
  renderCategoryPage,
  renderTutorialPage,
  renderSitemapXml,
  renderSitemapHtml,
  catSlug,
} from "./render.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// key 与前端同源：直接从 index.html 提取，前端换 key 这里自动跟着换
const indexHtml = await readFile(join(ROOT, "index.html"), "utf8");
const keyMatch = indexHtml.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/);
const urlMatch = indexHtml.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);
if (!keyMatch || !urlMatch) {
  console.error("未能从 index.html 提取 SUPABASE_URL / SUPABASE_ANON_KEY");
  process.exit(1);
}
const SUPABASE_URL = urlMatch[1];
const KEY = keyMatch[1];

async function sb(query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  if (!res.ok) throw new Error(`supabase ${res.status}: ${query.slice(0, 60)}`);
  return res.json();
}

const softs = await sb("software?select=*&limit=1000");
const tutorials = await sb("tutorials?select=*&limit=500");
console.log(`数据：software=${softs.length}，tutorials=${tutorials.length}`);

// 清理旧产物，避免删除的软件留下死页
for (const dir of ["soft", "cat", "tutorial"]) {
  await rm(join(ROOT, dir), { recursive: true, force: true });
  await mkdir(join(ROOT, dir), { recursive: true });
}

let count = 0;
for (const s of softs) {
  const related = softs.filter((x) => x.category === s.category && x.id !== s.id).slice(0, 8);
  const { html } = renderSoftPage(s, related);
  await writeFile(join(ROOT, "soft", `${encodeURIComponent(s.id)}.html`), html, "utf8");
  count++;
}
console.log(`软件详情页：${count}`);

let tCount = 0;
for (const t of tutorials) {
  const related = tutorials.filter((x) => x.id !== t.id).slice(0, 6);
  const { html } = renderTutorialPage(t, related);
  await writeFile(join(ROOT, "tutorial", `${encodeURIComponent(t.id)}.html`), html, "utf8");
  tCount++;
}
console.log(`教程页：${tCount}`);

const cats = [...new Set(softs.map((s) => s.category).filter(Boolean))];
let cCount = 0;
for (const c of cats) {
  const { html } = renderCategoryPage(c, softs.filter((s) => s.category === c));
  // ASCII slug 文件名，杜绝编码问题
  await writeFile(join(ROOT, "cat", `${catSlug(c)}.html`), html, "utf8");
  cCount++;
}
console.log(`分类页：${cCount}`);

await writeFile(join(ROOT, "sitemap.xml"), renderSitemapXml(softs, tutorials), "utf8");
const sm = renderSitemapHtml(softs, tutorials);
await writeFile(join(ROOT, "sitemap.html"), sm.html, "utf8");
console.log(`sitemap.xml + sitemap.html 完成（共 ${softs.length + tutorials.length + cats.length + 2} 个 URL）`);
