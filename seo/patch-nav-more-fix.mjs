// 精修：插入「更多 ▾」面板 li（置于登录按钮之前）+ 样式插入真实 head
import fs from 'fs';
const FILE = 'index.html';
let s = fs.readFileSync(FILE, 'utf8');

// —— ① 插入面板 li：放在 authNav（登录）li 之前 ——
if (!s.includes('id="navMorePanel"')) {
  const authIdx = s.indexOf('id="authAvatar"');
  if (authIdx < 0) throw new Error('authAvatar not found');
  const liStart = s.lastIndexOf('<li', authIdx);
  if (liStart < 0) throw new Error('auth li start not found');
  const dropLi = `<li class="nav-more" id="navMoreLi"><a href="#" id="navMoreBtn"><i class="fas fa-ellipsis-h"></i> 更多 <i class="fas fa-chevron-down nav-caret"></i></a><div class="nav-more-panel" id="navMorePanel"><a href="#" data-page="checkin"><i class="fas fa-calendar-check"></i> 签到</a><a href="#" data-page="ranking"><i class="fas fa-trophy"></i> 排行榜</a><a href="#" data-page="mall"><i class="fas fa-gift"></i> 商城</a><a href="#" onclick="openDonateModal();return false;"><i class="fas fa-heart" style="color:#e74c3c;"></i> 打赏</a></div></li>`;
  s = s.slice(0, liStart) + dropLi + s.slice(liStart);
  console.log('① 面板 li 已插入（登录按钮之前）');
} else console.log('① 面板已存在，跳过');

// —— ② 样式插入真实 head（锚点带结尾斜杠与 crossorigin=""） ——
const headEnd = s.indexOf('</head>');
if (!s.slice(0, headEnd).includes('navMoreStyle')) {
  const anchor = '<link rel="preconnect" href="https://cdn.bootcdn.net/"';
  if (!s.slice(0, headEnd).includes(anchor)) throw new Error('head anchor not found in head');
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
  s = s.replace(anchor, css + anchor);
  console.log('② 样式已插入真实 head');
} else console.log('② 样式已在 head，跳过');

fs.writeFileSync(FILE, s);
console.log('完成，新大小', s.length);
