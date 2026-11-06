/**
 * 安全自检（发布前门禁）
 * 用法：node seo/security-check.mjs [--scan]
 *   --scan  额外扫描已生成的 HTML 产物（soft/ cat/ tutorial/ ai/ 根目录）
 * 退出码：0 全部通过；2 发现 BLOCKER
 *
 * 检查项：
 *  1) 渲染层 XSS 自测：构造恶意正文/标题，断言产物不含可执行代码（sanitizeHtml + jsonLd 加固）
 *  2) 产物扫描：生成产物里不得出现 onerror=/javascript:/<iframe/<svg onload 等注入构造
 *  3) 只读探测：anon key 对各表的写权限（informational，不修改任何真实值）
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { renderTutorialPage, sanitizeHtml, jsonLd } from "./render.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DO_SCAN = process.argv.includes("--scan");
const blockers = [];
const warns = [];

/* ---------- 1) 渲染层 XSS 自测 ---------- */
const EVIL_BODY = `<p>正常段落</p>
<script>alert(1)</script>
<SCRIPT SRC=//evil.example/x.js></SCRIPT>
<img src=x onerror="alert(2)">
<img src=x OnError=alert(3)>
<a href="javascript:alert(4)">点我</a>
<svg onload=alert(6)></svg>
<iframe src="https://evil.example"></iframe>
<object data="x.swf"></object>
<form action="https://evil.example"><input name=a></form>
<div style="background:url(javascript:alert(7))">sty</div>
<div style="width:expression(alert(8))">exp</div>
<!--<script>alert(9)</script>-->`;

const EVIL_TITLE = `GIMP使用教程</script><script>alert('title')</script>`;

const cleanTut = {
  id: "11111111-1111-1111-1111-111111111111",
  title: "GIMP使用教程：基础修图入门",
  summary: "干净的摘要内容，用于建立产物基线。",
  category: "图像处理",
  content: "<p>正常正文</p><h2>小节</h2><p>更多内容</p>",
  created_at: "2026-11-06T00:00:00Z",
  cover: "https://www.lezhesoft.cn/tutorial/cover/x.png",
};

const render = (t) => renderTutorialPage(t, [], {}).html;

const baseHtml = render(cleanTut);
const page = render({
  ...cleanTut,
  id: "00000000-0000-0000-0000-000000000000",
  title: EVIL_TITLE,
  summary: `摘要</script><script>alert('summary')</script>`,
  category: `图像处理`,
  content: EVIL_BODY,
  cover: `https://www.lezhesoft.cn/tutorial/cover/x.png`,
});

