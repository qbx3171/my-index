// AI 工具集板块（/ai/）
// 数据模型：ai_collections（工具集，每集一个独立页面）← ai_tools（集内工具）
// 数据由站长在 ai-admin.html 后台上传，这里只做静态渲染。
// 表不存在或为空时优雅降级：仍生成 /ai/index.html 导航首页（导航入口的落点），其余跳过。
import { mkdir, writeFile, readdir, rm } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { head, foot, crumb, jsonLd, SITE } from "./render.js";

const AI_CSS = `
<link rel="stylesheet" href="${SITE}/ai/ai.css">
`;

// —— Supabase 连接信息从仓库 index.html 提取 ——
function supabaseCreds() {
  const h = readFileSync(join(process.cwd(), "index.html"), "utf8");
  const U = h.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/)[1];
  const K = h.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/)[1];
  return { U, K };
}

async function fetchTable(U, K, table) {
  const r = await fetch(`${U}/rest/v1/${table}?select=*`, {
    headers: { apikey: K, Authorization: `Bearer ${K}` },
  });
  if (!r.ok) {
    const t = await r.text();
    if (r.status === 404 || /does not exist|relation/i.test(t)) {
      console.log(`AI 板块：表 ${table} 尚未创建，跳过（请先在 Supabase 执行 seo/ai-schema.sql）`);
      return null;
    }
    throw new Error(`拉取 ${table} 失败: ${r.status} ${t.slice(0, 200)}`);
  }
  return r.json();
}

// —— 页面渲染 ——

export function renderAiHub(collections, byCollection) {
  const title = "AI工具集 - 精选AI工具合集导航 | 乐哲软件";
  const desc =
    "乐哲软件 AI 工具集：按使用场景整理的 AI 工具合集，每个工具集独立成页，涵盖 AI 对话、写作、绘画图像、视频音频、编程开发、办公效率等方向，逐个标注收费模式与适用人群，持续增补更新，找 AI 工具收藏这一页就够了。";
  const canonical = `${SITE}/ai/index.html`;
  const n = collections.reduce((a, c) => a + (byCollection[c.slug] || []).length, 0);

  const cards = collections
    .map((c) => {
      const tools = byCollection[c.slug] || [];
      const preview = tools
        .slice(0, 4)
        .map((t) => `<span class="chip">${esc(t.icon || "🤖")} ${esc(t.name)}</span>`)
        .join("");
      return `<a class="ai-col-card" href="${SITE}/ai/${esc(c.slug)}.html">
  <div class="ai-col-head"><span class="ai-col-icon">${esc(c.icon || "🧩")}</span>
  <span class="ai-col-name">${esc(c.name)}</span>
  <span class="ai-col-count">${tools.length} 个工具</span></div>
  <p class="ai-col-desc">${esc(c.description || "")}</p>
  <div class="ai-col-chips">${preview}${tools.length > 4 ? `<span class="chip more">…等 ${tools.length} 个</span>` : ""}</div>
</a>`;
    })
    .join("\n");

  const body = collections.length
    ? `<div class="ai-grid">${cards}</div>`
    : `<div class="ai-empty"><p>各工具集正在整理中，很快上线。</p><p>计划方向：AI 对话助手、AI 写作、AI 绘画图像、AI 视频音频、AI 编程开发、AI 办公效率等，每个方向一个独立工具集。</p></div>`;

  const html =
    head(title, desc, canonical, `<meta property="og:image" content="${SITE}/og-cover.png">` + AI_CSS) +
    `
<main>
${crumb([{ name: "首页", url: `${SITE}/` }, { name: "AI 工具集" }])}
<h1>AI 工具集</h1>
<p class="ai-lead">按使用场景整理的 AI 工具合集，共 ${collections.length} 个工具集、${n} 款工具，每个工具集独立成页，点开即看该方向的全量工具与说明。</p>
${body}
<section class="ai-note">
<h2>关于本板块</h2>
<p>AI 工具更新快、同名产品多，这里不做大而全的清单，而是按「一个场景一个工具集」整理，每个工具集内只保留实际可用、有明确定位的工具，并标注收费模式（免费 / 免费额度 / 订阅 / 买断）。工具集内容会持续增补调整，本页是全部工具集的入口。</p>
<p>如果你要找的是可下载安装的桌面软件（含 AI 类桌面应用），请到<a href="${SITE}/all.html" style="color:#0077ff">软件库</a>查看。</p>
</section>
</main>
${jsonLd({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "AI 工具集",
    description: desc,
    url: canonical,
  })}
${foot("aihub")}`;
  return { html };
}

