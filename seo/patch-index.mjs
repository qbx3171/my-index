/**
 * index.html / copyright.html SEO 修补脚本（幂等，可重复运行）
 * 1. canonical 同步脚本指向静态详情页（?soft= / ?cat= 的规范 URL 改为 /soft/{id}.html）
 * 2. JSON-LD 与分享 URL 改为静态页真实 URL
 * 3. 分类浏览历史 URL 保持 SPA 行为但分类 canonical 指向静态分类页
 * 4. 基础 canonical/og:url 改为 www
 * 5. 页脚加"网站地图"内链
 * 6. copyright.html 的 .cn.cc 错误域名改为 www.lezhesoft.cn
 */
import { readFile, writeFile } from "node:fs/promises";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

let idx = await readFile(`${ROOT}/index.html`, "utf8");
const before = idx.length;
const patches = [
  // 1. canonical 同步脚本：指向静态页
  [
    "if(soft)u='https://lezhesoft.cn/?soft='+encodeURIComponent(soft);",
    "if(soft)u='https://www.lezhesoft.cn/soft/'+encodeURIComponent(soft)+'.html';",
  ],
  [
    "else if(cat)u='https://lezhesoft.cn/?cat='+encodeURIComponent(cat);",
    "else if(cat)u='https://www.lezhesoft.cn/cat/'+encodeURIComponent(cat)+'.html';",
  ],
  // 2. hostname 判断兼容 www（原脚本在 www 下直接 return，永不生效）
  [
    "if(location.protocol==='file:'||location.hostname!=='lezhesoft.cn')return;",
    "if(location.protocol==='file:')return;",
  ],
  // 3. JSON-LD / 分享 URL：?soft= → 静态详情页
  [
    "window.location.origin+window.location.pathname+'?soft='+encodeURIComponent(soft.id)",
    "'https://www.lezhesoft.cn/soft/'+encodeURIComponent(soft.id)+'.html'",
  ],
  [
    "window.location.origin+window.location.pathname+'?soft='+soft.id",
    "'https://www.lezhesoft.cn/soft/'+soft.id+'.html'",
  ],
  // 4. JSON-LD 分类项 → 静态分类页
  [
    "window.location.origin+'/?cat='+encodeURIComponent(soft.category||'')",
    "'https://www.lezhesoft.cn/cat/'+encodeURIComponent(soft.category||'')+'.html'",
  ],
  // 5. 基础 canonical / og:url → www
  ['<link rel="canonical" href="https://lezhesoft.cn/">', '<link rel="canonical" href="https://www.lezhesoft.cn/">'],
  ['<meta property="og:url" content="https://lezhesoft.cn/">', '<meta property="og:url" content="https://www.lezhesoft.cn/">'],
  // 6. 页脚加网站地图
  [
    '<a href="#" onclick="openDonateModal();return false;">赞助打赏</a>',
    '<a href="#" onclick="openDonateModal();return false;">赞助打赏</a> | <a href="/sitemap.html">网站地图</a>',
  ],
];
let applied = 0;
for (const [from, to] of patches) {
  if (idx.includes(to)) continue; // 已修补过（幂等）
  const n = idx.split(from).length - 1;
  if (n === 0) {
    console.log(`[跳过·未找到] ${from.slice(0, 60)}...`);
    continue;
  }
  idx = idx.split(from).join(to);
  applied += n;
  console.log(`[替换 ${n} 处] ${from.slice(0, 60)}...`);
}
await writeFile(`${ROOT}/index.html`, idx, "utf8");
console.log(`index.html：应用 ${applied} 处替换，长度 ${before} → ${idx.length}`);

// copyright.html 的 .cn.cc 域名
let cp = await readFile(`${ROOT}/copyright.html`, "utf8");
const cpBefore = cp;
cp = cp.split("https://www.lezhesoft.cn.cc").join("https://www.lezhesoft.cn").split("https://lezhesoft.cn.cc").join("https://www.lezhesoft.cn");
if (cp !== cpBefore) {
  await writeFile(`${ROOT}/copyright.html`, cp, "utf8");
  console.log("copyright.html：已修正 .cn.cc 域名引用");
} else {
  console.log("copyright.html：无需修改");
}
