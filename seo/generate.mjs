/**
 * 乐哲软件静态 SEO 页生成器（GitHub Pages 版）
 * 数据源：Supabase（经腾讯 CloudBase 代理）；key 从 index.html 动态读取，与前端保持同源
 * 产物：/soft/*.html  /cat/*.html  /tutorial/*.html  sitemap.xml  sitemap.html
 * 运行：node seo/generate.mjs
 */
import { mkdir, writeFile, rm, readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  renderSoftPage,
  renderCategoryPage,
  renderTutorialPage,
  renderSitemapXml,
  renderSitemapHtml,
  render404,
  catSlug,
  catUrl,
  platformLabel,
  SITE,
} from "./render.js";
import { ensureCovers } from "./cover.mjs";
import { buildAiSection } from "./ai-section.mjs";

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

// 治愈后仍残留的乱码字段先记录、不立即告警 —— 其中一部分会被下方母本兜底覆盖，
// 真正需要人工关注的是「母本兜底后仍残留」的（见 DATA_MASTERS 应用后的汇报）。
const HEALING_LEFTOVER = [];
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
  for (const row of rows)
    for (const [k, v] of Object.entries(row))
      if (typeof v === "string" && v.includes(FFD)) HEALING_LEFTOVER.push(`${row.id ?? "?"}/${k}`);
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
  // Windows 11：代理对这篇描述有两个稳定损坏点（8 副本合并 + 单条重拉后仍残留）
  { id: "d05e874d28573342261a189c", field: "description", from: /进\uFFFD+了全面升级/, to: "进行了全面升级" },
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
// 母本兜底：长正文/长描述经代理传输损坏位置随机，定点修复覆盖不全。
// 对配置了母本的记录，若合并后字段仍残留乱码，直接用本地母本整体覆盖。
// （6058916d / c298b689 的存储层数据已于 2026-11-03 经服务端探测确认干净，
//   残留 FFD 纯属传输噪声，母本用于中和传输层损坏，不是源数据损坏。）
const DATA_MASTERS = [
  { table: "tutorials", id: "acd18f73-4840-4e8c-b6c2-d38d7625f0e8", field: "content", file: "content-master-acd18f73.txt" },
  { table: "tutorials", id: "ab616030-0d0e-4462-be04-847abc6e9de5", field: "content", file: "content-master-ab616030.txt" },
  { table: "tutorials", id: "acd18f73-4840-4e8c-b6c2-d38d7625f0e8", field: "summary", file: "summary-master-acd18f73.txt" },
  // AnyDesk 教程（2026-11-02 新增）：长中文正文传输易损坏，母本兜底
  { table: "tutorials", id: "c298b689-3b34-4e3e-aff2-7d4da3e0ae8a", field: "content", file: "content-master-c298b689.txt" },
  { table: "tutorials", id: "c298b689-3b34-4e3e-aff2-7d4da3e0ae8a", field: "summary", file: "summary-master-c298b689.txt" },
  // 2345看图王 教程（2026-11-03 新增）：传输易损坏，母本兜底
  { table: "tutorials", id: "6058916d-f0d0-44e7-a336-443916ca8aab", field: "content", file: "content-master-6058916d.txt" },
  { table: "tutorials", id: "6058916d-f0d0-44e7-a336-443916ca8aab", field: "summary", file: "summary-master-6058916d.txt" },
  // CleanMyMac 教程（2026-11-04 新增）：长中文正文传输易损坏，母本兜底
  { table: "tutorials", id: "d8c6c6f8-3ca9-4ba6-a7ea-b76094d997c9", field: "content", file: "content-master-d8c6c6f8.txt" },
  { table: "tutorials", id: "d8c6c6f8-3ca9-4ba6-a7ea-b76094d997c9", field: "summary", file: "summary-master-d8c6c6f8.txt" },
  // 傲梅轻松备份 教程（2026-11-05 新增）：长中文正文传输易损坏，母本兜底
  { table: "tutorials", id: "24929da4-ff46-46b3-b05f-11a39f79030d", field: "content", file: "content-master-24929da4.txt" },
  { table: "tutorials", id: "24929da4-ff46-46b3-b05f-11a39f79030d", field: "summary", file: "summary-master-24929da4.txt" },
  // Total Uninstall 教程（2026-11-06 新增）：长中文正文传输易损坏，母本兜底
  { table: "tutorials", id: "cd20b6ed-ae5d-49c5-95b1-4e1e0541f227", field: "content", file: "content-master-cd20b6ed.txt" },
  { table: "tutorials", id: "cd20b6ed-ae5d-49c5-95b1-4e1e0541f227", field: "summary", file: "summary-master-cd20b6ed.txt" },
  // GIMP 教程（2026-11-07 新增）：长中文正文 + 英文菜单路径写库即带乱码，母本兜底
  { table: "tutorials", id: "b734102f-efe6-4faa-b199-a590cd7c0e1f", field: "content", file: "content-master-b734102f.txt" },
  { table: "tutorials", id: "b734102f-efe6-4faa-b199-a590cd7c0e1f", field: "summary", file: "summary-master-b734102f.txt" },
  // 三篇早期教程（建站期入库，此前无母本）：2026-11-06 起补母本，消除「同一数据两次生成 md5 不同」
  { table: "tutorials", id: "7aa79aaa-b1ba-4f8a-9056-20b0a731afb3", field: "content", file: "content-master-7aa79aaa.txt" },
  { table: "tutorials", id: "91e1887a-ebb6-4171-a588-99866f62aca2", field: "content", file: "content-master-91e1887a.txt" },
  { table: "tutorials", id: "ca626bf2-5874-41f5-ad12-8bb4c1309499", field: "content", file: "content-master-ca626bf2.txt" },
  { table: "tutorials", id: "ca626bf2-5874-41f5-ad12-8bb4c1309499", field: "summary", file: "summary-master-ca626bf2.txt" },
  // AdGuard 教程（2026-11-06 生成时正文被代理截断成「��告拦截」）：补母本兜底
  { table: "tutorials", id: "f8337a6e-7a42-432b-9b0d-b4b939333f47", field: "content", file: "content-master-f8337a6e.txt" },
  // Windows 11（software 表对 anon key 只读，改不了库）：描述传输易损坏，母本兜底
  { table: "software", id: "d05e874d28573342261a189c", field: "description", file: "desc-master-d05e874d.txt" },
  // 该页描述 693 字，传输层随机截断频率高（2026-11-06 起用母本兜底，消除生成非幂等）
  { table: "software", id: "ba65264357f25999f28052c1", field: "description", file: "desc-master-ba652643.txt" },
];
const coveredByMaster = new Set();
for (const m of DATA_MASTERS) {
  const rows = m.table === "software" ? softs : tutorials;
  const row = rows.find((t) => t.id === m.id);
  if (row && typeof row[m.field] === "string" && row[m.field].includes(FFD)) {
    row[m.field] = await readFile(join(ROOT, "seo", m.file), "utf8");
    coveredByMaster.add(`${m.id}/${m.field}`);
    console.log(`已用母本覆盖 ${m.id}.${m.field}（传输乱码兜底）`);
  }
}
// 汇报：母本兜底后仍残留的才是真问题（产物会带乱码，末尾自检会 exit 2）
{
  const stillBad = new Set();
  for (const row of [...softs, ...tutorials])
    for (const [k, v] of Object.entries(row))
      if (typeof v === "string" && v.includes(FFD)) stillBad.add(`${row.id}/${k}`);
  const uncovered = [...stillBad].filter((x) => !coveredByMaster.has(x));
  if (uncovered.length) {
    console.warn(`⚠ 母本兜底后仍残留乱码字段（源数据可能损坏，需补母本）: ${uncovered.join(", ")}`);
  } else if (HEALING_LEFTOVER.length) {
    console.log(`传输乱码 ${HEALING_LEFTOVER.length} 处，已全部由母本兜底覆盖 ✓`);
  }
}
// 描述定点重写：个别记录源描述含采集噪声且过短（触发薄内容/描述告警），用真实信息整体重写
const DESC_OVERRIDES = {
  // Keka 解压缩软件：源描述为「一款Mac上好用又免费的文件解压缩软件软件详情：提取码：x13i」，
  // 含提取码噪声且正文仅 265 字，按软件公开功能重写
  mrt05wkthp9y:
    "Keka 是 macOS 平台免费好用的解压缩工具，支持 7z、Zip、Tar、Gzip 等常见压缩格式的创建与解压，也可解压 RAR 分卷压缩包，支持设置密码保护与分卷压缩，把文件拖到程序图标即可开始处理，适合日常压缩传输与接收解压场景。",
  // Driver Booster：源描述是「新设备无法正常使用？…」营销问答体，按软件公开功能重写为事实性描述
  "847f51b9ebfb78661faf5bde":
    "Driver Booster 13 Pro 是 IObit 出品的 Windows 驱动更新工具，可自动扫描显卡、声卡、网卡、主板等硬件的过时或缺失驱动并一键更新，支持驱动备份与还原、离线驱动包安装，适合系统更新后出现无声、断网、蓝屏或游戏卡顿的设备快速排查修复。",
};
for (const [id, desc] of Object.entries(DESC_OVERRIDES)) {
  const row = softs.find((s) => s.id === id);
  if (row) {
    row.description = desc;
    console.log(`已重写 ${id} 的 description（源描述噪声/过短）`);
  }
}

