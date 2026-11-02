// admin.html AI 模块二期：封面(logo) + 工具详情字段(slug/intro/screenshots) + 列表缩略图（幂等）
import fs from 'fs';
const FILE = 'admin.html';
let s = fs.readFileSync(FILE, 'utf8');
let n = 0;
function rep(from, to, label) {
  if (!s.includes(from)) { console.error('锚点未找到: ' + label); process.exit(1); }
  s = s.split(from).join(to); n++;
}

// —— 工具集：payload 加 logo ——
rep("icon:document.getElementById('aiColIcon').value.trim()||'🧩',sort:",
    "icon:document.getElementById('aiColIcon').value.trim()||'🧩',logo:document.getElementById('aiColLogo').value.trim(),sort:",
    'col payload');

// —— 工具集表单：图标行后加封面 URL ——
rep(`h+='<div class="form-row"><div class="form-group"><label>图标（emoji）</label><input id="aiColIcon" value="'+(e?escapeHTML(e.icon||'🧩'):'🧩')+'" /></div>';`,
    `h+='<div class="form-row"><div class="form-group"><label>图标（emoji）</label><input id="aiColIcon" value="'+(e?escapeHTML(e.icon||'🧩'):'🧩')+'" /></div>';` +
    `h+='<div class="form-group"><label>封面图 URL（选填，侧栏/卡片展示；留空用 emoji）</label><input id="aiColLogo" value="'+(e?escapeHTML(e.logo||''):'')+'" placeholder="https://…/logo.png" /></div>';`,
    'col form logo');

// —— 工具集列表：图标列换缩略图 ——
rep(`escapeHTML(x.icon||'🧩')`,
    `(x.logo?'<img src="'+escapeHTML(x.logo)+'" style="width:34px;height:34px;border-radius:8px;object-fit:cover;">':escapeHTML(x.icon||'🧩'))`,
    'col list thumb');

// —— 工具：payload 加 logo/slug/intro/screenshots ——
rep("icon:document.getElementById('aiToolIcon').value.trim()||'🤖',pricing:",
    "icon:document.getElementById('aiToolIcon').value.trim()||'🤖',logo:document.getElementById('aiToolLogo').value.trim(),slug:document.getElementById('aiToolSlug').value.trim(),intro:document.getElementById('aiToolIntro').value.trim(),screenshots:document.getElementById('aiToolShots').value.trim(),pricing:",
    'tool payload');
// 可选字段为空时不提交（列未建时也不影响基础保存）
rep("if(!payload.name||!payload.url){toast('工具名和官网地址必填','warning');return;}",
    "['logo','slug','intro','screenshots'].forEach(function(k){if(!payload[k])delete payload[k];});if(!payload.name||!payload.url){toast('工具名和官网地址必填','warning');return;}",
    'tool payload cleanup');

// —— 工具表单：官网地址行后加页面标识 ——
rep(`h+='<div class="form-group"><label>官网地址 <span class="required">*</span></label><input id="aiToolUrl" value="'+(e?escapeHTML(e.url||''):'')+'" placeholder="https://…" /></div></div>';`,
    `h+='<div class="form-group"><label>官网地址 <span class="required">*</span></label><input id="aiToolUrl" value="'+(e?escapeHTML(e.url||''):'')+'" placeholder="https://…" /></div>';` +
    `h+='<div class="form-group"><label>页面标识（选填，英文/数字/横线，留空自动生成）</label><input id="aiToolSlug" value="'+(e?escapeHTML(e.slug||''):'')+'" placeholder="如：doubao" /></div></div>';`,
    'tool form slug');

// —— 工具表单：图标行后加封面 URL ——
rep(`h+='<div class="form-group"><label>图标（emoji）</label><input id="aiToolIcon" value="'+(e?escapeHTML(e.icon||'🤖'):'🤖')+'" /></div></div>';`,
    `h+='<div class="form-group"><label>图标（emoji）</label><input id="aiToolIcon" value="'+(e?escapeHTML(e.icon||'🤖'):'🤖')+'" /></div>';` +
    `h+='<div class="form-group"><label>封面图 URL（选填，卡片/详情页展示；留空自动生成字母封面）</label><input id="aiToolLogo" value="'+(e?escapeHTML(e.logo||''):'')+'" placeholder="https://…/logo.png" /></div></div>';`,
    'tool form logo');

// —— 工具表单：状态行后加截图 + 详细介绍 ——
rep(`h+='<div class="form-group"><label>状态</label><select id="aiToolPub"><option value="true"'+(e&&e.is_published===false?'':' selected')+'>上架</option><option value="false"'+(e&&e.is_published===false?' selected':'')+'>下架</option></select></div></div>';`,
    `h+='<div class="form-group"><label>状态</label><select id="aiToolPub"><option value="true"'+(e&&e.is_published===false?'':' selected')+'>上架</option><option value="false"'+(e&&e.is_published===false?' selected':'')+'>下架</option></select></div></div>';` +
    `h+='<div class="form-group"><label>封面截图 URL（选填，多张用换行分隔，详情页展示）</label><textarea id="aiToolShots" style="min-height:60px;">'+(e?escapeHTML(e.screenshots||''):'')+'</textarea></div>';` +
    `h+='<div class="form-group"><label>详细介绍（选填，空行分段，详情页展示）</label><textarea id="aiToolIntro" style="min-height:110px;">'+(e?escapeHTML(e.intro||''):'')+'</textarea></div>';`,
    'tool form shots+intro');

// —— 工具列表：图标列换缩略图 ——
rep(`escapeHTML(t.icon||'🤖')`,
    `(t.logo?'<img src="'+escapeHTML(t.logo)+'" style="width:34px;height:34px;border-radius:8px;object-fit:cover;">':escapeHTML(t.icon||'🤖'))`,
    'tool list thumb');

// —— 两个表头「图标」→「封面」 ——
const thCount = (s.match(/<th>图标<\/th>/g) || []).length;
s = s.split('<th>图标</th>').join('<th>封面</th>'); n++;
console.log('表头替换', thCount, '处');

fs.writeFileSync(FILE, s);
console.log('完成，共', n, '处改动，新大小', s.length);
