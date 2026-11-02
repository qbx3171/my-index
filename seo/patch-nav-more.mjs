// 首页导航减负：签到/排行榜/商城/打赏 收进「更多 ▾」下拉（幂等）
import fs from 'fs';
const FILE = 'index.html';
let s = fs.readFileSync(FILE, 'utf8');

if (s.includes('navMorePanel')) { console.log('已处理过，跳过'); process.exit(0); }

// 1) 定位导航 <ul>
const start = s.indexOf('id="navLinks"');
if (start < 0) throw new Error('navLinks not found');
const ulStart = s.lastIndexOf('<ul', start);
const ulEnd = s.indexOf('</ul>', start);
let seg = s.slice(ulStart, ulEnd);

// 2) 摘出四个 <li>
const grab = (re) => {
  const m = seg.match(re);
  if (!m) throw new Error('nav item not found: ' + re);
  seg = seg.replace(m[0], '');
  return m[0];
};
grab(/<li>\s*<a[^>]*data-page="checkin"[\s\S]*?<\/li>/);
grab(/<li>\s*<a[^>]*data-page="ranking"[\s\S]*?<\/li>/);
grab(/<li>\s*<a[^>]*data-page="mall"[\s\S]*?<\/li>/);
grab(/<li>\s*<a[^>]*openDonateModal[\s\S]*?<\/li>/);

// 3) 插入「更多 ▾」下拉（面板里的 <a> 保持 data-page，初始化时仍会被 SPA 逐个绑定）
const dropLi = `<li class="nav-more" id="navMoreLi"><a href="#" id="navMoreBtn"><i class="fas fa-ellipsis-h"></i> 更多 <i class="fas fa-chevron-down nav-caret"></i></a><div class="nav-more-panel" id="navMorePanel"><a href="#" data-page="checkin"><i class="fas fa-calendar-check"></i> 签到</a><a href="#" data-page="ranking"><i class="fas fa-trophy"></i> 排行榜</a><a href="#" data-page="mall"><i class="fas fa-gift"></i> 商城</a><a href="#" onclick="openDonateModal();return false;"><i class="fas fa-heart" style="color:#e74c3c;"></i> 打赏</a></div></li>`;
seg = seg.replace('</ul>', dropLi + '</ul>');

// 4) 下拉开关脚本（紧跟导航之后，元素已存在）
const toggleJs = `<script>(function(){var li=document.getElementById('navMoreLi');if(!li)return;document.getElementById('navMoreBtn').addEventListener('click',function(e){e.preventDefault();e.stopPropagation();li.classList.toggle('open');});document.addEventListener('click',function(e){if(!li.contains(e.target))li.classList.remove('open');});document.getElementById('navMorePanel').addEventListener('click',function(){li.classList.remove('open');});})();</script>`;

s = s.slice(0, ulStart) + seg + toggleJs + s.slice(ulEnd);

// 5) 下拉样式（追加到 </head> 前）
const css = `<style id="navMoreStyle">
.nav-more{position:relative}
.nav-more>.nav-caret{font-size:.55rem;margin-left:2px;transition:transform .2s}
.nav-more.open>.nav-caret{transform:rotate(180deg)}
.nav-more-panel{position:absolute;top:calc(100% + 10px);right:0;min-width:148px;background:var(--bg-panel,#fff);border:1px solid var(--border-glow);border-radius:14px;box-shadow:var(--shadow-card);padding:6px;display:none;z-index:1300}
.nav-more.open .nav-more-panel{display:block}
.nav-more-panel a{display:flex;align-items:center;gap:10px;width:100%;padding:10px 14px;border-radius:10px;font-size:.9rem;color:var(--text-secondary);white-space:nowrap}
.nav-more-panel a:hover{background:rgba(0,136,255,.08);color:var(--text-primary)}
@media (max-width:768px){.nav-more-panel{position:static;border:none;background:transparent;box-shadow:none;padding:0 0 0 12px;min-width:0}.nav-more-panel a{color:var(--text-secondary)}}
</style>`;
s = s.replace('</head>', css + '</head>');

fs.writeFileSync(FILE, s);
console.log('导航下拉完成，新大小', s.length);