// 标题/分类定点重写（2026-11-02）：软件表对 anon key 只开了 SELECT，
// PATCH 返回 204 但 0 行受影响，后台改不动，只能在生成层改写。
// 待有后台/服务端权限时改数据库并删除这里的条目，避免两处维护不一致。
const NAME_OVERRIDES = {
  // 源名称是促销文案「电脑驱动更新工具 Driver Booster 13 Pro，限时 7 折特惠快入手！」，
  // 会被直接当成 SERP 标题展示，属低质信号；版本字段里也有品牌名，去掉促销词后由标题模板自动省略版本号
  "847f51b9ebfb78661faf5bde": "Driver Booster 13 Pro 驱动更新工具",
};
const CATEGORY_OVERRIDES = {
  // 原分类「驱动管理」只有这 1 条记录，生成的是 1 条目的薄分类页（入链仅 2）
  "847f51b9ebfb78661faf5bde": "实用工具",
};
for (const [id, name] of Object.entries(NAME_OVERRIDES)) {
  const row = softs.find((s) => s.id === id);
  if (row) {
    row.name = name;
    console.log(`已重写 ${id} 的 name（源名称含促销文案）`);
  }
}
for (const [id, cat] of Object.entries(CATEGORY_OVERRIDES)) {
  const row = softs.find((s) => s.id === id);
  if (row) {
    row.category = cat;
    console.log(`已重写 ${id} 的 category（原分类仅 1 条，薄分类页）`);
  }
}

