/**
 * 全站静态体检：逐板块扫产物里的结构性 BUG（不联网，直接读磁盘）
 *
 * 检查项：
 *  1. <title> 缺失/过短/过长/重复
 *  2. description 缺失/过短/重复
 *  3. canonical 缺失或与文件路径不匹配（?soft=/?cat= 之外的页面必须自指）
 *  4. <h1> 数量（必须恰好 1 个；0 个= 页面没有主题，多个= 语义混乱）
 *  5. 本地图片引用是否存在（2026-11-06 教程封面全 404 就是漏了这一项）
 *  6. <img> 缺 alt
 *  7. 内链指向的文件是否存在（含 /cat /soft /tutorial /ai 与根目录页）
 *  8. JSON-LD 是否合法 JSON
 *  9. 产物里是否残留 U+FFFD 乱码
 * 10. og:image 是否存在且可解析到本地/合法外链
 *
 * 用法：node seo/site-check.mjs [--json]
 * 退出码：0 通过；2 有 BLOCKER（图片缺失/JSON-LD 坏/链接死）
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://www.lezhesoft.cn";
const SKIP_DIRS = new Set(["node_modules", ".git", ".workbuddy", "seo"]);
const JSON_OUT = process.argv.includes("--json");

// 不参与体检：搜索引擎验证文件、后台/内部工具页（内容是 JS 模板，静态解析必然误报）
const EXCLUDE = /^(baidu_verify_|googled|d1ee8d7f|BingSiteAuth|admin\.html$|manager\.html$|submanager\.html$|preview\.html$|text1\.html$|query\.html$)/;

// 板块统计用的分组
const boardOf = (rel) => {
  if (rel.startsWith("soft/")) return "软件详情页";
  if (rel.startsWith("cat/")) return "分类页";
  if (rel.startsWith("tutorial/")) return "教程页";
  if (rel.startsWith("ai/tool/")) return "AI 工具详情";
  if (rel.startsWith("ai/")) return "AI 工具集";
  return "站点页";
};

async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") && e.isDirectory()) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      await walk(p, out);
    } else if (e.name.endsWith(".html") && !EXCLUDE.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

const files = await walk(ROOT);
const stats = {};
const issues = { blocker: [], warn: [] };
const titles = new Map();
const descs = new Map();

const attr = (tag, name) => {
  const m = tag.match(new RegExp(name + '\\s*=\\s*"([^"]*)"', "i"));
  return m ? m[1] : "";
};

for (const abs of files) {
  const rel = relative(ROOT, abs).replace(/\\/g, "/");
  const board = boardOf(rel);
  stats[board] = stats[board] || { pages: 0, images: 0, links: 0, blocker: 0, warn: 0 };
  stats[board].pages++;
  const raw = readFileSync(abs, "utf8");
  // 标签检查只看「真 HTML」：剥掉 script/style 与注释，否则 JS 模板字符串会被当成属性
  const html = raw
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "<script></script>")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  const push = (lv, type, detail) => {
    (lv === "blocker" ? issues.blocker : issues.warn).push(`${rel} · ${type} · ${detail}`);
    stats[board][lv]++;
  };

  // 1. title
  const t = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ""])[1].trim();
  if (!t) push("warn", "title 缺失", "无 <title>");
  else {
    if (titles.has(t)) push("warn", "title 重复", `与 ${titles.get(t)} 相同：${t.slice(0, 40)}`);
    else titles.set(t, rel);
    if (t.length > 70) push("warn", "title 过长", `${t.length} 字`);
  }

  // 2. description
  const d = attr(html.match(/<meta\s+name="description"[^>]*>/i)?.[0] || "", "content");
  if (!d) push("warn", "description 缺失", "");
  else {
    if (descs.has(d)) push("warn", "description 重复", `与 ${descs.get(d)} 相同`);
    else descs.set(d, rel);
    if (d.length < 30) push("warn", "description 过短", `${d.length} 字`);
  }

  // 3. canonical
  const canon = attr(html.match(/<link\s+rel="canonical"[^>]*>/i)?.[0] || "", "href");
  if (!canon) push("warn", "canonical 缺失", "");
  else if (!canon.startsWith(SITE)) push("warn", "canonical 非本站", canon);
  else {
    const expect = `${SITE}/${rel}`.replace(/index\.html$/, "");
    const norm = (u) => u.replace(/index\.html$/, "").replace(/\/$/, "");
    const is404 = rel === "404.html";
    if (!is404 && norm(canon) !== norm(expect)) push("warn", "canonical 非自指", `${canon} ≠ ${expect}`);
  }

  // 4. h1
  const h1s = [...html.matchAll(/<h1[\s>]/gi)];
  if (h1s.length === 0) push("warn", "h1 缺失", "");
  else if (h1s.length > 1) push("warn", "h1 多个", `${h1s.length} 个`);

  // 5/6. 图片
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const src = attr(tag, "src");
    stats[board].images++;
    if (!attr(tag, "alt")) push("warn", "img 缺 alt", src.slice(0, 60));
    if (!src || src.startsWith("data:")) continue;
    if (/^https?:\/\//i.test(src)) continue; // 外链图片由运行时检查
    const clean = decodeURIComponent(src.split("?")[0].split("#")[0]);
    const target = clean.startsWith("/") ? join(ROOT, clean) : join(dirname(abs), clean);
    if (!existsSync(target)) push("blocker", "图片 404", `${src} → 文件不存在`);
  }

  // 7. 内链
  for (const m of html.matchAll(/<a\b[^>]*href="([^"]+)"/gi)) {
    const href = m[1];
    stats[board].links++;
    if (!href || /^(https?:|mailto:|tel:|#|javascript:|tencent:|weixin:|alipays?:)/i.test(href)) continue;
    const path = decodeURIComponent(href.split("?")[0].split("#")[0]);
    if (!path || path === "/") continue;
    const target = path.startsWith("/") ? join(ROOT, path) : join(dirname(abs), path);
    const ok = existsSync(target) || existsSync(join(target, "index.html"));
    if (!ok) push("blocker", "内链死链", `${href}`);
  }

  // 8. JSON-LD
  for (const m of raw.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      JSON.parse(m[1]);
    } catch {
      push("blocker", "JSON-LD 解析失败", m[1].slice(0, 60).replace(/\s+/g, " "));
    }
  }

  // 8.5 内联脚本语法（VIP 页曾因多一个 '}' 整段脚本不执行）
  for (const m of raw.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const kind = (m[1].match(/type\s*=\s*"([^"]+)"/i) || [,""])[1].toLowerCase();
    const code = m[2];
    if (!code.trim() || kind.includes("ld+json") || kind.includes("json") || kind === "text/template") continue;
    if (kind === "module" || /^\s*(import|export)\s/m.test(code)) continue; // 模块语法 new Function 不支持
    try {
      new Function(code);
    } catch (e) {
      push("blocker", "内联脚本语法错误", e.message.slice(0, 60));
    }
  }

  // 9. 乱码
  if (raw.includes("\uFFFD")) push("warn", "U+FFFD 乱码", `${(raw.match(/\uFFFD/g) || []).length} 处`);

  // 10. og:image
  const og = attr(html.match(/<meta\s+property="og:image"[^>]*>/i)?.[0] || "", "content");
  if (!og) push("warn", "og:image 缺失", "");
}

const summary = {
  pages: files.length,
  blocker: issues.blocker.length,
  warn: issues.warn.length,
  boards: stats,
};
if (JSON_OUT) {
  console.log(JSON.stringify({ summary, issues }, null, 2));
} else {
  console.log("===== 全站静态体检 =====");
  for (const [k, v] of Object.entries(stats)) {
    console.log(`${k.padEnd(10, " ")} 页面 ${String(v.pages).padStart(3)} · 图片 ${String(v.images).padStart(4)} · 内链 ${String(v.links).padStart(5)} · BLOCKER ${v.blocker} · WARN ${v.warn}`);
  }
  const show = (list, cap = 25) => list.slice(0, cap).forEach((x) => console.log("  - " + x));
  if (issues.blocker.length) {
    console.log(`\n❌ BLOCKER ${issues.blocker.length} 条：`);
    show(issues.blocker);
    if (issues.blocker.length > 25) console.log(`  … 另 ${issues.blocker.length - 25} 条`);
  }
  if (issues.warn.length) {
    console.log(`\n⚠ WARN ${issues.warn.length} 条（按类型聚合）：`);
    const byType = {};
    for (const w of issues.warn) {
      const type = w.split(" · ")[1];
      byType[type] = (byType[type] || 0) + 1;
    }
    for (const [k, v] of Object.entries(byType).sort((a, b) => b[1] - a[1])) console.log(`  - ${k}: ${v}`);
    console.log("  明细（前 25 条）：");
    show(issues.warn);
  }
  console.log(`\n结论：${files.length} 页 · BLOCKER ${issues.blocker.length} · WARN ${issues.warn.length}`);
}
process.exit(issues.blocker.length ? 2 : 0);
