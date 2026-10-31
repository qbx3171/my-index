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
import { ensureCovers } from "./cover.mjs";

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

async function sb(query, copies = 8) {
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
  for (let round = 0; round < 8; round++) {
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
  // Photoshop 入门教程（acd18f73…）传输损坏兜底，按已知原文定点还原
  { id: "acd18f73-4840-4e8c-b6c2-d38d7625f0e8", field: "content", from: /图像\uFFFD小/, to: "图像大小" },
  { id: "acd18f73-4840-4e8c-b6c2-d38d7625f0e8", field: "content", from: /「改哪里」\uFFFD矩形/, to: "「改哪里」。矩形" },
  { id: "acd18f73-4840-4e8c-b6c2-d38d7625f0e8", field: "content", from: /1–2\s*\uFFFD*像素/, to: "1–2 像素" },
  { id: "ba65264357f25999f28052c1", field: "description", from: /镜头品牌与\uFFFD+号/, to: "镜头品牌与型号" },
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
// 母本兜底：长正文（>2KB）经代理传输损坏位置随机，定点修复覆盖不全。
// 对配置了母本的记录，若合并后正文仍残留乱码，直接用本地母本整体覆盖。
const CONTENT_MASTERS = [
  { id: "acd18f73-4840-4e8c-b6c2-d38d7625f0e8", field: "content", file: "content-master-acd18f73.txt" },
  { id: "ab616030-0d0e-4462-be04-847abc6e9de5", field: "content", file: "content-master-ab616030.txt" },
  { id: "acd18f73-4840-4e8c-b6c2-d38d7625f0e8", field: "summary", file: "summary-master-acd18f73.txt" },
];
for (const m of CONTENT_MASTERS) {
  const row = tutorials.find((t) => t.id === m.id);
  if (row && typeof row[m.field] === "string" && row[m.field].includes(FFD)) {
    row[m.field] = await readFile(join(ROOT, "seo", m.file), "utf8");
    console.log(`已用母本覆盖 ${m.id}.${m.field}（传输乱码兜底）`);
  }
}
// 描述定点重写：个别记录源描述含采集噪声且过短（触发薄内容/描述告警），用真实信息整体重写
const DESC_OVERRIDES = {
  // Keka 解压缩软件：源描述为「一款Mac上好用又免费的文件解压缩软件软件详情：提取码：x13i」，
  // 含提取码噪声且正文仅 265 字，按软件公开功能重写
  mrt05wkthp9y:
    "Keka 是 macOS 平台免费好用的解压缩工具，支持 7z、Zip、Tar、Gzip 等常见压缩格式的创建与解压，也可解压 RAR 分卷压缩包，支持设置密码保护与分卷压缩，把文件拖到程序图标即可开始处理，适合日常压缩传输与接收解压场景。",
};
for (const [id, desc] of Object.entries(DESC_OVERRIDES)) {
  const row = softs.find((s) => s.id === id);
  if (row) {
    row.description = desc;
    console.log(`已重写 ${id} 的 description（源描述噪声/过短）`);
  }
}

console.log(`数据：software=${softs.length}，tutorials=${tutorials.length}`);

// 清理旧产物，避免删除的软件留下死页
for (const dir of ["soft", "cat", "tutorial"]) {
  await rm(join(ROOT, dir), { recursive: true, force: true });
  await mkdir(join(ROOT, dir), { recursive: true });
}

// 教程封面：必须在目录清理之后生成（清理会连 tutorial/cover/ 一起删掉）
const coverBefore = new Map(tutorials.map((t) => [t.id, t.cover || ""]));
const newCovers = await ensureCovers(tutorials);
if (newCovers.length) console.log(`新增教程封面：${newCovers.length} 张`);

// 封面回写数据库：站内前端（index.html）教程列表/详情直读 DB，
// 只改静态页会导致「新教程在站内没有封面」，这里把封面地址同步进 tutorials.cover。
for (const t of tutorials) {
  if (!t.id || !t.cover) continue;
  if (coverBefore.get(t.id) === t.cover) continue;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/tutorials?id=eq.${encodeURIComponent(t.id)}`, {
      method: "PATCH",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ cover: t.cover }),
    });
    if (res.ok) console.log(`封面已回写数据库：${t.id}`);
    else console.warn(`封面回写失败 ${t.id}: HTTP ${res.status}`);
  } catch (e) {
    console.warn(`封面回写异常 ${t.id}: ${e.message}`);
  }
}

let count = 0;
// 标题/描述去重：同名的记录（通常是 Windows/Mac 两个平台各一条，或有克隆记录），
// 标题与描述里追加平台后缀，避免「许多页面具有相同标题/描述」
const nameCounts = new Map();
for (const s of softs) nameCounts.set(s.name ?? "", (nameCounts.get(s.name ?? "") || 0) + 1);
// 同分类相关推荐：按热度排序后「环形轮转」取后续 8 条。
// 改动原因：此前固定取分类前 8 条，大分类里排在后面的 59 个软件页只拿到 2 条内链
// （分类页 + 首页），形成内链孤岛。环形轮转后同分类内每页都指向不同组合，
// 入链分布趋于均匀，且每页推荐数量不变（仍是 8 条，不会变成全站链接堆砌）。
const catList = new Map();
for (const s of softs) {
  if (!s.category) continue;
  if (!catList.has(s.category)) catList.set(s.category, []);
  catList.get(s.category).push(s);
}
// 注意：排序键必须「稳定」，不能用 views/downloads —— 热度每天在变，会让 158 个页面
// 的推荐块天天换组合，白白制造 diff、浪费抓取预算。这里按 id 排序（与数据序无关、
// 只随增删变化），轮转依旧能保证同分类内入链均匀。
const heat = (x) => String(x.id ?? "");
for (const list of catList.values()) list.sort((a, b) => (heat(a) < heat(b) ? -1 : heat(a) > heat(b) ? 1 : 0));
const REL_N = 8;
const pickRelated = (s) => {
  const list = catList.get(s.category) || [];
  if (list.length <= REL_N + 1) return list.filter((x) => x.id !== s.id);
  const idx = list.findIndex((x) => x.id === s.id);
  if (idx < 0) return list.slice(0, REL_N);
  const out = [];
  for (let i = 1; i <= REL_N; i += 1) out.push(list[(idx + i) % list.length]);
  return out;
};
const rendered = softs.map((s) => {
  const related = pickRelated(s);
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

// —— 首页侧栏分类导航静态化 ——
// 目的是让爬虫在 index.html 原始 HTML 里就能拿到 15 条 /cat/ 真实链接（原先只有无 href 的 <div>）。
// 用与前端完全相同的 class 结构输出，JS 初始化时 renderCategories() 会整体覆盖 #categoryList，
// 所以用户看到的界面、点击行为都不变，不存在隐藏文本或两套内容的问题。
const NAV_GROUPS = [
  { id: "creative", name: "创意设计", icon: "🎨", cats: ["设计工具", "媒体工具"] },
  { id: "dev", name: "开发编程", icon: "💻", cats: ["开发工具"] },
  { id: "office", name: "办公效率", icon: "📋", cats: ["办公软件", "实用工具"] },
];
const NAV_ICONS = { 媒体工具: "🎬", 开发工具: "⚙", 办公软件: "📋", 实用工具: "🔧" };
const navEsc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function buildSidebarNav(all) {
  const counts = new Map();
  for (const s of all) {
    const c = s.category || "未分类";
    counts.set(c, (counts.get(c) || 0) + 1);
  }
  const groupOf = new Map();
  NAV_GROUPS.forEach((g) => g.cats.forEach((c) => groupOf.set(c, g.id)));
  const buckets = new Map(NAV_GROUPS.map((g) => [g.id, []]));
  const rest = [];
  for (const c of counts.keys()) {
    const gid = groupOf.get(c);
    if (gid) buckets.get(gid).push(c);
    else rest.push(c);
  }
  const item = (c) =>
    `<a class="category-item-side " data-cat="${navEsc(c)}" href="/cat/${catSlug(c)}.html">` +
    `<span class="icon">${NAV_ICONS[c] || "📦"}</span><span class="name">${navEsc(c)}</span>` +
    `<span class="count">${counts.get(c)}</span></a>`;
  let html = `<div class="category-item-all active" data-cat="all"><span class="icon">◇</span><span class="name">全部</span><span class="count">${all.length}</span></div>`;
  const renderGroup = (id, name, icon, items) => {
    if (!items.length) return "";
    return (
      `<div class="category-group"><div class="group-header" data-group="${id}">` +
      `<span class="group-icon">${icon}</span><span class="group-name">${name}</span>` +
      `<span class="group-badge">${items.length}</span><span class="toggle-icon ">▶</span></div>` +
      `<div class="group-items ">${items.map(item).join("")}</div></div>`
    );
  };
  for (const g of NAV_GROUPS) html += renderGroup(g.id, g.name, g.icon, buckets.get(g.id));
  html += renderGroup("other", "其他分类", "📁", rest);
  return html;
}

try {
  let idx = await readFile(join(ROOT, "index.html"), "utf8");
  const open = '<div class="category-list" id="categoryList">';
  const close = '<div class="sidebar-bottom">';
  const a = idx.indexOf(open);
  const b = idx.indexOf(close, a);
  if (a < 0 || b < 0) throw new Error("未找到 #categoryList 区块");
  const nav = buildSidebarNav(softs);
  idx = idx.slice(0, a + open.length) + nav + "</div>\n" + idx.slice(b);
  idx = idx.replace(/(<span id="sidebarTotalCount">)共 \d+ 款软件/, `$1共 ${softs.length} 款软件`);
  // <a> 需要去掉默认下划线与链接色，其余样式沿用 .category-item-side
  if (!idx.includes("a.category-item-side{text-decoration:none")) {
    idx = idx.replace(
      ".category-item-side{",
      "a.category-item-side{text-decoration:none;color:var(--text-secondary)}\n.category-item-side{"
    );
  }
  await writeFile(join(ROOT, "index.html"), idx, "utf8");
  console.log(`首页侧栏静态导航：${nav.split('href="/cat/').length - 1} 条分类链接（共 ${softs.length} 款）`);
} catch (e) {
  console.warn(`⚠ 首页侧栏静态导航未更新：${e.message}`);
}

await writeFile(join(ROOT, "sitemap.xml"), renderSitemapXml(softs, tutorials), "utf8");
const sm = renderSitemapHtml(softs, tutorials);
await writeFile(join(ROOT, "sitemap.html"), sm.html, "utf8");
console.log(`sitemap.xml + sitemap.html 完成（共 ${softs.length + tutorials.length + cats.length + 1} 个 URL）`);

// 末尾自检：扫描全部产物，含 U+FFFD 即以 exit 2 退出（传输乱码随机出现，
// 重跑一次大概率拿到干净副本；每日流程应在 exit 2 时自动重跑，最多 3 次）
const { readdirSync, statSync } = await import("node:fs");
const badFiles = [];
const scanDir = async (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) scanDir(p);
    else if (f.endsWith(".html") && (await readFile(p, "utf8")).includes(FFD)) badFiles.push(p);
  }
};
for (const dir of ["soft", "cat", "tutorial"]) await scanDir(join(ROOT, dir));
for (const f of readdirSync(ROOT)) {
  if (f.endsWith(".html") && (await readFile(join(ROOT, f), "utf8")).includes(FFD)) badFiles.push(f);
}
if (badFiles.length) {
  console.error(`⚠ 产物仍含 ${badFiles.length} 个乱码文件：${badFiles.join(", ")}——请重跑本脚本（exit 2）`);
  process.exit(2);
}
console.log("产物自检通过：无乱码");
