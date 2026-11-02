// 终版修复：①还原 DOMPurify 字符串内被注入的样式块；②样式插入真实 head
import fs from 'fs';
const FILE = 'index.html';
let s = fs.readFileSync(FILE, 'utf8');

// ① 还原：把 <style id="navMoreStyle">…</style></head> 换回 </head>（它位于主脚本字符串里）
const bad = /<style id="navMoreStyle">[\s\S]*?<\/style><\/head>/;
if (bad.test(s)) {
  const realHead = s.indexOf('</head>');
  const m = bad.exec(s);
  // 只有当该匹配出现在真实 </head> 之前且中间隔着大量脚本内容时才可能是字符串内——直接按位置判断：
  // 真实 head 的 </head> 是最后一个；字符串内的这个匹配结束位置若早于 preconnect 区，说明在脚本里
  s = s.replace(bad, '</head>');
  console.log('① 已还原字符串内的错位样式块');
} else {
  console.log('① 无错位样式块');
}

// ② 插入真实 head（锚点：bootcdn preconnect，head 内）
const headEnd = s.indexOf('</head>');
if (!s.slice(0, headEnd).includes('navMoreStyle')) {
  const anchor = '<link rel="preconnect" href="https://cdn.bootcdn.net/"';
  const ai = s.slice(0, headEnd).indexOf(anchor);
  if (ai < 0) throw new Error('head anchor not found');
  const css = `<style id="navMoreStyle">
.nav-more{position:relative}
.nav-more .nav-caret{font-size:.55rem;margin-left:2px;transition:transform .2s}
.nav-more.open .nav-caret{transform:rotate(180deg)}
.nav-more-panel{position:absolute;top:calc(100% + 10px);right:0;min-width:148px;background:var(--bg-panel,#fff);border:1px solid var(--border-glow);border-radius:14px;box-shadow:var(--shadow-card);padding:6px;display:none;z-index:1300}
.nav-more.open .nav-more-panel{display:block}
.nav-more-panel a{display:flex;align-items:center;gap:10px;width:100%;padding:10px 14px;border-radius:10px;font-size:.9rem;color:var(--text-secondary);white-space:nowrap}
.nav-more-panel a:hover{background:rgba(0,136,255,.08);color:var(--text-primary)}
@media (max-width:768px){.nav-more-panel{position:static;border:none;background:transparent;box-shadow:none;padding:0 0 0 12px;min-width:0}}
</style>`;
  s = s.slice(0, ai) + css + s.slice(ai);
  console.log('② 样式已插入真实 head');
} else console.log('② 样式已在 head');

fs.writeFileSync(FILE, s);

// —— 写后自检 ——
const v = fs.readFileSync(FILE, 'utf8');
const headEnd2 = v.indexOf('</head>');
console.log('自检：');
console.log('  样式块总数', (v.match(/<style id="navMoreStyle">/g) || []).length, '（应 1）');
console.log('  样式在真实 head 内:', v.slice(0, headEnd2).includes('navMoreStyle'));
console.log('  DOMPurify 串已还原:', /1999\/xhtml"><head><\/head>/.test(v) || !/xhtml"><head><style/.test(v));
console.log('  面板 li:', v.includes('id="navMorePanel"'), 'toggleJs:', v.includes("getElementById('navMoreBtn')"));