/* 1a) 正文消毒单元测试：只看 sanitizeHtml 的输出 */
const cleaned = sanitizeHtml(EVIL_BODY);
const unitPatterns = [
  [/<script\b/i, "<script> 标签"],
  [/\son[a-z]+\s*=/i, "on* 事件属性"],
  [/javascript\s*:/i, "javascript: 协议"],
  [/expression\s*\(/i, "CSS expression()"],
  [/<(iframe|object|embed|svg|form|input)\b/i, "危险标签"],
  [/alert\s*\(/i, "残留可执行文本"],
];
for (const [re, label] of unitPatterns) {
  if (re.test(cleaned)) blockers.push(`sanitizeHtml 输出仍含${label}`);
}

/* 1b) 整页对比：脚本数量不得比干净页多（模板自带 3 个：https 跳转、导航高亮、JSON-LD） */
const countScripts = (h) => (h.match(/<script\b/gi) || []).length;
const baseScripts = countScripts(baseHtml);
const evilScripts = countScripts(page);
if (evilScripts > baseScripts) {
  blockers.push(`恶意内容使 <script> 数量从 ${baseScripts} 增至 ${evilScripts}（标签闭合注入）`);
}
// 逐个脚本校验：JSON-LD 必须能被解析且不含裸 </script；其余脚本体内不得出现可执行注入特征
for (const [, attrs, body] of page.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
  if (/application\/ld\+json/i.test(attrs)) {
    try {
      JSON.parse(body);
    } catch {
      blockers.push("JSON-LD 被注入破坏，已无法解析");
    }
    if (/<\/script/i.test(body)) blockers.push("JSON-LD 内含未转义的 </script（可闭合标签）");
    continue;
  }
  if (/alert\s*\(|eval\s*\(|document\.cookie|new\s+Function/.test(body)) {
    blockers.push("页面脚本体内出现注入特征（标题/摘要闭合注入成功）");
  }
}

/* 1c) 正文区专项检查（避开模板自带的搜索表单等） */
const article = (page.match(/<article>([\s\S]*?)<\/article>/i) || [, ""])[1];
const artPatterns = [
  [/<script\b/i, "<script>"],
  [/\son[a-z]+\s*=/i, "on* 事件属性"],
  [/javascript\s*:/i, "javascript: 协议"],
  [/<(iframe|object|embed|svg|form)\b/i, "危险标签"],
  [/srcdoc\s*=/i, "srcdoc"],
];
for (const [re, label] of artPatterns) {
  if (re.test(article)) blockers.push(`正文区残留${label}`);
}
if (!article.includes("正常段落")) warns.push("消毒把正常正文也吃掉了（白名单过严，需复核保留标签）");

/* ---------- 2) 产物扫描 ---------- */
const renderBlockerCount = blockers.length;
const SCAN_DIRS = ["soft", "cat", "tutorial", "ai"];
const pending = [ROOT, ...SCAN_DIRS.map((d) => join(ROOT, d))];
let scanned = 0;
const hits = [];
while (pending.length) {
  const dir = pending.pop();
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    continue;
  }
  for (const name of entries) {
    const p = join(dir, name);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (name === "node_modules" || name.startsWith(".") || name === "assets" || name === "seo") continue;
      pending.push(p);
    } else if (name.endsWith(".html") && DO_SCAN) {
      const html = readFileSync(p, "utf8");
      scanned += 1;
      for (const [re, label] of [
        [/<script[^>]*>\s*alert\s*\(/i, "内联 alert"],
        [/\sonerror\s*=\s*["']?alert/i, "onerror=alert"],
        [/href\s*=\s*["']javascript:/i, "javascript: 链接"],
        [/<iframe\s+src\s*=\s*["']https?:/i, "外链 iframe"],
      ]) {
        if (re.test(html)) hits.push(`${p.replace(ROOT + "/", "")} → ${label}`);
      }
    }
  }
}
if (hits.length) blockers.push(`产物中出现注入特征 ${hits.length} 处：${hits.slice(0, 5).join(" | ")}`);

/* ---------- 3) anon 写权限探测（不改真实值） ---------- */
let permLines = [];
try {
  const idx = readFileSync(join(ROOT, "index.html"), "utf8");
  const U = idx.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/)[1];
  const K = idx.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/)[1];
  const H = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json" };
  for (const [table, col] of [
    ["tutorials", "likes"],
    ["software", "views"],
    ["ai_tools", null],
    ["ai_collections", null],
  ]) {
    const q = await (await fetch(`${U}/rest/v1/${table}?select=id${col ? "," + col : ""}&limit=1`, { headers: H })).json();
    if (!Array.isArray(q) || !q[0]) {
      permLines.push(`${table}: 读不到数据`);
      continue;
    }
    if (!col) {
      permLines.push(`${table}: 跳过写探测（无同值字段）`);
      continue;
    }
    const r = await fetch(`${U}/rest/v1/${table}?id=eq.${q[0].id}&select=id`, {
      method: "PATCH",
      headers: { ...H, Prefer: "return=representation" },
      body: JSON.stringify({ [col]: q[0][col] }),
    });
    const rows = await r.json().catch(() => []);
    const writable = Array.isArray(rows) && rows.length > 0;
    permLines.push(`${table}: anon ${writable ? "可写 ⚠" : "只读 ✓"}`);
    if (writable && table === "tutorials") {
      warns.push(
        "tutorials 表对公开 anon key 开放写权限（存储型 XSS 风险）：渲染层已消毒兜底，根治需在 Supabase 收紧 RLS（详见 PLAYBOOK「安全」段）"
      );
    } else if (writable) {
      blockers.push(`${table} 表 anon 可写（非预期）`);
    }
  }
} catch (e) {
  warns.push(`写权限探测失败（网络/权限）：${e.message}`);
}

/* ---------- 输出 ---------- */
console.log("===== 安全自检 =====");
console.log(`渲染层自测：${renderBlockerCount ? "FAIL" : "PASS"}（干净页 <script> ${baseScripts} 个 / 恶意页 ${evilScripts} 个）`);
if (DO_SCAN) console.log(`产物扫描：${scanned} 个 HTML`);
console.log("写权限：" + permLines.join(" | "));
if (warns.length) {
  console.log("\nWARN：");
  warns.forEach((w) => console.log(" - " + w));
}
if (blockers.length) {
  console.log("\nBLOCKER：");
  blockers.forEach((b) => console.log(" ✗ " + b));
  console.log(`\n结论：${blockers.length} 个 BLOCKER，禁止发布`);
  process.exit(2);
}
console.log("\n结论：通过（BLOCKER 0）");