console.log(`数据：software=${softs.length}，tutorials=${tutorials.length}`);

// 清理旧产物，避免删除的软件留下死页
// 注意 1：批量 rm 在部分沙箱/终端里会被安全删除守卫拦下（一次删 159 个文件触发阈值），
//         这里降级为「尽力清理」：删不掉就继续，后续写文件仍是覆盖式的，产物不会错乱。
// 注意 2：tutorial/ 只清 HTML，**保留 cover/**。CI（GitHub Actions 的 ubuntu runner）没有
//         Edge/Chrome，ensureCovers() 画不出封面，一旦连 cover/ 一起删，提交上去就是全站教程
//         封面 404（2026-11-06 就是这么丢的）。保留 PNG 后，缺页时仍会按需重建，两不误。
for (const dir of ["soft", "cat", "ai"]) {
  try {
    await rm(join(ROOT, dir), { recursive: true, force: true });
  } catch (e) {
    console.warn(`⚠ 未能清空 ${dir}/（${e.code || "删除被拦截"}），改为覆盖写入`);
  }
  await mkdir(join(ROOT, dir), { recursive: true });
}
// tutorial/：删旧页，留封面图
try {
  const tutDir = join(ROOT, "tutorial");
  await mkdir(tutDir, { recursive: true });
  for (const f of await readdir(tutDir)) {
    if (f.endsWith(".html")) await rm(join(tutDir, f), { force: true });
  }
} catch (e) {
  console.warn(`⚠ 未能清理 tutorial/*.html（${e.code || "删除被拦截"}），改为覆盖写入`);
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
// 小分类兜底顺序：按 id 升序（稳定，不随热度变化）
const stableAll = [...softs].sort((a, b) => (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0));
const pickRelated = (s) => {
  const list = catList.get(s.category) || [];
  if (list.length <= REL_N + 1) {
    const out = list.filter((x) => x.id !== s.id);
    if (out.length >= 3) return out;
    // 「驱动管理」这类只有一个成员的分类，页面上只剩 分类页+首页 两条入链。
    // 不足 3 条时用全站稳定序列补齐（标题相应改为「同类与热门软件」，避免文案与内容不符）。
    const have = new Set(out.map((x) => x.id));
    have.add(s.id);
    for (const x of stableAll) {
      if (have.has(x.id)) continue;
      have.add(x.id);
      out.push(x);
      if (out.length >= REL_N) break;
    }
    return out;
  }
  const idx = list.findIndex((x) => x.id === s.id);
  if (idx < 0) return list.slice(0, REL_N);
  const out = [];
  for (let i = 1; i <= REL_N; i += 1) out.push(list[(idx + i) % list.length]);
  return out;
};
// 教程 ↔ 软件 互链：教程标题里出现完整软件名（去空格、忽略大小写，长度≥3）即视为同一主题。
// 现状 6 篇教程只命中 2 款软件，命中率低属正常；教程每日 +1，这条链路会自动变密，
// 且匹配不到时该区块整段不渲染（不会输出空壳或无关推荐）。
const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, "");
const tutBySoft = new Map();
for (const s of softs) {
  const n = norm(s.name);
  if (n.length < 3) continue;
  const hit = tutorials.filter((t) => norm(t.title).includes(n)).slice(0, 3);
  if (hit.length) tutBySoft.set(s.id, hit);
}
const softByTut = new Map();
for (const t of tutorials) {
  const nt = norm(t.title);
  const hit = softs
    .filter((s) => s.name && norm(s.name).length >= 3 && nt.includes(norm(s.name)))
    .slice(0, 4);
  if (hit.length) softByTut.set(t.id, hit);
}
const catSet = new Set(softs.map((s) => s.category).filter(Boolean));
const optsFor = (s, related = []) => ({
  ...(nameCounts.get(s.name ?? "") > 1 ? { dupPlatform: platformLabel(s) || s.id } : {}),
  tutorials: tutBySoft.get(s.id) || [],
  // 兜底补链时列表里混入了其他分类，标题随之调整，保证标题与内容一致
  mixedRelated: related.some((x) => x.category && x.category !== s.category),
});
const rendered = softs.map((s) => {
  const related = pickRelated(s);
  const opts = optsFor(s, related);
  return { s, related, opts, ...renderSoftPage(s, related, opts) };
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
    const re = renderSoftPage(b.s, b.related, { ...b.opts, forceDescTail: true });
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
let tLinked = 0;
for (const t of tutorials) {
  const related = tutorials.filter((x) => x.id !== t.id).slice(0, 6);
  const hits = softByTut.get(t.id) || [];
  if (hits.length) tLinked += 1;
  // 分类链接只在「该分类确实有分类页」时才给，避免造出 /cat/cat-xxxx 死链
  const catLink = catSet.has(t.category) ? catUrl(t.category) : null;
  const { html } = renderTutorialPage(t, related, { softs: hits, catLink });
  await writeFile(join(ROOT, "tutorial", `${encodeURIComponent(t.id)}.html`), html, "utf8");
  tCount++;
}
console.log(`教程页：${tCount}（其中 ${tLinked} 篇回链到对应软件详情页）`);

const cats = [...new Set(softs.map((s) => s.category).filter(Boolean))];
let cCount = 0;
for (const c of cats) {
  const { html } = renderCategoryPage(c, softs.filter((s) => s.category === c));
  // ASCII slug 文件名，杜绝编码问题
  await writeFile(join(ROOT, "cat", `${catSlug(c)}.html`), html, "utf8");
  cCount++;
}
console.log(`分类页：${cCount}`);

// —— AI 工具板块（/ai/）：板块首页 + 分类页 + 工具详情页，数据源 seo/ai-tools.json ——
const aiSection = await buildAiSection(ROOT, softs);

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

// —— 首页「热门软件索引」静态块 ——
// 首页软件卡片全部由 JS 渲染的 <div> 构成，原始 HTML 里 0 条 /soft/ 链接，
// 首页权重无法向下传递，158 个详情页只能靠分类页拿内链。
// 这里在首页底部输出一份纯文本索引（真实 <a>，可见、可点击、非隐藏文本），
// 按「浏览 + 下载×3」排序取前 24 款，让爬虫从首页一跳直达核心详情页。
const HOT_N = 24;
function buildHotIndex(all) {
  const seen = new Set();
  const list = all
    .filter((s) => s.name && String(s.name).trim())
    .map((s) => ({
      id: s.id,
      name: String(s.name).trim(),
      score: (Number(s.views) || 0) + (Number(s.downloads) || 0) * 3,
    }))
    .sort((a, b) => b.score - a.score || (a.name < b.name ? -1 : 1));
  const picked = [];
  for (const s of list) {
    // 同名多平台记录（含「Eagle  图像管理」这类多空格变体）只留一条
    const key = s.name.replace(/\s+/g, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(s);
    if (picked.length >= HOT_N) break;
  }
  const items = picked
    .map((s) => `<li><a href="/soft/${encodeURIComponent(s.id)}.html">${navEsc(s.name)}</a></li>`)
    .join("");
  // v4：标签块（无外框），标题行右侧给「全部索引」出口；前几版（大卡片 / ·文字链 / 折叠行）
  // 用户均不满意，这版按标签云排布，视觉上更像「推荐位」而不是「关键词堆砌」。
  return (
    `<section class="hotindex" id="hotSoftIndex" aria-labelledby="hotSoftTitle">` +
    `<div class="hotindex-head"><h2 class="hotindex-title" id="hotSoftTitle">🔥 热门软件</h2>` +
    `<a class="hotindex-more" href="/sitemap.html">全部 ${all.length} 款索引 <i class="fas fa-angle-right"></i></a></div>` +
    `<ul class="hotindex-list">${items}<li><a href="${SITE}/ai/index.html">AI 工具导航</a></li></ul>` +
    `</section><!--/hotindex-->`
  );
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
  // 热门软件索引：先移除历史块（v1 卡片 div / v3 折叠 details / v4 section 三种标记都清），
  // 再插到「提交软件」按钮之后
  const hot = buildHotIndex(softs);
  {
    const re = /<(?:div|details|section) class="hotindex"[^>]*>[\s\S]*?<!--\/hotindex-->/g;
    idx = idx.replace(re, "");
  }
  const btnA = idx.indexOf('id="openSubmitSoftwareBtn"');
  if (btnA > 0) {
    const divEnd = idx.indexOf("</div>", btnA);
    // 把「提交按钮 wrapper 结束」到下一个 </section> 之间的空白规范成单个换行，
    // 否则每次生成都会多残留一个空行，index.html 永远不可重复
    const secB = idx.indexOf("</section>", divEnd);
    if (secB > divEnd) {
      const span = idx.slice(divEnd + "</div>".length, secB); // 从 wrapper 结束之后开始，不能含 </div> 本身
      if (!/[<>]/.test(span)) {
        let s = secB;
        while (s > 0 && /\s/.test(idx[s - 1])) s -= 1;
        idx = idx.slice(0, s) + "\n" + idx.slice(secB);
      }
    }
    const at = divEnd + "</div>".length;
    idx = idx.slice(0, at) + "\n" + hot + idx.slice(at);
  } else {
    const anchor = '<div style="margin-top:24px;text-align:center;">';
    const ai = idx.indexOf(anchor);
    if (ai > 0) idx = idx.slice(0, ai) + hot + "\n" + idx.slice(ai);
    else console.warn("⚠ 未找到首页热门索引插入锚点");
  }
  // 热门索引样式：每次生成先清掉全部旧 .hotindex* 规则，再注入 v4 标签样式（幂等）
  const HOT_CSS =
    ".hotindex{margin-top:26px;padding-top:16px;border-top:1px solid var(--border-glow,rgba(0,136,255,.12))}\n" +
    ".hotindex-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:10px}\n" +
    ".hotindex-title{font-size:.86rem;font-weight:600;color:var(--text-secondary);margin:0;letter-spacing:.02em}\n" +
    ".hotindex-more{font-size:.74rem;color:var(--text-dim);text-decoration:none;white-space:nowrap;transition:color .18s ease}\n" +
    ".hotindex-more:hover{color:var(--accent-cyan)}\n" +
    ".hotindex-list{list-style:none;display:flex;flex-wrap:wrap;gap:8px;margin:0;padding:0}\n" +
    ".hotindex-list li{margin:0}\n" +
    ".hotindex-list a{display:inline-block;font-size:.75rem;line-height:1;padding:7px 12px;border-radius:8px;color:var(--text-secondary);text-decoration:none;border:1px solid var(--border-glow-strong,rgba(15,26,46,.16));background:var(--bg-card,rgba(255,255,255,.78));transition:color .18s ease,border-color .18s ease,background .18s ease,transform .18s ease}\n" +
    ".hotindex-list a:hover{color:var(--accent-cyan);border-color:var(--accent-cyan);background:var(--bg-secondary,#eef2f9);transform:translateY(-1px)}\n" +
    "@media(max-width:600px){.hotindex-list{gap:6px}.hotindex-list a{font-size:.72rem;padding:6px 10px}}\n";
  // 清掉所有含 .hotindex 的旧样式行（含 @media 行，否则每次生成都会叠一份）
  idx = idx.replace(/^[^\n]*\.hotindex[^\n]*\n/gm, "");
  if (idx.includes('id="hotSoftIndex"')) {
    idx = idx.replace("</style>", HOT_CSS + "</style>");
  }
  // 首页静态卡片图标回填：这些卡片是给首屏和爬虫看的静态 HTML，
  // 但 <img src> 一直被写成「软」字占位 SVG（%E8%BD%AF），
  // JS 把数据拉回来之前 12 张卡全是蓝底「软」方块，用户会觉得「网站没有图标」。
  // 这里按 data-id 从数据库回填真实 icon_url，首屏就是真图标；
  // 原 onerror（隐藏 img 并显示 📦）保留，图片挂了也不会出现白块。
  let iconPatched = 0;
  {
    const byId = new Map(softs.map((s) => [String(s.id), s]));
    const seg = idx.split('<div class="software-card"');
    for (let i = 1; i < seg.length; i += 1) {
      const idm = seg[i].match(/^ data-id="([^"]+)"/);
      if (!idm) continue;
      const s = byId.get(idm[1]);
      const icon = s && s.icon_url ? String(s.icon_url).trim() : "";
      if (!icon) continue;
      if (!/src="data:image\/svg\+xml/.test(seg[i])) continue;
      seg[i] = seg[i].replace(
        /(<div class="card-icon"><img src=")data:image\/svg\+xml[^"]*(")/,
        `$1${icon.replace(/"/g, "&quot;")}$2`
      );
      iconPatched += 1;
    }
    idx = seg.join('<div class="software-card"');
  }

  await writeFile(join(ROOT, "index.html"), idx, "utf8");
  console.log(`首页侧栏静态导航：${nav.split('href="/cat/').length - 1} 条分类链接（共 ${softs.length} 款）`);
  console.log(`首页热门索引：${hot.split('href="/soft/').length - 1} 条软件详情链接`);
  console.log(`首页静态卡片图标回填：${iconPatched} 张`);
} catch (e) {
  console.warn(`⚠ 首页侧栏静态导航未更新：${e.message}`);
}

await writeFile(join(ROOT, "sitemap.xml"), renderSitemapXml(softs, tutorials, aiSection.urls), "utf8");
const sm = renderSitemapHtml(softs, tutorials, aiSection);
await writeFile(join(ROOT, "sitemap.html"), sm.html, "utf8");
console.log(
  `sitemap.xml + sitemap.html 完成（共 ${softs.length + tutorials.length + cats.length + 1 + aiSection.urls.length} 个 URL，含 AI 板块 ${aiSection.urls.length}）`
);

// ── 首屏静态快照 data/software.json ─────────────────────────────────────────────
// 为什么要它：首页当前的加载链是「HTML(CDN 0.3s) → 解析 → init supabase-js → 经 CloudBase
// 代理查 159 条（实测 TTFB 1.4s）」，四段串行，冷启动骨架屏 2.5s 主要耗在最后一段。
// 把同一批数据随站点生成成同源 JSON，浏览器能在解析 HTML 时就并行取它（同 CDN、同为 0.3s 级），
// 首屏不再等代理；代理偶发 Bad Gateway / timeout 也不再让首页空着。
// 三道保护，宁可保留上一版也不写坏文件：
//   ① 记录数 < 50 视为抓取残缺（正常 159 条），跳过；
//   ② 含 U+FFFD 乱码，跳过（前端渲染乱码比数据旧更糟）；
//   ③ 先写 .tmp 再 rename，避免中断留下半截 JSON。
const SNAP_REL = "data/software.json";
try {
  const snapSoft = [...softs].sort((a, b) =>
    String(b.created_at || "").localeCompare(String(a.created_at || ""))
  );
  /* build 是「这份快照代表的数据时刻」（毫秒），前台拿它和后台写入的 rev 比较：
     rev > build 说明后台改过、这版快照还没跟上，前台改走 REST 取实时数据。
     关键约束：数据没变时必须沿用旧 build，否则每次 CI 生成都会产生 diff、
     每 5 分钟白提交一个 commit。所以先比内容，内容一致就复用上一版的 build。 */
  const target = join(ROOT, SNAP_REL);
  const body = JSON.stringify({ categories: cats, software: snapSoft });
  let prevBuild = 0;
  let prevBody = "";
  try {
    const prev = JSON.parse(await readFile(target, "utf8"));
    prevBuild = Number(prev.build) || 0;
    if (Array.isArray(prev.software)) {
      prevBody = JSON.stringify({ categories: prev.categories, software: prev.software });
    }
  } catch {
    /* 首次生成 / 上一版损坏：按新内容处理 */
  }
  const build = prevBuild && prevBody === body ? prevBuild : Date.now();
  const payload = { v: 1, build, count: snapSoft.length, categories: cats, software: snapSoft };
  const json = JSON.stringify(payload);
  if (snapSoft.length < 50) {
    console.warn(`⚠ 软件仅 ${snapSoft.length} 条（正常 159），疑似抓取残缺：跳过 ${SNAP_REL}，保留上一版`);
  } else if (json.includes(FFD)) {
    console.warn(`⚠ 首屏快照含乱码：跳过 ${SNAP_REL}，保留上一版（前端会回落 REST）`);
  } else {
    const dir = join(ROOT, "data");
    await mkdir(dir, { recursive: true });
    const tmp = join(dir, ".software.json.tmp");
    await writeFile(tmp, json, "utf8");
    const { rename } = await import("node:fs/promises");
    await rename(tmp, target);
    const gz = (await import("node:zlib")).gzipSync(Buffer.from(json)).length;
    console.log(
      `首屏快照 ${SNAP_REL}：${snapSoft.length} 条 / ${(Buffer.byteLength(json) / 1024).toFixed(1)}KB（gzip ${(gz / 1024).toFixed(1)}KB）`
    );
  }
} catch (e) {
  console.warn(`⚠ 首屏快照生成失败（前端会回落 REST）：${e.message}`);
}

// ── 后台修复数据 data/tutorials.json ────────────────────────────────────────────
// 后台（admin.html）直接读库，同一代理同样会把长正文截断成 U+FFFD，且实测「多取几份合并」
// 对部分教程不够（每次传输都坏，只是位置不同）。这里的 tutorials 是已经过 8 份合并 +
// 母本兜底的干净版本，admin 发现库里字段带乱码时就用它按字段修复。
// 只修「库里含 FFFD 且这里不含」的字段，静态数据不会覆盖后台新改的干净内容；
// 记录的 updated_at 晚于本文件 build 时整个跳过，防止用户刚改完的正文被旧版回退。
try {
  const tutPayload = {
    build: Date.now(),
    tutorials: tutorials.map((t) => ({
      id: t.id,
      title: t.title,
      summary: t.summary,
      content: t.content,
      updated_at: t.updated_at || null,
    })),
  };
  const tutJson = JSON.stringify(tutPayload);
  if (tutorials.length < 5) {
    console.warn(`⚠ 教程仅 ${tutorials.length} 篇，疑似抓取残缺：跳过 data/tutorials.json`);
  } else if (tutJson.includes(FFD)) {
    console.warn("⚠ 教程修复数据含乱码：跳过 data/tutorials.json（后台保持多次合并兜底）");
  } else {
    const dir = join(ROOT, "data");
    await mkdir(dir, { recursive: true });
    const tmpT = join(dir, ".tutorials.json.tmp");
    await writeFile(tmpT, tutJson, "utf8");
    const { rename } = await import("node:fs/promises");
    await rename(tmpT, join(ROOT, "data/tutorials.json"));
    console.log(
      `教程修复数据 data/tutorials.json：${tutorials.length} 篇 / ${(Buffer.byteLength(tutJson) / 1024).toFixed(1)}KB`
    );
  }
} catch (e) {
  console.warn(`⚠ 教程修复数据生成失败（后台保持多次合并兜底）：${e.message}`);
}

// 404 兜底页：GitHub Pages 自动接管根目录 404.html，同时保持 404 状态码。
// 数据完全由当次产物派生（热门排序、分类、搜索索引），不做手工维护，避免与首页漂移。
const p404 = render404(softs, tutorials, aiSection.collections);
await writeFile(join(ROOT, "404.html"), p404.html, "utf8");
const idxN404 = (p404.html.split("var IDX = ")[1].split(";\n")[0].match(/\["/g) || []).length;
console.log(`404.html 完成（热门 12 条 · 搜索索引 ${idxN404} 条 = 软件 ${softs.length} + 教程 ${tutorials.length}）`);

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
// 2026-11-06 修复：原先只扫 soft/cat/tutorial + 根目录，ai/ 与 ai/tool/ 的乱码逃过自检，
// 导致「产物自检通过」与 qa.mjs 的 fffdCount=1 自相矛盾。现把 ai 一并纳入。
for (const dir of ["soft", "cat", "tutorial", "ai"]) await scanDir(join(ROOT, dir));
for (const f of readdirSync(ROOT)) {
  if (f.endsWith(".html") && (await readFile(join(ROOT, f), "utf8")).includes(FFD)) badFiles.push(f);
}
if (badFiles.length) {
  console.error(`⚠ 产物仍含 ${badFiles.length} 个乱码文件：${badFiles.join(", ")}——请重跑本脚本（exit 2）`);
  process.exit(2);
}
console.log("产物自检通过：无乱码");