export function renderAiCollection(col, tools) {
  const title = `${col.name} - ${tools.length}款AI工具精选 | 乐哲软件`;
  const desc =
    (col.description || `${col.name} 工具集`).slice(0, 90) +
    `，共精选 ${tools.length} 款工具，附一句话说明与收费模式标注，持续更新。`;
  const canonical = `${SITE}/ai/${col.slug}.html`;

  const cards = tools
    .map(
      (t) => `<div class="ai-tool-card">
  <div class="ai-tool-head"><span class="ai-tool-icon">${esc(t.icon || "🤖")}</span>
  <span class="ai-tool-name">${esc(t.name)}</span>
  <span class="ai-badge ${badgeClass(t.pricing)}">${esc(t.pricing || "免费")}</span></div>
  <p class="ai-tool-summary">${esc(t.summary || "")}</p>
  ${t.tags ? `<div class="ai-col-chips">${String(t.tags).split(/[,，、]/).filter(Boolean).map((g) => `<span class="chip">${esc(g.trim())}</span>`).join("")}</div>` : ""}
  <a class="ai-tool-btn" rel="nofollow noopener" target="_blank" href="${esc(t.url)}">前往官网 ↗</a>
</div>`
    )
    .join("\n");

  const html =
    head(title, desc, canonical, `<meta property="og:image" content="${SITE}/og-cover.png">` + AI_CSS) +
    `
<main>
${crumb([
    { name: "首页", url: `${SITE}/` },
    { name: "AI 工具集", url: `${SITE}/ai/index.html` },
    { name: col.name },
  ])}
<h1>${esc(col.name)}</h1>
<p class="ai-lead">${esc(col.description || "")}</p>
<div class="ai-tool-list">
${cards}
</div>
<p class="ai-back"><a href="${SITE}/ai/index.html" style="color:#0077ff">← 返回全部工具集</a>　<a href="${SITE}/all.html" style="color:#0077ff">浏览软件库</a></p>
</main>
${jsonLd({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: col.name,
    description: desc,
    url: canonical,
  })}
${foot("ai-" + col.slug)}`;
  return { html };
}

