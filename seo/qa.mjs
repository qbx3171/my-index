import { readdir, readFile, stat } from "node:fs/promises";
import { join, dirname, resolve, relative } from "node:path";

const ROOT = resolve(".");
const FFD = "\uFFFD";

async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".git" || e.name === ".workbuddy") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}

const files = await walk(ROOT);
const rows = [];
for (const f of files) {
  const html = await readFile(f, "utf8");
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim() ?? "";
  const desc = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1]?.trim() ?? "";
  const noindex = /<meta\s+name=["']robots["'][^>]*noindex/i.test(html);
  rows.push({
    file: relative(ROOT, f).replace(/\\/g, "/"),
    title, desc,
    titleLen: [...title].length,
    descLen: [...desc].length,
    ffd: html.includes(FFD),
    noindex,
    html,
  });
}

// 重复标题 / 重复描述（仅统计 indexable 页）
const idx = rows.filter((r) => !r.noindex);
const groupBy = (arr, key) => {
  const m = new Map();
  for (const r of arr) { if (!r[key]) continue; if (!m.has(r[key])) m.set(r[key], []); m.get(r[key]).push(r.file); }
  return [...m.entries()].filter(([, v]) => v.length > 1);
};
const dupTitles = groupBy(idx, "title");
const dupDescs = groupBy(idx, "desc");
const shortDesc = idx.filter((r) => r.descLen > 0 && r.descLen < 100);
const missingDesc = idx.filter((r) => !r.desc);
const missingTitle = idx.filter((r) => !r.title);
const ffdFiles = rows.filter((r) => r.ffd).map((r) => r.file);

// 死链抽查
const existsCache = new Map();
async function exists(p) { if (!existsCache.has(p)) { try { await stat(p); existsCache.set(p, true); } catch { existsCache.set(p, false); } } return existsCache.get(p); }

const checkTargets = rows.map((r) => r.file);
const dead = [];
let checkedLinks = 0;
for (const t of checkTargets) {
  const r = rows.find((x) => x.file === t);
  if (!r) { dead.push({ from: t, to: "(file missing)", reason: "源文件不存在" }); continue; }
  const hrefs = [...r.html.matchAll(/href=["']([^"']+)["']/g)].map((m) => m[1]);
  for (let h of hrefs) {
    if (!h || h.startsWith("#") || /^(mailto|tel|javascript|data|tencent|weixin|alipays?):/i.test(h)) continue;
    // 同域绝对地址视为站内链接
    const SELF = /^https?:\/\/(www\.)?lezhesoft\.cn(\/.*)?$/i;
    if (/^(https?:)?\/\//i.test(h)) {
      if (!SELF.test(h)) continue;
      h = h.replace(/^https?:\/\/(www\.)?lezhesoft\.cn/i, "") || "/";
    }
    if (h.includes("'") || h.includes("+") || h.includes("${")) continue; // JS 模板拼接，跳过
    h = h.split("#")[0].split("?")[0];
    if (!h) continue;
    checkedLinks++;
    const target = h.startsWith("/") ? join(ROOT, h) : join(dirname(join(ROOT, t)), h);
    let p = target;
    if (!(await exists(p)) && !p.endsWith(".html")) p = target + ".html";
    if (!(await exists(p))) dead.push({ from: t, to: h, reason: "目标不存在" });
  }
}

const out = {
  totalHtml: rows.length,
  indexable: idx.length,
  softPages: rows.filter((r) => r.file.startsWith("soft/")).length,
  catPages: rows.filter((r) => r.file.startsWith("cat/")).length,
  tutorialPages: rows.filter((r) => r.file.startsWith("tutorial/")).length,
  dupTitleGroups: dupTitles.length,
  dupTitleDetail: dupTitles.slice(0, 10),
  dupDescGroups: dupDescs.length,
  dupDescDetail: dupDescs.slice(0, 10),
  shortDescCount: shortDesc.length,
  shortDescDetail: shortDesc.map((r) => `${r.file} (${r.descLen})`).slice(0, 20),
  missingDesc: missingDesc.map((r) => r.file),
  missingTitle: missingTitle.map((r) => r.file),
  fffdCount: ffdFiles.length,
  fffdFiles: ffdFiles,
  linksChecked: checkedLinks,
  deadLinkCount: dead.length,
  deadLinks: dead.slice(0, 30),
};
console.log(JSON.stringify(out, null, 2));
