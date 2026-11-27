/**
 * 名称匹配别名（generate.mjs 的教程↔软件互链、tutorial-pick.mjs 的「是否已有教程」共用）
 *
 * 背景：教程标题习惯只写品牌短名（「Driver Booster使用教程：…」「Photon Studio使用教程：…」），
 * 而库内 software.name 常带中文后缀（「Photon Studio 图片编辑软件」）或促销文案，
 * 直接 `title.includes(name)` 判覆盖会把大量已写过的软件继续算成「未覆盖」。
 *
 * 历史修补全部收敛在这里，改动前务必跑：
 *   node seo/generate.mjs → 与改动前产物 md5 全等（证明互链逻辑未被改动）
 */

export const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, "");

// 2026-11-27：泛词别名黑名单。单字拉丁段当别名时，「Windows 10 正版PC操作系统」「Windows 夸克网盘」
// 都会产出别名 windows，于是 Parallels Desktop教程（标题含「在Mac上装Windows」）被错配成这三款的
// 「相关软件下载」——教程页 4 条出链里 3 条无关（已实测确认）。这类平台/家族词不具区分度，一律不用。
const STOP = new Set(["windows", "mac", "macos", "os", "office", "adobe", "pdf", "linux", "android", "ios", "pc", "pro"]);
const usable = (a) => a && !STOP.has(a);
// 去掉尾部版本号只有当拉丁段里确实有 ≥2 个字母词时才成立（totaluninstall2026 → totaluninstall ✓；
// windows10 → windows ✗，那是把品牌词单独拎出来当别名，最容易泛匹配）
const multiWord = (s) => ((s.match(/[a-z]{2,}/g) || []).length >= 2);

const aliasCache = new Map();

export function aliasesOf(name) {
  const key = norm(name);
  if (aliasCache.has(key)) return aliasCache.get(key);
  const out = [];
  if (key.length >= 3) out.push({ a: key, full: true });
  const latin = key.match(/^[a-z0-9][a-z0-9.+#&_-]*/);
  if (latin && latin[0].length >= 4) {
    if (usable(latin[0])) out.push({ a: latin[0], full: false });
    // 软件名常带版本号（Total Uninstall 2026 / Adobe Creative Cloud 2025），教程标题一般不带，去掉尾数字再试一次
    const noVer = latin[0].replace(/[0-9._-]+$/, "");
    if (noVer.length >= 4 && noVer !== latin[0] && usable(noVer) && multiWord(noVer)) {
      out.push({ a: noVer, full: false });
    }
  }
  // 2026-11-16：3 位全大写缩写（WPS / PDF / CAD）被上面的「≥4 位」规则漏掉，
  // 导致「WPS Office使用教程」与「WPS电信定制版…」双向不互链。只认「全大写 3 位 + 后面不是字母数字」，
  // 避免把小写短词当别名；实测全站影响面 = 新增 1 对（WPS），无误配。
  if (!(latin && latin[0].length >= 4)) {
    const acro = String(name || "").match(/^([A-Z0-9]{3})(?![A-Za-z0-9])/);
    if (acro) out.push({ a: acro[1].toLowerCase(), full: false });
  }
  const cn = key.match(/^[\u4e00-\u9fa5]{3,}/);
  if (cn && cn[0] !== key) out.push({ a: cn[0], full: false });
  // 2026-11-12：norm() 去空格会把相邻拉丁词粘成一整段。软件名里拉丁词重复出现时
  // （「Geek Uninstaller Geek卸载工具」→ geekuninstallergeek），与教程标题里的
  // 「Geek Uninstaller」永远匹配不上。改按原串（中文之前的拉丁前缀）取前两个词作别名，
  // 只用两词前缀、不用单词，避免「adobe」这类泛词把不相关页面拉进来。
  const head = String(name || "").split(/[\u4e00-\u9fa5]/)[0];
  const words = head
    .split(/\s+/)
    .map((w) => w.replace(/^[^A-Za-z0-9]+/, "").replace(/[^A-Za-z0-9.+#&_-]+$/, ""))
    .filter(Boolean);
  if (words.length >= 2) {
    const two = norm(words.slice(0, 2).join(" "));
    if (two.length >= 5 && two !== key && !out.some((x) => x.a === two)) out.push({ a: two, full: false });
  }
  // 长别名优先，避免短别名先把不相关页面拉进来
  out.sort((x, y) => (y.full ? 1 : 0) - (x.full ? 1 : 0) || y.a.length - x.a.length);
  aliasCache.set(key, out);
  return out;
}
