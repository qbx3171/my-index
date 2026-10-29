/**
 * 教程封面自动生成
 * ensureCovers(tutorials)：为 cover 为空的教程生成 1200x630 PNG 封面
 *   （本地 SVG → 无头 Edge 截图），写入 /tutorial/cover/<id>.png 并回填 cover 字段。
 * 已有 PNG 的不再重生成（幂等，避免每天重复截图）；改标题后想重绘可手动删 PNG。
 * 本地无 Edge/Chrome 时跳过并打警告，不阻塞生成流程。
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "tutorial", "cover");
const SITE = "https://www.lezhesoft.cn";
const W = 1200;
const H = 630;

const CATEGORY_ICON = {
  "Adobe系列": "🎨",
  "实用工具": "🛠️",
  "实用": "🛠️",
  "开发工具": "💻",
  "图像处理": "🖼️",
  "媒体工具": "🎬",
  "三维设计": "🧊",
  "办公软件": "📊",
  "系统镜像": "💾",
  "驱动管理": "⚙️",
  "启动管理": "🔌",
  "安卓软件": "📱",
};

// 分类 → 渐变配色（深色底，白字，保证对比度）
const PALETTES = [
  ["#1a3a6b", "#2d5fa8"],
  ["#5b2d8a", "#8a4ec2"],
  ["#0e5e52", "#1e9c86"],
  ["#8a3a1e", "#c96b3d"],
  ["#28425e", "#4a7bab"],
];

function paletteFor(key) {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTES[h % PALETTES.length];
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildSvg(title, category) {
  const [c1, c2] = paletteFor(category || "教程");
  const icon = CATEGORY_ICON[category] || "📘";
  const cat = (category || "软件教程").slice(0, 12);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/>
      <stop offset="1" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="${W - 140}" cy="120" r="200" fill="#ffffff" opacity="0.06"/>
  <circle cx="${W - 40}" cy="${H - 60}" r="260" fill="#ffffff" opacity="0.05"/>
  <circle cx="40" cy="${H + 80}" r="180" fill="#000000" opacity="0.08"/>
  <text x="76" y="240" font-family="'Segoe UI Emoji','Apple Color Emoji',sans-serif" font-size="190">${icon}</text>
  <text x="80" y="360" font-family="'Microsoft YaHei','PingFang SC',sans-serif" font-size="56" font-weight="700" fill="#ffffff">${esc(cat)}</text>
  <text x="80" y="424" font-family="'Microsoft YaHei',sans-serif" font-size="34" fill="#ffffff" opacity="0.8">图文使用教程</text>
  <text x="80" y="${H - 56}" font-family="'Microsoft YaHei',sans-serif" font-size="30" fill="#ffffff" opacity="0.85">乐哲软件 · lezhesoft.cn</text>
</svg>`;
}

function findBrowser() {
  const candidates = [
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  ];
  return candidates.find((p) => existsSync(p)) || null;
}

export async function ensureCovers(tutorials) {
  const made = [];
  let browser = null;
  for (const t of tutorials) {
    const id = t.id;
    if (!id) continue;
    const localUrl = `${SITE}/tutorial/cover/${id}.png`;
    const outPng = join(OUT_DIR, `${id}.png`);
    // 已指向本地且 PNG 文件仍在 → 无需处理（注意：generate.mjs 每次会清空 tutorial/
    // 目录连 cover/ 一起删掉，所以即使 cover 字段已是本地 URL，PNG 缺失时也必须重生成）
    if (t.cover === localUrl && existsSync(outPng)) continue;
    if (!existsSync(outPng)) {
      browser = browser ?? findBrowser();
      if (!browser) {
        console.warn("未找到 Edge/Chrome，跳过封面生成");
        return made;
      }
      await mkdir(OUT_DIR, { recursive: true });
      const svg = buildSvg(t.title || "软件教程", t.category);
      const tmpHtml = join(tmpdir(), `cover-${id}.html`);
      await writeFile(tmpHtml, `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0}</style></head><body><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}" width="${W}" height="${H}"></body></html>`, "utf8");
      try {
        execFileSync(browser, [
          "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
          `--window-size=${W},${H}`, `--screenshot=${outPng}`, `file:///${tmpHtml.replace(/\\/g, "/")}`,
        ], { timeout: 60000, stdio: "ignore" });
      } catch (e) {
        console.warn(`封面截图失败 ${id}: ${e.message}`);
        continue;
      }
      made.push(id);
    }
    t.cover = localUrl;
  }
  return made;
}
