/**
 * 教程选题候选清单
 * 用法：node seo/tutorial-pick.mjs [N]
 * 输出：还没有教程覆盖的软件（按 浏览量 > 分类软件数 排序）前 N 个（默认 10），
 *       JSON 格式，供每日自动化挑选后创作教程并写入 Supabase tutorials 表。
 * 「已有教程」按软件名出现在教程标题中来判断（tutorials 表没有 software_id 关联字段）。
 */
import { readFile } from "node:fs/promises";
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

const [softs, tutorials] = await Promise.all([
  sb("software?select=id,name,category,description,views,downloads,platforms,version&limit=1000"),
  sb("tutorials?select=id,title&limit=500"),
]);

const titles = tutorials.map((t) => t.title || "");
const uncovered = softs.filter((s) => s.name && !titles.some((t) => t.includes(s.name)));

const catSize = new Map();
for (const s of softs) catSize.set(s.category, (catSize.get(s.category) || 0) + 1);

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
    totalSofts: softs.length,
    totalTutorials: tutorials.length,
    uncovered: uncovered.length,
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
