/**
 * 教程选题候选清单（含小红书同步选题）
 * 用法：node seo/tutorial-pick.mjs [N]
 * 输出 JSON：
 *   - xhs_sync：今日「小红书 × 站内教程」同步选题（读 seo/XHS-PLAN.md），优先按它写教程
 *   - candidates：还没有教程覆盖的软件（按 浏览 > 下载 > 分类软件数 排序）前 N 个（默认 10）
 * 「已有教程」按软件名出现在教程标题中来判断（tutorials 表没有 software_id 关联字段）。
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const N = Number(process.argv[2]) || 10;

const indexHtml = await readFile(join(ROOT, "index.html"), "utf8");
const SUPA_URL = indexHtml.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/)[1];
const SUPA_KEY = indexHtml.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/)[1];
const sb = async (q) => {
  const r = await fetch(`${SUPA_URL}/rest/v1/${q}`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.json();
};

/** 解析 seo/XHS-PLAN.md 排期表 */
function parsePlan(md) {
  const rows = [];
  for (const line of md.split(/\r?\n/)) {
    const m = line.match(/^\|\s*(\d+)\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|/);
    if (!m) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 8) continue;
    rows.push({
      idx: Number(cells[0]),
      date: cells[1],
      weekday: cells[2],
      noteTitle: cells[3],
      type: cells[4],
      softName: cells[5],
      presetTitle: cells[6],
      status: cells[7],
    });
  }
  return rows;
}

const [softs, tutorials] = await Promise.all([
  sb("software?select=id,name,category,description,views,downloads,platforms,version&limit=1000"),
  sb("tutorials?select=id,title&limit=500"),
]);

const titles = tutorials.map((t) => t.title || "");
const uncovered = softs.filter((s) => s.name && !titles.some((t) => t.includes(s.name)));

const catSize = new Map();
for (const s of softs) catSize.set(s.category, (catSize.get(s.category) || 0) + 1);

// ---------- 小红书同步选题 ----------
const today =
  process.env.XHS_TODAY || new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10); // 北京时间，可用 XHS_TODAY 覆盖（测试/补跑）
let xhsSync = null;
const planPath = join(ROOT, "seo", "XHS-PLAN.md");
if (existsSync(planPath)) {
  const rows = parsePlan(await readFile(planPath, "utf8"));
  const pending = rows.filter((r) => !r.status.startsWith("已写") && !r.status.startsWith("跳过"));
  // 只取「日期 ≤ 今天」的待写行：今天有就用今天，今天没跑（断档）就补最近一条漏掉的；
  // 未来的行不提前写，否则次日会重复。全部执行完返回 null，由自动化按模板续排。
  const pick =
    pending.find((r) => r.date === today) ||
    pending.filter((r) => r.date < today).slice(-1)[0] ||
    null;
  const nextUpcoming = pending.find((r) => r.date > today) || null;
  if (pick) {
    const norm = (s) => (s || "").toLowerCase().replace(/\s+/g, "");
    const want = norm(pick.softName);
    const hit =
      softs.find((s) => norm(s.name) === want) ||
      softs.find((s) => want.includes(norm(s.name)) || norm(s.name).includes(want)) ||
      softs.find((s) => {
        const head = want.split(/[ -]/)[0];
        return head.length >= 3 && norm(s.name).includes(head);
      }) ||
      null;
    xhsSync = {
      planned_date: pick.date,
      is_today: pick.date === today,
      weekday: pick.weekday,
      note_title: pick.noteTitle,
      note_type: pick.type,
      scheduled_software: pick.softName,
      preset_tutorial_title: pick.presetTitle,
      status: pick.status,
      matched_software: hit
        ? {
            id: hit.id,
            name: hit.name,
            category: hit.category,
            version: hit.version,
            platforms: hit.platforms,
            description: (hit.description || "").slice(0, 160),
            has_tutorial: titles.some((t) => t.includes(hit.name)),
          }
        : null,
      action: hit
        ? "按排期写这款软件（同题同方向），标题用 preset_tutorial_title"
        : "排期软件不在库：按 note_type 方向从软件池换一款同方向、未覆盖的软件，并在 XHS-PLAN.md 该行备注替换原因",
    };
  } else {
    xhsSync = {
      planned_date: null,
      is_today: false,
      action:
        nextUpcoming
          ? `今日无排期行（下一行为 ${nextUpcoming.date} ${nextUpcoming.noteTitle}），按常规候选选题；明日再按排期同步`
          : "排期表已用尽：按 XHS-PLAN.md「7 天方向轮换模板」续排 7 行后再执行；今日先按常规候选选题",
      next_upcoming: nextUpcoming
        ? { date: nextUpcoming.date, note_title: nextUpcoming.noteTitle, scheduled_software: nextUpcoming.softName }
        : null,
    };
  }
}

// ---------- 常规候选 ----------
const rank = uncovered
  .map((s) => ({
    ...s,
    score:
      (Number(s.views) || 0) * 2 +
      (Number(s.downloads) || 0) * 3 +
      (catSize.get(s.category) || 0),
  }))
  .sort((a, b) => b.score - a.score)
  .slice(0, N);

console.log(JSON.stringify(
  {
    generated_at: new Date().toISOString(),
    today_cn: today,
    totalSofts: softs.length,
    totalTutorials: tutorials.length,
    uncovered: uncovered.length,
    xhs_sync: xhsSync,
    candidates: rank.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      version: s.version,
      platforms: s.platforms,
      description: (s.description || "").slice(0, 120),
      views: Number(s.views) || 0,
      downloads: Number(s.downloads) || 0,
    })),
  },
  null,
  2
));
