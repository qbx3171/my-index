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
  platformLabel,
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

// —— 抗传输抖动抓取 ——
// CloudBase 代理偶发把多字节汉字截断，解码后被替换成 U+FFFD（每次请求坏的位置随机，
// 已实测同一查询 4 次返回的乱码位置/数量均不同；数据库本身是干净的）。
// 策略：同一查询请求多次，按记录 id 逐字段合并，优先取无乱码（或乱码更少）的版本。
const FFD = "\uFFFD";
const ffdCount = (s) => {
  let n = 0, i = -1;
  while ((i = s.indexOf(FFD, i + 1)) !== -1) n++;
  return n;
};

async function fetchOnce(query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  if (!res.ok) throw new Error(`supabase ${res.status}: ${query.slice(0, 60)}`);
  return JSON.parse(Buffer.from(await res.arrayBuffer()).toString("utf8"));
}

async function sb(query, copies = 5) {
  const parsed = [];
  let lastErr;
  for (let i = 0; i < copies; i++) {
    try {
      parsed.push(await fetchOnce(query));
    } catch (e) {
      lastErr = e;
    }
    if (i < copies - 1) await new Promise((r) => setTimeout(r, 300));
  }
  if (!parsed.length) throw lastErr ?? new Error("supabase 请求全部失败");
  const first = parsed[0];
  if (!Array.isArray(first)) return first;

  const merged = new Map();
  for (const arr of parsed) {
    for (const row of arr) {
      const key = row.id ?? JSON.stringify(row);
      if (!merged.has(key)) {
        merged.set(key, { ...row });
        continue;
      }
      const acc = merged.get(key);
      for (const [k, v] of Object.entries(row)) {
        if (typeof v === "string" && v.includes(FFD)) {
          const cur = acc[k];
          // 当前副本更干净则保留不动；两边都脏才取乱码更少的
          if (!(typeof cur === "string" && cur.includes(FFD))) continue;
          if (ffdCount(v) < ffdCount(cur)) acc[k] = v;
        } else {
          acc[k] = v;
        }
      }
    }
  }
  const rows = [...merged.values()];
  // 治愈环节：合并后仍有乱码的记录，改用按 id 的单条小响应重拉
  // （响应越小越不容易被代理截断），最多重试 5 轮
  const table = query.split("?")[0];
  for (let round = 0; round < 5; round++) {
    const badIds = rows
      .filter((r) => Object.values(r).some((v) => typeof v === "string" && v.includes(FFD)))
      .map((r) => r.id)
      .filter(Boolean);
    if (!badIds.length) return rows;
    for (const id of badIds) {
      try {
        const fresh = await fetchOnce(`${table}?select=*&id=eq.${encodeURIComponent(id)}`);
        const row = Array.isArray(fresh) ? fresh[0] : fresh;
        const acc = rows.find((r) => r.id === id);
        if (!row || !acc) continue;
        for (const [k, v] of Object.entries(row)) {
          if (typeof v !== "string") continue;
          if (!v.includes(FFD)) acc[k] = v;
          else if (typeof acc[k] === "string" && acc[k].includes(FFD) && ffdCount(v) < ffdCount(acc[k])) acc[k] = v;
        }
      } catch {
        /* 单条重拉失败不致命，下一轮再试 */
      }
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  const bad = [];
  for (const row of rows)
    for (const [k, v] of Object.entries(row))
      if (typeof v === "string" && v.includes(FFD)) bad.push(`${row.id ?? "?"}/${k}`);
  if (bad.length) console.warn(`⚠ 治愈 ${5} 轮后仍有乱码字段（源数据可能真的损坏）: ${bad.join(", ")}`);
  return rows;
}

// —— 源数据定点修复 ——
// 个别记录在数据源里早期就丢字（git 历史无更早版本可考证），按上下文修复。
const TEXT_FIXUPS = [
  {
    id: "d05e874d28573342261a189c", // Windows 11
    field: "description",
    from: /更顺\uFFFD+的交互/,
    to: "更顺畅的交互",
  },
];
function applyFixups(rows) {
  for (const row of rows) {
    for (const fx of TEXT_FIXUPS) {
      if (fx.id && row.id !== fx.id) continue;
      const v = row[fx.field];
      if (typeof v === "string" && fx.from.test(v)) row[fx.field] = v.replace(fx.from, fx.to);
    }
  }
  return rows;
}

const softs = applyFixups(await sb("software?select=*&limit=1000"));
const tutorials = applyFixups(await sb("tutorials?select=*&limit=500"));
console.log(`数据：software=${softs.length}，tutorials=${tutorials.length}`);

// 清理旧产物，避免删除的软件留下死页
for (const dir of ["soft", "cat", "tutorial"]) {
  await rm(join(ROOT, dir), { recursive: true, force: true });
  await mkdir(join(ROOT, dir), { recursive: true });
}

let count = 0;
// 标题/描述去重：同名的记录（通常是 Windows/Mac 两个平台各一条，或有克隆记录），
// 标题与描述里追加平台后缀，避免「许多页面具有相同标题/描述」
const nameCounts = new Map();
for (const s of softs) nameCounts.set(s.name ?? "", (nameCounts.get(s.name ?? "") || 0) + 1);
const rendered = softs.map((s) => {
  const related = softs.filter((x) => x.category === s.category && x.id !== s.id).slice(0, 8);
  const dup = (nameCounts.get(s.name ?? "") || 0) > 1;
  return { s, related, ...renderSoftPage(s, related, dup ? { dupPlatform: platformLabel(s) || s.id } : {}) };
});
// 描述碰撞兜底：名字有细微差别的克隆记录（同名不同版本）描述可能雷同，
// 对最终 meta description 相同的页面强制追加「版本+平台」尾注后重渲染
const descGroups = new Map();
for (const b of rendered) {
  const m = b.html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";
  if (!descGroups.has(m)) descGroups.set(m, []);
  descGroups.get(m).push(b);
}
for (const group of descGroups.values()) {
  if (group.length < 2) continue;
  for (const b of group) {
    const re = renderSoftPage(b.s, b.related, { forceDescTail: true });
    b.html = re.html;
    b.title = re.title;
  }
  console.log(`检测到 ${group.length} 个页面描述雷同，已强制区分: ${group.map((b) => b.s.name).join(" / ")}`);
}
for (const b of rendered) {
  await writeFile(join(ROOT, "soft", `${encodeURIComponent(b.s.id)}.html`), b.html, "utf8");
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
