// 校验 admin.html 所有内联脚本语法 + 关键改动存在性
const fs = require('fs');
const h = fs.readFileSync('admin.html', 'utf8');
let fail = 0;

// 1) 逐段语法检查
const segs = [...h.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
segs.forEach((s, i) => {
  try { new Function(s); console.log('script #' + i + ' 语法 OK (' + (s.length / 1024).toFixed(1) + 'KB)'); }
  catch (e) { fail++; console.log('script #' + i + ' ❌ ' + e.message); }
});

// 2) 关键改动存在性
const checks = [
  ["拒绝守卫", /该订单已被处理过，正在刷新列表/],
  ["退款失败显式报错", /积分退还失败，请手动为该用户退还/],
  ["cats 保留缓存", /from\('categories'\)\.select\('\*'\)\.order\('name'\)\);if\(r\.error\)return this\._ca\|\|\[\]/],
  ["softOne 方法", /async softOne\(id\)/],
  ["soft 精简字段", /select\('id,name,category,version,icon,icon_url,platforms,downloads,views,recommend,created_at'\)/],
  ["编辑走 softOne", /var row=await DB\.softOne\(this\._editId\);/],
  ["详情走 softOne", /DB\.softOne\(id\)\.then\(function\(s\)/],
  ["重名检测", /已存在同名软件「'\+d\.name\+'」/],
  ["renameCat", /async renameCat\(oldN,newN\)/],
  ["分类重命名按钮", /class="ren-btn" data-cat/],
  ["教程查重防重复插入", /checkDupThen/],
  ["搜索扩展", /var mn=\(\(s\.name\|\|''\)\+' '\+\(s\.category\|\|''\)\+' '\+\(s\.description\|\|''\)\)\.toLowerCase\(\)/],
  ["吉祥物文案1", /在左侧进入「上传软件」，填写名称/],
  ["吉祥物文案2", /商城商品在「积分商城」维护/],
  ["吉祥物文案3", /「仪表盘」汇总软件数/],
];
checks.forEach(([name, re]) => {
  const ok = re.test(h);
  if (!ok) fail++;
  console.log((ok ? '✓' : '✗ 缺失') + ' ' + name);
});

// 3) 不应再出现的东西
if (/async soft\(f\)[\s\S]{0,400}?select\('\*'\)/.test(h)) { fail++; console.log('✗ soft 仍为 select(*)'); } else console.log('✓ soft 已去 select(*)');
const dupId = (h.match(/id="permSelectAll"/g) || []).length;
console.log('permSelectAll 出现 ' + dupId + ' 次（两弹窗各自作用域查询，现状可用）');

console.log(fail ? ('\n❌ 失败 ' + fail + ' 项') : '\n✅ 全部通过');
process.exit(fail ? 1 : 0);