function badgeClass(p) {
  const s = String(p || "");
  if (s.includes("免费") && !s.includes("额度")) return "free";
  if (s.includes("订阅")) return "sub";
  if (s.includes("买断")) return "once";
  return "freemium";
}
function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// —— 板块构建入口：拉数据 → 写页面 → 返回 sitemap/404 所需信息 ——
export async function buildAiSection(ROOT, softs = []) {
  const { U, K } = supabaseCreds();
  const cols = await fetchTable(U, K, "ai_collections");
  const tools = cols ? await fetchTable(U, K, "ai_tools") : null;

  const collections = (cols || [])
    .filter((c) => c.is_published !== false && c.slug && c.name)
    .sort((a, b) => (a.sort || 0) - (b.sort || 0));
  const allTools = (tools || []).filter((t) => t.is_published !== false && t.name && t.url);

  const byCollection = {};
  for (const c of collections) byCollection[c.slug] = [];
  for (const t of allTools) {
    const c = collections.find((x) => x.id === t.collection_id);
    if (c) byCollection[c.slug].push(t);
  }
  for (const c of collections) byCollection[c.slug].sort((a, b) => (a.sort || 0) - (b.sort || 0));

  // 清空重建 /ai/（含历史遗留的 tool/ 子目录）
  const aiDir = join(ROOT, "ai");
  if (existsSync(aiDir)) await rm(aiDir, { recursive: true });
  await mkdir(join(aiDir, "cover"), { recursive: true }).catch(() => {});
  await writeFile(join(aiDir, "ai.css"), AI_STYLESHEET, "utf8");

  const urls = [];
  const hub = renderAiHub(collections, byCollection);
  await writeFile(join(aiDir, "index.html"), hub.html, "utf8");
  urls.push({ loc: `${SITE}/ai/index.html` });

  for (const c of collections) {
    const list = byCollection[c.slug];
    if (!list.length) continue; // 空工具集不上线独立页，避免薄内容
    const page = renderAiCollection(c, list);
    await writeFile(join(aiDir, `${c.slug}.html`), page.html, "utf8");
    urls.push({ loc: `${SITE}/ai/${c.slug}.html`, lastmod: today() });
  }
  console.log(`AI 工具集：${collections.length} 个工具集 / ${allTools.length} 款工具，生成页面 ${urls.length} 个`);
  return { urls, collections, byCollection, tools: allTools };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const AI_STYLESHEET = `
:root{--ai-border:#e5e9f0;--ai-dim:#5b6472}
.ai-lead{color:var(--text-secondary,#5b6472);max-width:56em}
.ai-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;margin:20px 0}
.ai-col-card{display:block;border:1px solid var(--ai-border);border-radius:12px;padding:16px 18px;text-decoration:none;color:inherit;background:#fff;transition:.15s;box-shadow:0 1px 3px rgba(20,40,80,.05)}
.ai-col-card:hover{border-color:#0088ff;box-shadow:0 4px 14px rgba(0,136,255,.12);transform:translateY(-1px)}
.ai-col-head{display:flex;align-items:center;gap:10px}
.ai-col-icon{font-size:1.5rem}
.ai-col-name{font-weight:700;font-size:1.05rem}
.ai-col-count{margin-left:auto;font-size:.78rem;color:#0088ff;background:rgba(0,136,255,.08);padding:2px 10px;border-radius:20px;white-space:nowrap}
.ai-col-desc{color:var(--ai-dim);font-size:.9rem;margin:10px 0 8px;line-height:1.6}
.ai-col-chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{font-size:.76rem;color:#41506b;background:#eef2f8;border-radius:6px;padding:2px 8px}
.chip.more{color:#0088ff}
.ai-tool-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:14px;margin:18px 0}
.ai-tool-card{border:1px solid var(--ai-border);border-radius:12px;padding:14px 16px;background:#fff;box-shadow:0 1px 3px rgba(20,40,80,.05);display:flex;flex-direction:column;gap:8px}
.ai-tool-head{display:flex;align-items:center;gap:8px}
.ai-tool-icon{font-size:1.3rem}
.ai-tool-name{font-weight:700}
.ai-badge{margin-left:auto;font-size:.72rem;padding:2px 9px;border-radius:20px;white-space:nowrap}
.ai-badge.free{color:#0a8f4d;background:rgba(16,163,74,.1)}
.ai-badge.freemium{color:#b07000;background:rgba(240,180,0,.12)}
.ai-badge.sub{color:#0066cc;background:rgba(0,119,255,.1)}
.ai-badge.once{color:#7a3ff2;background:rgba(122,63,242,.1)}
.ai-tool-summary{font-size:.88rem;color:var(--ai-dim);line-height:1.65;margin:0;flex:1}
.ai-tool-btn{align-self:flex-start;font-size:.85rem;color:#0088ff;text-decoration:none;border:1px solid rgba(0,136,255,.35);border-radius:20px;padding:4px 14px;transition:.15s}
.ai-tool-btn:hover{background:#0088ff;color:#fff}
.ai-note{margin-top:26px;padding-top:16px;border-top:1px solid var(--ai-border);color:var(--ai-dim);font-size:.9rem;line-height:1.7}
.ai-note h2{font-size:1.05rem;color:var(--text-primary,#1c2333)}
.ai-empty{border:1px dashed var(--ai-border);border-radius:12px;padding:28px;color:var(--ai-dim);line-height:1.8}
.ai-back{margin-top:18px;font-size:.9rem}
[data-theme="dark"] .ai-col-card,[data-theme="dark"] .ai-tool-card{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.1)}
[data-theme="dark"] .chip{background:rgba(255,255,255,.08);color:#b8c4d8}
`;
