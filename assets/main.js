var IS_LOCAL_HOST=/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
var IS_FILE_PREVIEW=location.protocol==='file:';
var IS_LOCAL_PREVIEW=IS_FILE_PREVIEW||IS_LOCAL_HOST;
var SUPABASE_URL='https://lezhesoft-d0g80z4vb0ac03c39-1300972301.ap-shanghai.app.tcloudbase.com/supabase-proxy';
var SUPABASE_ANON_KEY='sb_publishable__KOJGRcvoRGC3QiHNg7_qA_-9yGsnCW';
var supabaseClient=null;
var isAdmin=false;
var currentUser=null;
var userProfile=null;
var _urlParamsHandled=false;
var _supabaseInitRetries=0;
var _supabaseInitMaxRetries=30;
function initSupabase(){
if(IS_LOCAL_PREVIEW)return false;
if(supabaseClient)return true;
if(typeof supabase!=='undefined'&&supabase&&supabase.createClient){
try{supabaseClient=supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);try{if(supabaseClient.realtime){supabaseClient.realtime.reconnectAfterMs=function(t){return t>2?1e9:([1000,3000,5000][t-1]||5000);};if(supabaseClient.realtime.onError){supabaseClient.realtime.onError(function(){rtNoteFail();});}}}catch(e2){}console.log('[Supabase] 初始化成功');return true;}
catch(e){console.error('Supabase 初始化失败',e);return false;}
}
return false;
}
function tryInitSupabaseWithRetry(){
if(IS_LOCAL_PREVIEW)return;
if(supabaseClient)return;
if(initSupabase())return;
_supabaseInitRetries++;
if(_supabaseInitRetries<_supabaseInitMaxRetries){
setTimeout(tryInitSupabaseWithRetry,500);
}else{
console.warn('[Supabase] 库加载超时，尝试备用方案...');
tryLoadSupabaseFallback();
}
}
function tryLoadSupabaseFallback(){
if(supabaseClient)return;
var fallbackUrls=[
'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.3/dist/umd/supabase.min.js',
'https://unpkg.com/@supabase/supabase-js@2.39.3/dist/umd/supabase.min.js'
];
var idx=0;
function tryNext(){
if(idx>=fallbackUrls.length||supabaseClient)return;
var s=document.createElement('script');s.src=fallbackUrls[idx];
s.onload=function(){
if(initSupabase()){console.log('[Supabase] 备用CDN加载成功');window.dispatchEvent(new Event('supabase:ready'));}
else{idx++;tryNext();}
};
s.onerror=function(){idx++;tryNext();};
document.head.appendChild(s);
}
tryNext();
}
tryInitSupabaseWithRetry();
var THEME_VALUES=['light','dark','glass','auto','doraemon','shinchan','cartoon','fresh'];
var THEME_LABELS={light:'白天',dark:'黑夜',glass:'玻璃',auto:'自动',doraemon:'哆啦A梦',shinchan:'蜡笔小新',cartoon:'卡通乐园',fresh:'清新薄荷'};
var RESET_COOLDOWN_MS=300000;
function resolveTheme(t){
if(t!=='auto')return t;
var h=new Date().getHours();
return (h>=7&&h<19)?'light':'dark';
}
function applyTheme(theme){
if(THEME_VALUES.indexOf(theme)===-1)theme='light';
try{localStorage.setItem('theme',theme);}catch(e){}
document.documentElement.setAttribute('data-theme-stored',theme);
var actual=resolveTheme(theme);
document.documentElement.setAttribute('data-theme',actual);
try{window.MASCOT_POOLS=window.MASCOT_POOLS||{doraemon:['assets/theme/pool/doraemon-4.png','assets/theme/pool/doraemon-5.png'],shinchan:['assets/theme/pool/shinchan-2.png','assets/theme/pool/shinchan-3.png','assets/theme/pool/shinchan-4.png','assets/theme/pool/shinchan-5.png'],_picked:{}};var mp=window.MASCOT_POOLS;if(mp[actual]){if(!mp._picked[actual])mp._picked[actual]=mp[actual][Math.floor(Math.random()*mp[actual].length)];document.documentElement.style.setProperty('--mascot-'+actual,'url("'+mp._picked[actual]+'?v=2")');}}catch(e){}
var headerBtn=document.getElementById('headerThemeBtn');
if(headerBtn){var ic=actual==='dark'?'fa-sun':(actual==='glass'?'fa-gem':(actual==='fresh'?'fa-leaf':(actual==='doraemon'||actual==='shinchan'||actual==='cartoon'?'fa-face-smile':'fa-moon')));headerBtn.innerHTML='<i class="fas '+ic+'"></i>';}
var themeLabel=document.getElementById('themeLabel');
if(themeLabel){
themeLabel.textContent=THEME_LABELS[theme]||'白天';
var iconEl=themeLabel.parentElement&&themeLabel.parentElement.querySelector('i');
if(iconEl)iconEl.className=(actual==='dark'||theme==='auto')?'fas fa-sun':'fas fa-moon';
}
document.querySelectorAll('.theme-option').forEach(function(el){el.classList.toggle('active',el.getAttribute('data-theme-value')===theme);});
}
function openThemePicker(){
var modal=document.getElementById('themePickerModal');
if(!modal)return;
modal.classList.add('open');
var cur='';try{cur=localStorage.getItem('theme')||'light';}catch(e){cur='light';}
document.querySelectorAll('.theme-option').forEach(function(el){el.classList.toggle('active',el.getAttribute('data-theme-value')===cur);});
}
function closeThemePicker(){var modal=document.getElementById('themePickerModal');if(modal)modal.classList.remove('open');}
var _themeSwitching=false;
document.addEventListener('DOMContentLoaded',function(){
var modal=document.getElementById('themePickerModal');
if(modal){
modal.addEventListener('click',function(e){if(e.target===this)closeThemePicker();});
modal.querySelectorAll('.theme-option').forEach(function(el){
el.addEventListener('click',function(){
if(_themeSwitching)return;
var t=this.getAttribute('data-theme-value');
if(THEME_VALUES.indexOf(t)===-1)return;
var cur='';try{cur=localStorage.getItem('theme')||'light';}catch(e){}
if(t===cur){closeThemePicker();return;}
_themeSwitching=true;
applyTheme(t);
if(typeof toast==='function')toast('已切换到「'+(THEME_LABELS[t]||t)+'」主题','success');
setTimeout(function(){_themeSwitching=false;closeThemePicker();},260);
});
});
}
var closeBtn=document.getElementById('themePickerClose');
if(closeBtn)closeBtn.addEventListener('click',closeThemePicker);
});
setInterval(function(){
var cur='';try{cur=localStorage.getItem('theme')||'';}catch(e){}
if(cur==='auto'){
var actual=resolveTheme('auto');
if(document.documentElement.getAttribute('data-theme')!==actual)document.documentElement.setAttribute('data-theme',actual);

}
},300000);
var CACHE_KEY='lezhe_software_cache';
var cache={software:[],categories:[],loaded:false,lastFetch:0};
var _sensitiveWords=['暴力','色情','赌博','毒品','诈骗','传销','恐怖','反动','谣言','诽谤','侮辱','歧视','广告','推广','加微信','加QQ','联系方式'];
var _sensitiveWordsLoaded=false;
function loadSensitiveWords(){
if(_sensitiveWordsLoaded)return;
try{
var cached=localStorage.getItem('lezhe_sensitive_words');
if(cached){
var data=JSON.parse(cached);
if(data.words&&Array.isArray(data.words)&&data.expire>Date.now()){
_sensitiveWords=data.words;
_sensitiveWordsLoaded=true;
return;
}
}
}catch(e){console.warn('[敏感词] 加载失败',e);}
}
function saveSensitiveWords(){
try{
localStorage.setItem('lezhe_sensitive_words',JSON.stringify({words:_sensitiveWords,expire:Date.now()+7*24*3600*1000}));
}catch(e){console.warn('[敏感词] 保存失败',e);}
}
function filterSensitiveWords(text){
loadSensitiveWords();
if(!text)return text;
var filtered=text;
var mask='**';
_sensitiveWords.forEach(function(word){
var regex=new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi');
filtered=filtered.replace(regex,function(match){
return match.split('').map(function(){return mask;}).join('');
});
});
return filtered;
}
function containsSensitiveWords(text){
loadSensitiveWords();
if(!text)return false;
return _sensitiveWords.some(function(word){
return text.toLowerCase().indexOf(word.toLowerCase())!==-1;
});
}
function addSensitiveWord(word){
loadSensitiveWords();
if(_sensitiveWords.indexOf(word)===-1){
_sensitiveWords.push(word);
saveSensitiveWords();
}
}
function safeParse(str,fallback){try{var v=JSON.parse(str);return(v===null||v===undefined)?fallback:v;}catch(e){return fallback;}}
function safeArray(v){return Array.isArray(v)?v:[];}
function checkSupabase(silent){
if(IS_LOCAL_PREVIEW){if(!silent)toast('本地预览模式未连接云端服务；部署到正式域名后启用完整功能','warning');return false;}
initSupabase();if(!supabaseClient){if(!silent)toast('服务未加载，请刷新页面重试','error');return false;}return true;
}
function isToday(d){if(!d)return false;var t=new Date(d),n=new Date();return t.getFullYear()===n.getFullYear()&&t.getMonth()===n.getMonth()&&t.getDate()===n.getDate();}
function timeAgo(d){if(!d)return '刚刚';var n=new Date(),diff=Math.max(0,n-new Date(d)),m=Math.floor(diff/60000);if(m<1)return '刚刚';if(m<60)return m+'分钟前';var h=Math.floor(m/60);if(h<24)return h+'小时前';var days=Math.floor(h/24);if(days<7)return days+'天前';return new Date(d).toLocaleDateString('zh-CN');}
function saveCacheToStorage(){
try{localStorage.setItem(CACHE_KEY,JSON.stringify({software:cache.software,categories:cache.categories,timestamp:Date.now()}));return;}catch(e){}
try{
var light=cache.software.map(function(s){return{id:s.id,name:s.name,category:s.category,version:s.version,icon:s.icon,size:s.size,platforms:s.platforms,description:s.description,views:s.views,downloads:s.downloads,created_at:s.created_at,updated_at:s.updated_at};});
localStorage.setItem(CACHE_KEY,JSON.stringify({software:light,categories:cache.categories,timestamp:Date.now()}));
}catch(e2){}
}
function getCachedData(freshOnly){if(cache.loaded&&cache.software.length>0)return{software:cache.software,categories:cache.categories};var s=localStorage.getItem(CACHE_KEY);if(s){try{var d=JSON.parse(s);if(d&&Array.isArray(d.software)&&Array.isArray(d.categories)){if(freshOnly&&Date.now()-(d.timestamp||0)>=600000)return null;cache.software=d.software;cache.categories=d.categories;cache.loaded=true;cache.lastFetch=d.timestamp||0;return{software:cache.software,categories:cache.categories};}}catch(e){}}return null;}
/* ── 首屏数据：静态快照优先（2026-11-06） ────────────────────────────────────────
   改造前的加载链是四段串行：HTML(CDN 0.3s) → 解析 → init supabase-js → 经 CloudBase
   代理查 159 条（实测 TTFB 1.4s，偶发 Bad Gateway）。冷启动骨架屏 2.5s 主要耗在最后一段，
   而这一段是纯等待、无法与前一段并行。
   现在把同一批数据随站点生成成同源静态 JSON（seo/generate.mjs 产出 data/software.json），
   浏览器解析 HTML 时就能并行取到，实测首屏不再等代理。
   三级降级，任何一级挂了都不会白屏：
     ① data/software.json（同源同 CDN）           ← 新访客走这里
     ② Supabase REST（原路径）                    ← 快照没生成 / CDN 挡掉时兜底
     ③ localStorage 上次结果（10 分钟内）          ← 断网兜底
   快照与 REST 同为 select('*') 同字段，详情弹层不会缺字段。 */
var SNAP_URL='/data/software.json';
/* ── 后台即时可见（2026-11-06） ────────────────────────────────────────────────
   问题：后台点保存写的是 Supabase，线上列表读的是 CI 每 5 分钟重建的静态快照，
   一条改动最坏要等「cron 命中 + 生成 1~2 分钟 + Pages 构建」约 9 分钟才上线。
   做法：后台每次写库成功都给 localStorage 打一个 rev（毫秒时间戳），并广播给同源页面；
   前台发现 rev 比快照的 build 新，就改查 Supabase 实时数据，绕开整条 CI 链路。
   这一层只在「真改过数据」时生效：平时 rev 不动，首屏照旧走静态快照，速度不受影响；
   同一个 HTML 里 sessionStorage 记下已同步到哪个 rev，改完后第一次刷新走实时，
   之后回到快照快路径。 */
var REV_KEY='lezhe_data_rev';
var REV_SYNC_KEY='lezhe_data_rev_synced';
function getDataRev(){try{var v=parseInt(localStorage.getItem(REV_KEY),10);return isFinite(v)&&v>0?v:0;}catch(e){return 0;}}
function getRevSynced(){try{return parseInt(sessionStorage.getItem(REV_SYNC_KEY),10)||0;}catch(e){return 0;}}
function markRevSynced(v){try{sessionStorage.setItem(REV_SYNC_KEY,String(v));}catch(e){}}
/* rev 比 build 新即代表快照落后。上限 3 天：防 localStorage 里上古 rev（本机很久没动过后台）把访客永久锁在慢路径。
   2026-11-14 修复：窗口锚点从「rev-build」改为「now-rev」。build 是内容幂等字段（软件表内容不变就沿用旧值，
   可能停在很早的日期），用 rev-build 做窗口会在快照 build 距今超 3 天后，把后台每一次新保存都误判成
   「rev 太旧」而绕过实时接口——后台上传的新软件因此不上「今日上新」（2026-11-14 实测复现：
   build=11-06、rev=11-14，rev-build≈7.65 天 > 3 天）。改为锚定当前时间：3 天内改过后台且 rev>build 即走实时，
   防 ancient rev 的本意不变（now-rev 很大同样会被挡）。 */
function revIsNewer(rev,build){return !!(rev&&build&&rev>build&&Date.now()-rev<259200000);}
function normalizeSoft(s){
if(typeof s.screenshots==='string'){try{s.screenshots=JSON.parse(s.screenshots);}catch(e){s.screenshots=s.screenshots.split(',').map(function(x){return x.trim();}).filter(Boolean);}}
	s.screenshots=safeArray(s.screenshots);
if(!s.changelog)s.changelog='';
if(!s.requirements)s.requirements='';
if(typeof s.platforms==='string')s.platforms=s.platforms.split(',').map(function(p){return p.trim();}).filter(Boolean);
s.platforms=safeArray(s.platforms);
if(!s.name||s.name.trim()==='')s.name='未命名软件';
if(!s.description)s.description='';
if(!s.icon)s.icon='📦';
if(!s.version)s.version='1.0';
if(!s.category)s.category='未分类';
if(!s.size)s.size='—';
}
/* 归一化 + 落地到 cache 并持久化。快照与 REST 共用，保证两条路径的数据形状完全一致。 */
function commitSnapshot(d){
cache.software=Array.isArray(d.software)?d.software:[];
cache.software.forEach(normalizeSoft);
cache.categories=(Array.isArray(d.categories)&&d.categories.length)?d.categories.slice():['设计工具','开发工具','办公软件','媒体工具','实用工具'];
cache.loaded=true;
cache.lastFetch=Date.now();
window._lezheLoadFailed=false;
saveCacheToStorage();
}
/* 取静态快照。<head> 里的 window.__SNAP__ 只能消费一次，用掉即置空；
   之后再调用就重新 fetch（走 HTTP 缓存，代价很小）。 */
async function fetchSnapshot(){
try{
var p=window.__SNAP__;
if(p){
window.__SNAP__=null;/* <head> 里已发起的首个请求，直接用，最省时间 */
}else{
/* 后续（刷新按钮 / 5 分钟轮询 / 页面重新可见）用 no-cache：向 CDN 做条件请求，
   内容没变就是 304（几十字节），变了才回 200 全量 —— 既能拿到最新，又不会每 5 分钟拉 57KB。 */
p=fetch(SNAP_URL,{cache:'no-cache',priority:'high'});
}
var r=await p;
if(!r||!r.ok)return null;
var d=await r.json();
if(!d||!Array.isArray(d.software)||d.software.length===0)return null;
return d;
}catch(e){
console.warn('[DB] 静态快照不可用，回落 REST：',e&&e.message);
return null;
}
}
var DB={
_loadRetryCount:0,
_loadMaxRetries:5,
async waitForSupabase(){
var maxWait=20;
for(var i=0;i<maxWait;i++){
if(supabaseClient)return true;
initSupabase();
if(supabaseClient)return true;
await new Promise(function(r){setTimeout(r,500);});
}
return !!supabaseClient;
},
async loadAll(force){
force=force||false;
if(IS_LOCAL_PREVIEW){
var localCached=getCachedData();
window._lezheLoadFailed=false;
if(localCached)return localCached;
cache.categories=['设计工具','开发工具','办公软件','媒体工具','实用工具'];
cache.software=[];cache.loaded=true;cache.lastFetch=Date.now();
return{software:cache.software,categories:cache.categories};
}
/* 快照路径不需要 supabase 就能出首屏，但登录/收藏等功能依赖 client，这里先初始化 */
if(!supabaseClient)initSupabase();
if(cache.loaded&&!force&&(Date.now()-cache.lastFetch<600000))return{software:cache.software,categories:cache.categories};
/* ① 静态快照：随 HTML 并行取到（同源 CDN），通常 0.3s 级，不等代理 */
var snap=await fetchSnapshot();
if(snap){
/* 后台刚改过数据 → 快照是旧的 → 直接走实时库，保证「后台保存完，前台刷新就可见」 */
var _build=Number(snap.build)||0,_rev=getDataRev();
if(revIsNewer(_rev,_build)&&_rev>getRevSynced()){
console.info('[DB] 后台有更新（rev '+_rev+' > build '+_build+'），改取实时数据');
if(!supabaseClient){
await Promise.race([this.waitForSupabase(),new Promise(function(r){setTimeout(r,3000);})]);
}
try{
var fresh=await this.fetchFromRest();
markRevSynced(_rev);
console.info('[DB] 实时数据已就绪 '+fresh.software.length+' 条');
return fresh;
}catch(e){
console.warn('[DB] 实时数据取失败，先用静态快照顶住：',e&&e.message);
}
}
commitSnapshot(snap);
console.info('[DB] 首屏数据来自静态快照 '+cache.software.length+' 条');
/* 常规路径不再额外打 REST 对账：站内有个 5 分钟轮询器（_poll）会反复调 loadAll(true)，
   每次都补一发代理请求会白等 1.4s 且触发全量重渲。时效由快照的 no-cache 条件请求保证——
   快照由 CI 每 5 分钟重建，内容一变，条件请求立刻拿到 200 新版本。 */
return{software:cache.software,categories:cache.categories};
}
console.info('[DB] 静态快照不可用，改用 REST');
if(!supabaseClient){
var ready=await this.waitForSupabase();
if(!ready){
console.warn('[DB] Supabase 加载超时，使用缓存或默认数据');
var cachedReady=getCachedData();
if(cachedReady)return cachedReady;
window._lezheLoadFailed=true;
return{software:[],categories:['设计工具','开发工具','办公软件','媒体工具','实用工具']};
}
}
var lastErr=null;
for(var attempt=0;attempt<=this._loadMaxRetries;attempt++){
try{
return await this.fetchFromRest();
}catch(e){
lastErr=e;
console.error('[DB] 加载失败 (尝试 '+(attempt+1)+'/'+(this._loadMaxRetries+1)+'):',e);
if(attempt<this._loadMaxRetries){
await new Promise(function(r){setTimeout(r,1000*(attempt+1));});
continue;
}
}
}
console.error('[DB] 所有重试均失败:',lastErr);
if(cache.loaded&&cache.software.length>0)return{software:cache.software,categories:cache.categories};
var cached=getCachedData();
if(cached)return cached;
window._lezheLoadFailed=true;
return{software:[],categories:['设计工具','开发工具','办公软件','媒体工具','实用工具']};
},
/* REST 取数（② 路径）：两张表并发查，成功后统一走 commitSnapshot，形状与快照完全一致 */
async fetchFromRest(){
var[softRes,catRes]=await Promise.all([supabaseClient.from('software').select('*').order('created_at',{ascending:false}),supabaseClient.from('categories').select('name').order('name')]);
if(softRes.error)throw softRes.error;
if(catRes.error)throw catRes.error;
this._loadRetryCount=0;
commitSnapshot({software:Array.isArray(softRes.data)?softRes.data:[],categories:(catRes.data&&catRes.data.length)?catRes.data.map(function(item){return item.name;}):['设计工具','开发工具','办公软件','媒体工具','实用工具']});
return{software:cache.software,categories:cache.categories};
},
getSoftware:function(){return cache.software;},
getCategories:function(){return cache.categories;},
async updateSoftware(soft){
initSupabase();
if(!supabaseClient)return;
try{
await supabaseClient.from('software').update({views:soft.views,downloads:soft.downloads}).eq('id',soft.id);
var idx=cache.software.findIndex(function(s){return s.id===soft.id;});
if(idx!==-1){cache.software[idx].views=soft.views;cache.software[idx].downloads=soft.downloads;}
saveCacheToStorage();
}catch(e){console.error('更新失败:',e);}
}
};
/* 后台（admin.html）保存成功后广播 data-rev：已经开着的首页据此静默换数据，不必手动刷新。
   详情浮层打开时不打断，关掉后由 5 分钟轮询补齐。 */
function applyDataRevUpdate(){
if(document.querySelector('.detail-overlay.open'))return;
DB.loadAll(true).then(function(){
try{App.refreshAll();}catch(e){console.warn('[DB] 刷新视图失败：',e&&e.message);}
}).catch(function(){});
}
(function watchDataRev(){
if(window.__lezheRevWatch)return;window.__lezheRevWatch=true;
window.addEventListener('storage',function(e){if(e.key===REV_KEY)applyDataRevUpdate();});
try{
var bc=new BroadcastChannel('lezhe-sync');
bc.onmessage=function(e){if(e&&e.data&&e.data.type==='data-rev')applyDataRevUpdate();};
}catch(e){}
})();
function lezheRetryLoad(){
toast('正在重新加载数据...','success');
DB.loadAll(true).then(function(){window._lezheLoadFailed=false;App.refreshAll();toast('加载完成','success');}).catch(function(){toast('加载失败，请稍后再试','error');});
}
window.addEventListener('supabase:ready',function(){
if(!cache.loaded||window._lezheLoadFailed){
DB.loadAll(true).then(function(){window._lezheLoadFailed=false;App.refreshAll();}).catch(function(){});
}
});
function toast(msg,type){
type=type||'success';
var c=document.getElementById('toastContainer');
var _ex=c.querySelectorAll('.toast');
if(_ex.length>=3){var _oldest=_ex[0];if(_oldest.parentNode){_oldest.style.animation='toastOut 0.3s ease forwards';setTimeout(function(){if(_oldest.parentNode)_oldest.parentNode.removeChild(_oldest);},400);}}
var el=document.createElement('div');
el.className='toast '+type;
el.innerHTML='<span class="icon">'+(type==='success'?'◆':(type==='error'?'✕':'⚠'))+'</span> '+escapeHTML(msg)+'<span class="toast-close">✕</span>';
c.appendChild(el);
el.querySelector('.toast-close').addEventListener('click',function(e){e.stopPropagation();var self=this.parentNode;if(self&&self.parentNode){self.style.animation='toastOut 0.3s ease forwards';setTimeout(function(){if(self.parentNode)self.parentNode.removeChild(self);},400);}});
el.addEventListener('click',function(e){if(e.target.classList.contains('toast-close'))return;var self=this;self.style.animation='toastOut 0.3s ease forwards';setTimeout(function(){if(self.parentNode)self.parentNode.removeChild(self);},400);});
setTimeout(function(){if(el.parentNode){el.style.animation='toastOut 0.4s ease forwards';setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el);},500);}},3500);
}
function escapeHTML(str){if(str===null||str===undefined)return '';return sanitizeUnicode(String(str)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function escapeAttr(str){if(str===null||str===undefined)return '';return sanitizeUnicode(String(str)).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function sanitizeUnicode(s){
if(!s)return '';
var t=String(s);
t=t.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g,'');
t=t.replace(/(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g,'$1');
t=t.replace(/[\uFFFD\u0080-\u009F]/g,'');
t=t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'');
return t;
}
function isSafeHttpUrl(v){
if(!v||typeof v!=='string')return false;
try{var u=new URL(v,window.location.href);return u.protocol==='http:'||u.protocol==='https:';}catch(e){return false;}
}
function isImageUrl(v){
if(!v||typeof v!=='string')return false;
var s=v.trim();
if(!s)return false;
if(/^https?:\/\//i.test(s))return true;
if(/^\/\//.test(s))return true;
if(/^data:image\//i.test(s))return true;
if(/^\.?\/[^\s]+\.(png|jpe?g|gif|webp|svg|bmp|avif|ico)(\?[^\s]*)?$/i.test(s))return true;
return false;
}
window.liquidConfirm=function(options){
return new Promise(function(resolve){
options=options||{};
var type=options.type||'danger';
var title=options.title||'确定操作？';
var desc=options.desc||'';
var confirmText=options.confirmText||'确认';
var cancelText=options.cancelText||'取消';
var confirmIcon=options.confirmIcon||'';
var iconMap={danger:'fa-exclamation-triangle',warning:'fa-exclamation-circle',info:'fa-question-circle',success:'fa-check-circle'};
var icon=options.icon||iconMap[type]||iconMap.danger;
var overlay=document.createElement('div');
overlay.className='liquid-overlay';
overlay.innerHTML='<div class="liquid-modal" data-type="'+type+'"><div class="liquid-orb liquid-orb-1"></div><div class="liquid-orb liquid-orb-2"></div><div class="liquid-content"><div class="liquid-icon"><i class="fas '+icon+'"></i></div><h3 class="liquid-title">'+escapeHTML(title)+'</h3>'+(desc?'<p class="liquid-desc">'+escapeHTML(desc)+'</p>':'<div style="margin-bottom:24px;"></div>')+'<div class="liquid-actions"><button class="liquid-btn liquid-btn-cancel" type="button">'+escapeHTML(cancelText)+'</button><button class="liquid-btn liquid-btn-confirm" type="button">'+(confirmIcon?'<i class="fas '+confirmIcon+'"></i> ':'')+escapeHTML(confirmText)+'</button></div></div></div>';
document.body.appendChild(overlay);
requestAnimationFrame(function(){overlay.classList.add('open');});
var cancelBtn=overlay.querySelector('.liquid-btn-cancel');
var confirmBtn=overlay.querySelector('.liquid-btn-confirm');
var done=false;
var onKey=function(e){if(e.key==='Escape')finish(false);};
function finish(result){
if(done)return;
done=true;
document.removeEventListener('keydown',onKey);
overlay.classList.remove('open');
setTimeout(function(){if(overlay.parentNode)overlay.parentNode.removeChild(overlay);resolve(result);},350);
}
cancelBtn.addEventListener('click',function(){finish(false);});
confirmBtn.addEventListener('click',function(){finish(true);});
overlay.addEventListener('click',function(e){if(e.target===overlay)finish(false);});
document.addEventListener('keydown',onKey);
});
};
function highlightText(text,keyword){
if(!keyword)return escapeHTML(text);
var escaped=escapeHTML(text);
var kw=escapeHTML(keyword);
var safe=kw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
try{return escaped.replace(new RegExp(safe,'gi'),function(m){return '<mark>'+m+'</mark>';});}catch(e){return escaped;}
}
function sanitizeHTML(html){if(!html)return '';html=sanitizeUnicode(html);if(typeof DOMPurify!=='undefined'&&DOMPurify.sanitize){try{return sanitizeUnicode(DOMPurify.sanitize(html,{FORBID_TAGS:['script','style','object','embed','form'],ADD_TAGS:['iframe'],ADD_ATTR:['allowfullscreen','frameborder','allow'],ALLOWED_URI_REGEXP:/^(?:(?:https?):\/\/(?:www\.)?(?:youtube\.com|youtu\.be|bilibili\.com|player\.bilibili\.com)\/|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i}));}catch(e){console.warn('DOMPurify 失败',e);return escapeHTML(html);}}return escapeHTML(html);}
function getIconEmoji(cat){var map={'设计工具':'✎','开发工具':'⚙','办公软件':'📋','媒体工具':'🎬','实用工具':'🔧'};return map[cat]||'📦';}
function renderIcon(soft){var fallback=soft.icon||'📦';if(soft.icon_url&&soft.icon_url.trim()){return '<img src="'+escapeAttr(soft.icon_url)+'" alt="'+escapeAttr(soft.name)+'" width="48" height="48" loading="lazy" decoding="async" data-fallback="'+escapeAttr(fallback)+'" onerror="this.style.display=\'none\';this.parentElement.textContent=this.dataset.fallback;">';}return escapeHTML(fallback);}
function renderPlatformBadges(soft){var html='';var p=soft.platforms||[];if(p.includes('mac'))html+='<span class="badge badge-mac"><i class="fab fa-apple"></i> Mac</span>';if(p.includes('windows'))html+='<span class="badge badge-windows"><i class="fab fa-windows"></i> Windows</span>';if(p.includes('android'))html+='<span class="badge badge-android"><i class="fab fa-android"></i> Android</span>';return html;}
function isFavorited(id){var favs=safeParse(localStorage.getItem('lezhe_favorites'),[]);return favs.includes(id);}
function toggleFavorite(id){var favs=safeParse(localStorage.getItem('lezhe_favorites'),[]);var idx=favs.indexOf(id);if(idx>-1)favs.splice(idx,1);else favs.push(id);localStorage.setItem('lezhe_favorites',JSON.stringify(favs));return favs.includes(id);}
var searchHistory=safeParse(localStorage.getItem('lezhe_search_history'),[]);
function addSearchHistory(kw){if(!kw)return;searchHistory=[kw,...searchHistory.filter(function(h){return h!==kw;})].slice(0,10);localStorage.setItem('lezhe_search_history',JSON.stringify(searchHistory));}
var searchDebounceTimer=null;
function requireAuth(){if(!currentUser){toast('请先登录','warning');document.getElementById('loginModal').classList.add('open');return false;}return true;}
function closeSearchSuggestions(){var sug=document.getElementById('searchSuggestions');var hist=document.getElementById('searchHistory');if(sug){sug.classList.remove('open');sug.innerHTML='';}if(hist){hist.classList.remove('open');hist.innerHTML='';}clearTimeout(searchDebounceTimer);}
function openDonateModal(){var modal=document.getElementById('donateModal');if(modal){modal.querySelectorAll('img[data-src]').forEach(function(im){if(!im.getAttribute('src'))im.src=im.getAttribute('data-src');});modal.classList.add('open');}}
function closeDonateModal(){var modal=document.getElementById('donateModal');if(modal){modal.classList.remove('open');}}
function copyTextToClipboard(text){
return new Promise(function(resolve){
if(navigator.clipboard&&navigator.clipboard.writeText){
navigator.clipboard.writeText(text).then(function(){resolve(true);}).catch(function(){resolve(fallbackCopy(text));});
}else{resolve(fallbackCopy(text));}
});
}
function fallbackCopy(text){
try{
var input=document.createElement('textarea');
input.value=text;
input.style.position='fixed';
input.style.opacity='0';
document.body.appendChild(input);
input.select();
var ok=document.execCommand('copy');
document.body.removeChild(input);
return ok;
}catch(e){return false;}
}
function showSuggestions(keyword){
clearTimeout(searchDebounceTimer);
var sug=document.getElementById('searchSuggestions');
var hist=document.getElementById('searchHistory');
sug.innerHTML='';sug.classList.remove('open');hist.innerHTML='';hist.classList.remove('open');
if(!keyword&&searchHistory.length>0){
hist.innerHTML='<div class="history-header">最近搜索 <span class="remove-history" id="clearAllHistory" style="float:right;color:var(--danger);cursor:pointer;font-weight:normal;">清空全部</span></div>'+searchHistory.map(function(h){return '<div class="item" data-kw="'+escapeAttr(h)+'">'+escapeHTML(h)+'<span class="remove-history" data-kw="'+escapeAttr(h)+'">✕</span></div>';}).join('');
hist.classList.add('open');
var clearAll=document.getElementById('clearAllHistory');
if(clearAll)clearAll.addEventListener('click',function(e){e.stopPropagation();searchHistory=[];localStorage.setItem('lezhe_search_history',JSON.stringify(searchHistory));showSuggestions('');toast('搜索历史已清空','success');});
hist.querySelectorAll('.item').forEach(function(el){
el.addEventListener('click',function(e){
if(e.target.classList.contains('remove-history')){
e.stopPropagation();
var kw=e.target.dataset.kw;
searchHistory=searchHistory.filter(function(h){return h!==kw;});
localStorage.setItem('lezhe_search_history',JSON.stringify(searchHistory));
showSuggestions('');
return;
}
var kw=this.dataset.kw;
document.getElementById('searchInput').value=kw;
closeSearchSuggestions();
App.doSearch(kw);
hist.classList.remove('open');
});
});
}else if(keyword){
searchDebounceTimer=setTimeout(function(){
var kw=keyword.toLowerCase();
var matches=cache.software.filter(function(s){if(!s.name)return false;return s.name.toLowerCase().includes(kw);}).slice(0,8);
if(matches.length){
sug.innerHTML=matches.map(function(s){var name=s.name||'未命名';return '<div class="item" data-name="'+escapeAttr(name)+'">'+renderIcon(s)+' '+escapeHTML(name)+'</div>';}).join('');
sug.classList.add('open');
sug.querySelectorAll('.item').forEach(function(el){
el.addEventListener('click',function(){
var name=this.dataset.name;
document.getElementById('searchInput').value=name;
closeSearchSuggestions();
App.doSearch(name);
sug.classList.remove('open');
});
});
}
},200);
}
}
var currentView='grid';
function applyViewMode(){var grid=document.getElementById('listGrid');if(!grid)return;grid.querySelectorAll('.software-card').forEach(function(card){if(currentView==='list')card.classList.add('list-mode');else card.classList.remove('list-mode');});}
var viewToggleEl=document.getElementById('viewToggle');
if(viewToggleEl){viewToggleEl.addEventListener('click',function(e){var btn=e.target.closest('button');if(!btn)return;if(btn.classList.contains('active'))return;currentView=btn.dataset.view;this.querySelectorAll('button').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');applyViewMode();});}
var GROUP_CONFIG={groups:[{id:'creative',name:'创意设计',icon:'🎨',cats:['设计工具','媒体工具']},{id:'dev',name:'开发编程',icon:'💻',cats:['开发工具']},{id:'office',name:'办公效率',icon:'📋',cats:['办公软件','实用工具']}],fallbackGroup:{id:'other',name:'其他分类',icon:'📁',cats:[]}};
function getGroupStates(){try{var raw=localStorage.getItem('lezhe_group_states');if(raw)return JSON.parse(raw);}catch(e){}return{};}
function saveGroupStates(states){try{localStorage.setItem('lezhe_group_states',JSON.stringify(states));}catch(e){}}
function toggleGroup(groupId){var states=getGroupStates();states[groupId]=!states[groupId];saveGroupStates(states);Render.renderCategories(document.getElementById('categoryList'),App.currentCategory==='all'?null:App.currentCategory,function(cat){App.goList(cat);});}
function scrollToActiveItem(){var container=document.getElementById('categoryList');if(!container)return;var active=container.querySelector('.category-item-side.active, .category-item-all.active');if(active){requestAnimationFrame(function(){active.scrollIntoView({block:'nearest',behavior:'smooth'});});}}
function markSoftSeen(id){try{var map=safeParse(localStorage.getItem('lezhe_seen_map'),{});map[id]=Date.now();var keys=Object.keys(map);if(keys.length>200){keys.sort(function(a,b){return map[a]-map[b];});keys.slice(0,keys.length-200).forEach(function(k){delete map[k];});}localStorage.setItem('lezhe_seen_map',JSON.stringify(map));}catch(e){}}
function isSoftUpdated(s){if(!s.updated_at)return false;var map=safeParse(localStorage.getItem('lezhe_seen_map'),{});var seen=map[s.id]||0;return new Date(s.updated_at).getTime()>seen;}
var Render={
renderSkeleton:function(container,count){
count=count||6;
if(!container)return;
var html='';
for(var i=0;i<count;i++){html+='<div class="skeleton-card"><div class="skeleton-line w40"></div><div class="skeleton-line w90"></div><div class="skeleton-line w70"></div></div>';}
container.innerHTML=html;
},
renderAnnouncements:function(container){
if(!container)return;
var quotes=["生活就像一盒巧克力，你永远不知道下一颗是什么味道。","不积跬步，无以至千里。","梦想还是要有的，万一实现了呢。","世界那么大，我想去看看。","人生没有白走的路，每一步都算数。"];
var quote=quotes[Math.floor(Math.random()*quotes.length)];
var now=new Date();
var dateStr=(now.getMonth()+1)+'/'+now.getDate();
container.innerHTML='<div class="announcement-item"><span class="dot">◆</span><span class="time">'+dateStr+'</span><span class="text">🌸 '+quote+'</span><span class="badge-new">今日</span></div>';
},
renderTodayNew:function(container){
if(!container)return;
var all=DB.getSoftware();
var todayItems=all.filter(function(s){return isToday(s.created_at);});
var countEl=document.getElementById('todayCount');
if(countEl){countEl.textContent='今日 '+todayItems.length+' 款新软件';}
if(todayItems.length===0){container.innerHTML='<div class="stack-empty"><span class="empty-icon">📭</span><span class="empty-text">今日暂无新软件上架</span></div>';return;}
todayItems.sort(function(a,b){return new Date(b.created_at)-new Date(a.created_at);});
var stackHTML='<div class="stack-wrapper"><div class="stack-container" id="stackContainer">';
for(var i=0;i<todayItems.length;i++){
var s=todayItems[i];
var displayName=s.name||'未命名软件';
var cat=s.category||'未分类';
var time=timeAgo(s.created_at);
var iconHtml=renderIcon(s);
var platforms=s.platforms||[];
var platHtml='';
if(platforms.includes('mac'))platHtml+='<span class="badge badge-mac"><i class="fab fa-apple"></i> Mac</span>';
if(platforms.includes('windows'))platHtml+='<span class="badge badge-windows"><i class="fab fa-windows"></i> Windows</span>';
if(platforms.includes('android'))platHtml+='<span class="badge badge-android"><i class="fab fa-android"></i> Android</span>';
if(!(platHtml))platHtml='<span class="badge" style="opacity:0.4;">—</span>';
var descText=sanitizeUnicode(s.description||'');
var sizeText=s.size||'—';
var views=s.views||0;
var downloads=s.downloads||0;
var cardClass='stack-card';
if(i===0)cardClass+=' card-current';
else if(i===1)cardClass+=' card-next';
else if(i===2)cardClass+=' card-next2';
else if(i===3)cardClass+=' card-next3';
else if(i===4)cardClass+=' card-next4';
else cardClass+=' card-hidden';
stackHTML+='<div class="'+cardClass+'" data-index="'+i+'" data-id="'+escapeAttr(s.id)+'"><span class="new-badge">✦ NEW</span><span class="card-index-badge">'+(i+1)+' / '+todayItems.length+'</span><div class="card-top-row"><div class="card-icon">'+iconHtml+'</div><div class="card-title"><div class="name">'+escapeHTML(displayName)+'</div><div class="meta"><span class="cat-tag">'+escapeHTML(cat)+'</span><span class="version">v'+escapeHTML(s.version||'1.0')+'</span><span class="size">'+escapeHTML(sizeText)+'</span></div></div></div><div class="card-desc">'+escapeHTML(descText)+'</div><div class="card-footer-row"><div class="badge-platforms">'+platHtml+'</div><div class="stats-info"><span><i class="far fa-eye"></i> '+(parseInt(views,10)||0)+'</span><span><i class="fas fa-download"></i> '+(parseInt(downloads,10)||0)+'</span></div><span class="time-ago"><i class="far fa-clock"></i> '+time+'</span></div></div>';
}
stackHTML+='</div></div><div class="stack-controls" id="stackControls"><button class="ctrl-btn" id="stackPrev" aria-label="上一张"><span class="icon">‹</span></button><div class="stack-dots" id="stackDots"></div><span class="stack-counter" id="stackCounter">1 / '+todayItems.length+'</span><button class="ctrl-btn" id="stackNext" aria-label="下一张"><span class="icon">›</span></button></div>';
container.innerHTML=stackHTML;
var stackContainer=document.getElementById('stackContainer');
var cards=stackContainer.querySelectorAll('.stack-card');
var total=cards.length;
var current=0;
var isAnimating=false;
function updateStack(newIndex,direction){
if(isAnimating)return;
if(newIndex<0||newIndex>=total)return;
isAnimating=true;
current=newIndex;
var prevIndex=(current>0)?current-1:-1;
var nextIndex=(current<total-1)?current+1:-1;
var next2Index=(nextIndex!==-1&&nextIndex<total-1)?nextIndex+1:-1;
var next3Index=(next2Index!==-1&&next2Index<total-1)?next2Index+1:-1;
var next4Index=(next3Index!==-1&&next3Index<total-1)?next3Index+1:-1;
cards.forEach(function(card,idx){
card.classList.remove('card-current','card-next','card-next2','card-next3','card-next4','card-prev','card-hidden');
if(idx===current){card.classList.add('card-current');}
else if(idx===nextIndex){card.classList.add('card-next');}
else if(idx===next2Index){card.classList.add('card-next2');}
else if(idx===next3Index){card.classList.add('card-next3');}
else if(idx===next4Index){card.classList.add('card-next4');}
else if(idx===prevIndex&&direction===-1){card.classList.add('card-prev');}
else{card.classList.add('card-hidden');}
});
updateDotsAndCounter();
setTimeout(function(){isAnimating=false;},550);
}
function updateDotsAndCounter(){
var dotsContainer=document.getElementById('stackDots');
if(dotsContainer){
var dotsHTML='';
for(var i=0;i<total;i++){dotsHTML+='<span class="dot'+(i===current?' active':'')+'"></span>';}
dotsContainer.innerHTML=dotsHTML;
dotsContainer.querySelectorAll('.dot').forEach(function(dot,idx){
dot.addEventListener('click',function(){if(idx!==current){var dir=idx>current?1:-1;updateStack(idx,dir);}});
});
}
var counter=document.getElementById('stackCounter');
if(counter)counter.textContent=(current+1)+' / '+total;
var prevBtn=document.getElementById('stackPrev');
var nextBtn=document.getElementById('stackNext');
if(prevBtn)prevBtn.disabled=(current===0);
if(nextBtn)nextBtn.disabled=(current===total-1);
}
var prevBtn=document.getElementById('stackPrev');
var nextBtn=document.getElementById('stackNext');
if(prevBtn)prevBtn.addEventListener('click',function(){if(current>0)updateStack(current-1,-1);});
if(nextBtn)nextBtn.addEventListener('click',function(){if(current<total-1)updateStack(current+1,1);});
var touchStartY=0,touchStartTime=0,touchStartX=0;
stackContainer.addEventListener('touchstart',function(e){touchStartY=e.touches[0].clientY;touchStartX=e.touches[0].clientX;touchStartTime=Date.now();},{passive:true});
stackContainer.addEventListener('touchend',function(e){
var touchEndY=e.changedTouches[0].clientY;
var touchEndX=e.changedTouches[0].clientX;
var deltaY=touchStartY-touchEndY;
var deltaX=touchStartX-touchEndX;
var deltaTime=Date.now()-touchStartTime;
if(Math.abs(deltaY)>Math.abs(deltaX)*1.5&&Math.abs(deltaY)>35&&deltaTime<500){
if(deltaY>0&&current<total-1){updateStack(current+1,1);}
else if(deltaY<0&&current>0){updateStack(current-1,-1);}
}
},{passive:true});
updateDotsAndCounter();
cards.forEach(function(card){
card.addEventListener('click',function(){
var id=this.dataset.id;
if(id){
var soft=DB.getSoftware().find(function(s){return s.id===id;});
if(soft){App._scrollPos=window.scrollY;Detail.open(soft);}
}
});
});
},
renderCategories:function(container,active,onClick){
if(!container)return;
var all=DB.getSoftware();
var categories=DB.getCategories();
var countMap={};
all.forEach(function(s){var cat=s.category||'未分类';countMap[cat]=(countMap[cat]||0)+1;});
var groupMap={};
GROUP_CONFIG.groups.forEach(function(g){g.cats.forEach(function(c){groupMap[c]=g.id;});});
var grouped={};
GROUP_CONFIG.groups.forEach(function(g){grouped[g.id]={group:g,items:[]};});
var fallbackItems=[];
categories.forEach(function(cat){
var gid=groupMap[cat];
if(gid&&grouped[gid]){grouped[gid].items.push(cat);}
else{fallbackItems.push(cat);}
});
if(fallbackItems.length){
var fg=GROUP_CONFIG.fallbackGroup;
grouped[fg.id]={group:fg,items:fallbackItems};
}
var states=getGroupStates();
var totalCount=all.length;
var html='';
var isAllActive=(active===null||active==='all'||active===undefined);
html+='<div class="category-item-all '+(isAllActive?'active':'')+'" data-cat="all"><span class="icon">◇</span><span class="name">全部</span><span class="count">'+totalCount+'</span></div>';
var groupOrder=GROUP_CONFIG.groups.map(function(g){return g.id;});
if(fallbackItems.length)groupOrder.push(GROUP_CONFIG.fallbackGroup.id);
groupOrder.forEach(function(gid){
var entry=grouped[gid];
if(!entry||entry.items.length===0)return;
var g=entry.group;
var isOpen=states[gid]===true;
var icon=g.icon||'📁';
html+='<div class="category-group">';
html+='<div class="group-header" data-group="'+escapeAttr(gid)+'"><span class="group-icon">'+icon+'</span><span class="group-name">'+escapeHTML(g.name)+'</span><span class="group-badge">'+entry.items.length+'</span><span class="toggle-icon '+(isOpen?'open':'')+'">▶</span></div>';
html+='<div class="group-items '+(isOpen?'open':'')+'">';
entry.items.forEach(function(cat){
var count=countMap[cat]||0;
var isActive=(active===cat);
var emoji=getIconEmoji(cat);
html+='<div class="category-item-side '+(isActive?'active':'')+'" data-cat="'+escapeAttr(cat)+'"><span class="icon">'+emoji+'</span><span class="name">'+escapeHTML(cat)+'</span><span class="count">'+count+'</span></div>';
});
html+='</div></div>';
});
container.innerHTML=html;
var allEl=container.querySelector('.category-item-all');
if(allEl){allEl.addEventListener('click',function(){if(onClick)onClick('all');});}
container.querySelectorAll('.group-header').forEach(function(header){
header.addEventListener('click',function(e){e.stopPropagation();var gid=this.dataset.group;if(gid)toggleGroup(gid);});
});
container.querySelectorAll('.category-item-side').forEach(function(el){
el.addEventListener('click',function(e){e.stopPropagation();var cat=this.dataset.cat;if(cat&&onClick){onClick(cat);}});
});
var totalEl=document.getElementById('sidebarTotalCount');
if(totalEl)totalEl.textContent='共 '+totalCount+' 款软件';
scrollToActiveItem();
if(active&&active!=='all'){
var target=null;
container.querySelectorAll('.category-item-side').forEach(function(el){if(el.dataset.cat===active)target=el;});
if(target){
var group=target.closest('.category-group');
if(group){
var header=group.querySelector('.group-header');
var items=group.querySelector('.group-items');
if(header&&items){
var gid=header.dataset.group;
var states2=getGroupStates();
if(!states2[gid]){states2[gid]=true;saveGroupStates(states2);items.classList.add('open');var icon=header.querySelector('.toggle-icon');if(icon)icon.classList.add('open');}
}
}
target.classList.add('active');
requestAnimationFrame(function(){target.scrollIntoView({block:'nearest',behavior:'smooth'});});
}
}
},
renderCards:function(container,list,showCategory,keyword){
showCategory=showCategory!==false;
if(!container)return;
if(!list||list.length===0){
if(window._lezheLoadFailed){
container.innerHTML='<div class="empty-state"><div class="icon">⚠</div><h3>网络加载失败</h3><p>数据未能从服务器加载，请检查网络后重试</p><button class="btn btn-sm btn-primary lezhe-retry-btn">重新加载</button></div>';
container.querySelectorAll('.lezhe-retry-btn').forEach(function(b){b.addEventListener('click',function(){lezheRetryLoad();});});
return;
}
container.innerHTML='<div class="empty-state"><div class="icon">◆</div><h3>暂无软件</h3><p>换个筛选条件试试</p>'+(keyword?'<button class="btn btn-sm btn-outline" id="clearSearchBtn">清空搜索</button>':'')+'</div>';
var clearBtn=container.querySelector('#clearSearchBtn');
if(clearBtn){clearBtn.addEventListener('click',function(){document.getElementById('searchInput').value='';document.getElementById('sidebarSearchInput').value='';App.goHome();});}
return;
}
var html='';
for(var s of list){
var rawName=(s.name&&s.name.trim())?sanitizeUnicode(s.name):'未命名软件';
var displayName=keyword?highlightText(rawName,keyword):escapeHTML(rawName);
var fav=isFavorited(s.id)?'active':'';
var listMode=currentView==='list'?' list-mode':'';
var desc=(sanitizeUnicode(s.description||'')).trim();
var updBadge=isSoftUpdated(s)?'<span class="new-badge" style="position:absolute;top:8px;left:8px;font-size:.45rem;font-weight:700;color:#fff;background:var(--accent-gradient);padding:0 9px;border-radius:20px;line-height:1.7;">🆕 更新</span>':'';
html+='<div class="software-card'+listMode+'" data-id="'+escapeAttr(s.id)+'" tabindex="0" role="button" aria-label="查看 '+escapeAttr(rawName)+' 详情">'+updBadge+
'<button class="favorite-btn '+fav+'" data-id="'+escapeAttr(s.id)+'" aria-label="收藏"><i class="fas fa-heart"></i></button>'+
'<div class="card-head">'+
'<div class="card-icon">'+renderIcon(s)+'</div>'+
'<div class="card-title">'+
'<h3 class="card-name" title="'+escapeAttr(rawName)+'">'+displayName+'</h3>'+
'<div class="card-sub">'+
(showCategory?'<span class="cat">'+escapeHTML(s.category||'未分类')+'</span>':'')+
'<span class="ver">v'+escapeHTML(s.version||'1.0')+'</span>'+
(s.size?'<span class="size">'+escapeHTML(s.size)+'</span>':'')+
'</div>'+
'</div>'+
'</div>'+
'<p class="card-desc">'+escapeHTML(desc)+'</p>'+
'<div class="card-foot">'+
'<div class="plat-list">'+renderPlatformBadges(s)+'</div>'+
'<div class="stats"><span><i class="far fa-eye"></i>'+(parseInt(s.views,10)||0)+'</span><span><i class="fas fa-download"></i>'+(parseInt(s.downloads,10)||0)+'</span></div>'+
'</div>'+
'</div>';
}
container.innerHTML=html;
attachCompareButtons();
container.querySelectorAll('.favorite-btn').forEach(function(btn){
btn.addEventListener('click',function(e){
e.stopPropagation();
var id=this.dataset.id;
var nowFav=toggleFavorite(id);
if(nowFav){this.classList.add('active');toast('已收藏','success');}
else{this.classList.remove('active');toast('已取消收藏','warning');}
var detailFav=document.getElementById('detailFavBtn');
if(detailFav&&Detail._currentSoft&&Detail._currentSoft.id===id){
detailFav.classList.toggle('active',nowFav);
detailFav.innerHTML=nowFav?'<i class="fas fa-heart"></i> 已收藏':'<i class="far fa-heart"></i> 收藏';
}
});
});
}
};
var viewHistory=safeParse(localStorage.getItem('lezhe_view_history'),[]);
function addViewHistory(softwareId){viewHistory=[softwareId,...viewHistory.filter(function(id){return id!==softwareId;})].slice(0,6);localStorage.setItem('lezhe_view_history',JSON.stringify(viewHistory));}
function renderRecentHistory(){
var container=document.getElementById('profileRecentGrid');
var section=document.getElementById('profileRecentSection');
if(!container||!section)return;
var historyIds=safeParse(localStorage.getItem('lezhe_view_history'),[]);
if(historyIds.length===0){section.classList.add('hidden');return;}
var recentSoftware=historyIds.map(function(id){return cache.software.find(function(s){return s.id===id;});}).filter(Boolean);
if(recentSoftware.length===0){section.classList.add('hidden');return;}
section.classList.remove('hidden');
var h='';
for(var i=0;i<recentSoftware.length;i++){
var s=recentSoftware[i];
var name=escapeHTML(s.name||'未命名');
var iconHtml=renderIcon(s);
var platText=(s.platforms||[]).map(function(p){return p==='mac'?'Mac':p==='windows'?'Win':p==='android'?'Android':p;}).join(' · ')||'—';
h+='<a class="profile-mini-card" data-id="'+escapeAttr(s.id)+'"><div class="mini-icon">'+iconHtml+'</div><div class="mini-info"><div class="mini-name">'+name+'</div><div class="mini-meta">v'+escapeHTML(s.version||'1.0')+' · '+escapeHTML(platText)+'</div></div></a>';
}
container.innerHTML=h;
container.querySelectorAll('.profile-mini-card').forEach(function(el){
el.addEventListener('click',function(e){
e.preventDefault();
var id=this.dataset.id;
var soft=cache.software.find(function(s){return s.id===id;});
if(soft){App.goHome();setTimeout(function(){Detail.open(soft);},200);}
});
});
}
var Detail={
_keyHandler:null,
_currentSoft:null,
_pushed:false,
_viewedThisSession:{},
open:function(soft,noHist){
if(window.scrollY>0)App._scrollPos=window.scrollY;
addViewHistory(soft.id);
markSoftSeen(soft.id);
if(!this._viewedThisSession[soft.id]){
this._viewedThisSession[soft.id]=true;
soft.views=(soft.views||0)+1;
DB.updateSoftware(soft).catch(function(e){});
}
this._currentSoft=soft;
this._updateSEO(soft);
try{if(window.DetailMotion){window.DetailMotion.reset();window.DetailMotion.play();}}catch(e){}
var overlay=document.getElementById('detailOverlay');
document.getElementById('detailBreadCat').textContent=sanitizeUnicode(soft.category||'软件库');
document.getElementById('detailName').textContent=sanitizeUnicode(soft.name||'未命名');
document.getElementById('detailAuthorCat').textContent='📂 '+sanitizeUnicode(soft.category||'软件库');
document.getElementById('detailAuthorViews').textContent='👁 '+(soft.views||0);
document.getElementById('detailAuthorDate').textContent='📅 '+sanitizeUnicode(soft.date||'近日');
var tagsEl=document.getElementById('detailTags');
var tagsHtml='';
if(soft.category)tagsHtml+='<span class="detail-tag">'+escapeHTML(soft.category)+'</span>';
if(soft.version)tagsHtml+='<span class="detail-tag">v'+escapeHTML(soft.version)+'</span>';
if(soft.size)tagsHtml+='<span class="detail-tag">'+escapeHTML(soft.size)+'</span>';
if(soft.platforms&&soft.platforms.length){
soft.platforms.forEach(function(p){tagsHtml+='<span class="detail-tag">'+(p==='mac'?'Mac':p==='windows'?'Windows':p==='android'?'Android':escapeHTML(p))+'</span>';});
}
tagsEl.innerHTML=tagsHtml;
var infoGrid=document.getElementById('detailInfoGrid');
var infoHtml='';
infoHtml+='<div class="detail-info-item"><div class="detail-info-label">版本</div><div class="detail-info-value">v'+escapeHTML(soft.version||'1.0')+'</div></div>';
infoHtml+='<div class="detail-info-item"><div class="detail-info-label">大小</div><div class="detail-info-value">'+escapeHTML(soft.size||'未知')+'</div></div>';
infoHtml+='<div class="detail-info-item"><div class="detail-info-label">分类</div><div class="detail-info-value">'+escapeHTML(soft.category||'软件')+'</div></div>';
infoHtml+='<div class="detail-info-item"><div class="detail-info-label">更新日期</div><div class="detail-info-value">'+escapeHTML(soft.date||'近日')+'</div></div>';
if(soft.platforms&&soft.platforms.length){
var platNames=soft.platforms.map(function(p){return p==='mac'?'Mac':p==='windows'?'Windows':p==='android'?'Android':p;}).join(' / ');
infoHtml+='<div class="detail-info-item"><div class="detail-info-label">支持平台</div><div class="detail-info-value">'+escapeHTML(platNames)+'</div></div>';
}
infoHtml+='<div class="detail-info-item"><div class="detail-info-label">授权类型</div><div class="detail-info-value">'+(soft.is_vip_free?'VIP免费':'免费下载')+'</div></div>';
infoGrid.innerHTML=infoHtml;
var statsRow=document.getElementById('detailStatsRow');
statsRow.innerHTML='<div class="detail-stat"><div class="detail-stat-num" data-count="'+(parseInt(soft.downloads,10)||0)+'">'+(parseInt(soft.downloads,10)||0)+'</div><div class="detail-stat-label">下载量</div></div><div class="detail-stat"><div class="detail-stat-num" data-count="'+(parseInt(soft.views,10)||0)+'">'+(parseInt(soft.views,10)||0)+'</div><div class="detail-stat-label">浏览量</div></div><div class="detail-stat"><div class="detail-stat-num">'+(soft.recommend?'推荐':'普通')+'</div><div class="detail-stat-label">推荐</div></div>';
document.getElementById('detailMeta').innerHTML='';
var descEl=document.getElementById('detailDesc');
var descText=sanitizeUnicode(soft.detail||soft.description||'');
if(descText.trim().length>0){descEl.textContent=descText;descEl.style.display='block';}
else{descEl.textContent='';descEl.style.display='none';}
var scr=document.getElementById('detailScreenshots');
var rawShots=soft.screenshots;
if(typeof rawShots==='string'){try{rawShots=JSON.parse(rawShots);}catch(e){rawShots=[];}}
if(!Array.isArray(rawShots))rawShots=[];
var screenshots=rawShots.filter(function(url){return url&&typeof url==='string'&&url.trim().length>0;});
if(screenshots.length>0){
scr.classList.remove('hidden');
document.getElementById('detailShotTitle').style.display='flex';
scr.innerHTML=screenshots.map(function(url){return '<img src="'+escapeAttr(url)+'" alt="软件截图" loading="lazy" decoding="async" onerror="this.style.display=\'none\'" data-url="'+escapeAttr(url)+'">';}).join('');
scr.querySelectorAll('img').forEach(function(img){img.addEventListener('click',function(){if(isSafeHttpUrl(this.dataset.url))window.open(this.dataset.url,'_blank','noopener,noreferrer');});});
}else{scr.classList.add('hidden');document.getElementById('detailShotTitle').style.display='none';scr.innerHTML='';}
var clog=document.getElementById('detailChangelog');
if(soft.changelog&&soft.changelog.trim().length>0){clog.classList.remove('hidden');clog.textContent=sanitizeUnicode(soft.changelog);}
else{clog.classList.add('hidden');}
var req=document.getElementById('detailRequirements');
if(soft.requirements&&soft.requirements.trim().length>0){req.classList.remove('hidden');req.textContent='系统要求：'+sanitizeUnicode(soft.requirements);}
else{req.classList.add('hidden');}
var related=document.getElementById('relatedSoftware');
var relatedGrid=document.getElementById('relatedGrid');
var relatedSoft=cache.software.filter(function(s){return s.category===soft.category&&s.id!==soft.id;}).slice(0,3);
if(relatedSoft.length){
related.classList.remove('hidden');
relatedGrid.innerHTML=relatedSoft.map(function(rs){
var platHtml='';
var platforms=rs.platforms||[];
if(platforms.includes('mac'))platHtml+='<span class="plat mac"><i class="fab fa-apple"></i></span>';
if(platforms.includes('windows'))platHtml+='<span class="plat win"><i class="fab fa-windows"></i></span>';
if(platforms.includes('android'))platHtml+='<span class="plat android"><i class="fab fa-android"></i></span>';
if(!platHtml)platHtml='<span class="plat" style="opacity:0.4;">—</span>';
return '<div class="related-card" data-id="'+escapeAttr(rs.id)+'"><div class="icon-wrap">'+renderIcon(rs)+'</div><div class="name">'+escapeHTML(rs.name)+'</div><div class="cat">'+escapeHTML(rs.category||'')+'</div><div class="platforms">'+platHtml+'</div></div>';
}).join('');
relatedGrid.querySelectorAll('.related-card').forEach(function(el){
el.addEventListener('click',function(){
var id=this.dataset.id;
Detail.close(true);
setTimeout(function(){Detail.openById(id);},200);
});
});
}else related.classList.add('hidden');
var dlBtn=document.getElementById('detailDownload');
dlBtn.innerHTML='<i class="fas fa-download"></i> 下载';
dlBtn.disabled=false;
dlBtn.onclick=function(){
if(!requireAuth())return;
if(soft.download_url&&isSafeHttpUrl(soft.download_url.trim())){
window.open(soft.download_url,'_blank','noopener,noreferrer');
soft.downloads=(soft.downloads||0)+1;
DB.updateSoftware(soft).catch(function(e){});
toast('开始下载 '+soft.name,'success');
}else{
toast('暂无下载链接','warning');
}
};
var favBtn=document.getElementById('detailFavBtn');
var isFav=isFavorited(soft.id);
favBtn.classList.toggle('active',isFav);
favBtn.innerHTML=isFav?'<i class="fas fa-heart"></i> 已收藏':'<i class="far fa-heart"></i> 收藏';
favBtn.onclick=function(){
var nowFav=toggleFavorite(soft.id);
this.classList.toggle('active',nowFav);
this.innerHTML=nowFav?'<i class="fas fa-heart"></i> 已收藏':'<i class="far fa-heart"></i> 收藏';
toast(nowFav?'已收藏':'已取消收藏',nowFav?'success':'warning');
var cardFav=document.querySelector('.software-card[data-id="'+soft.id+'"] .favorite-btn');
if(cardFav){if(nowFav)cardFav.classList.add('active');else cardFav.classList.remove('active');}
};
document.getElementById('detailShareBtn').onclick=function(){Share.open(soft);};
var fbBtn=document.getElementById('detailFeedbackBtn');
if(fbBtn)fbBtn.onclick=function(){
document.getElementById('feedbackTarget').textContent='针对：'+sanitizeUnicode(soft.name);
document.getElementById('feedbackModal').dataset.softId=soft.id;
document.getElementById('feedbackModal').classList.add('open');
};
overlay.classList.add('open');
document.body.style.overflow='hidden';
document.documentElement.style.overflow='hidden';
if(window._detailStartParticles)window._detailStartParticles();
this._currentSoft=soft;
try{
if(!soft._noHistory&&!noHist){
var _p=new URLSearchParams(window.location.search);
var _cur=_p.get('soft');
if(_cur!==soft.id){
_p.set('soft',soft.id);
window.history.pushState({soft:soft.id},'',window.location.pathname+'?'+_p.toString());
Detail._pushed=true;
}
}
}catch(e){}
},
openById:function(id){var soft=cache.software.find(function(s){return s.id===id;});if(soft){this.open(soft);}else{toast('未找到该软件','warning');}},
_updateSEO:function(soft){
try{
var _canon='https://www.lezhesoft.cn/soft/'+encodeURIComponent(soft.id)+'.html';
var title=sanitizeUnicode(soft.name)+' 下载 - '+sanitizeUnicode(soft.category)+' | 乐哲软件';
document.title=title;
var descMeta=document.querySelector('meta[name="description"]');
if(descMeta)descMeta.setAttribute('content',sanitizeUnicode(soft.description||soft.detail||'下载'+soft.name+'，最新版本'+soft.version+'，支持'+(soft.platforms?soft.platforms.join('/'):'' )));
var ogTitle=document.querySelector('meta[property="og:title"]');
if(ogTitle)ogTitle.setAttribute('content',title);
var ogDesc=document.querySelector('meta[property="og:description"]');
if(ogDesc)ogDesc.setAttribute('content',sanitizeUnicode(soft.description||soft.detail||''));
var ogUrl=document.querySelector('meta[property="og:url"]');
if(ogUrl)ogUrl.setAttribute('content',_canon);
var ogImg=document.querySelector('meta[property="og:image"]');
if(ogImg){var _img=(soft.screenshots&&soft.screenshots.length)?soft.screenshots[0]:(soft.icon_url||'');if(_img)ogImg.setAttribute('content',_img);}
var canonicalLink=document.querySelector('link[rel="canonical"]');
if(canonicalLink)canonicalLink.setAttribute('href',_canon);
this._updateSchema(soft);
}catch(e){console.warn('[SEO] 更新失败',e);}
},
_updateSchema:function(soft){
try{
var oldScript=document.getElementById('software-schema');
if(oldScript)oldScript.remove();
var schema={
'@context':'https://schema.org',
'@type':'SoftwareApplication',
'name':soft.name,
'description':soft.description||soft.detail||'',
'url':'https://www.lezhesoft.cn/soft/'+encodeURIComponent(soft.id)+'.html',
'applicationCategory':soft.category,
'operatingSystem':(soft.platforms||[]).join(','),
'softwareVersion':soft.version||'1.0',
'fileSize':soft.size||'',
'downloadUrl':soft.download_url||'',
'image':(soft.screenshots&&soft.screenshots.length)?soft.screenshots[0]:(soft.icon_url||''),
'author':{'@type':'Organization','name':'乐哲软件'},
'inLanguage':'zh-CN',
'offers':{'@type':'Offer','price':'0','priceCurrency':'CNY','availability':'https://schema.org/InStock'}
};
if(soft.created_at){schema.datePublished=new Date(soft.created_at).toISOString();}
if(soft.updated_at){schema.dateModified=new Date(soft.updated_at).toISOString();}
var _rv=parseInt(soft.views,10)||0,_dl=parseInt(soft.downloads,10)||0;
if(_dl>0||_rv>0){schema.interactionStatistic=[{'@type':'InteractionCounter','interactionType':'https://schema.org/DownloadAction','userInteractionCount':_dl},{'@type':'InteractionCounter','interactionType':'https://schema.org/ViewAction','userInteractionCount':_rv}];}
schema.publisher={'@type':'Organization','name':'乐哲软件','url':window.location.origin};
var _crumb={'@context':'https://schema.org','@type':'BreadcrumbList','itemListElement':[
{'@type':'ListItem','position':1,'name':'首页','item':window.location.origin+'/'},
{'@type':'ListItem','position':2,'name':soft.category||'全部软件','item':'https://www.lezhesoft.cn/cat/'+encodeURIComponent(soft.category||'')+'.html'},
{'@type':'ListItem','position':3,'name':soft.name,'item':'https://www.lezhesoft.cn/soft/'+encodeURIComponent(soft.id)+'.html'}
]};
var oldCrumb=document.getElementById('soft-breadcrumb-schema');
if(oldCrumb)oldCrumb.remove();
var crumbScript=document.createElement('script');
crumbScript.type='application/ld+json';
crumbScript.id='soft-breadcrumb-schema';
crumbScript.textContent=JSON.stringify(_crumb);
document.head.appendChild(crumbScript);
var script=document.createElement('script');
script.type='application/ld+json';
script.id='software-schema';
script.textContent=JSON.stringify(schema);
document.head.appendChild(script);
}catch(e){console.warn('[Schema] 更新失败',e);}
},
close:function(noHist){
document.getElementById('detailOverlay').classList.remove('open');
if(window._detailStopParticles)window._detailStopParticles();
if(!document.querySelector('.modal-overlay.open')){document.body.style.overflow='';document.documentElement.style.overflow='';}
var _closing=Detail._currentSoft;
Detail._currentSoft=null;
if(!noHist&&_closing&&!_closing._noHistory&&Detail._pushed){
Detail._pushed=false;
try{window.history.back();}catch(e){}
}else if(_closing&&!_closing._noHistory){
Detail._pushed=false;
try{
var _p=new URLSearchParams(window.location.search);
if(_p.get('soft')){
_p.delete('soft');
var _qs=_p.toString();
window.history.replaceState(null,'',window.location.pathname+(_qs?'?'+_qs:''));
}
}catch(e){}
}else{Detail._pushed=false;}
if(App._scrollPos>0){
var y=App._scrollPos;
requestAnimationFrame(function(){window.scrollTo({top:y,behavior:'instant'});});
}
return true;
}
};
document.getElementById('detailClose').addEventListener('click',function(){Detail.close();});
document.querySelector('.detail-breadcrumb a').addEventListener('click',function(e){e.preventDefault();Detail.close();setTimeout(function(){if(window.App&&App.goHome)App.goHome();},100);});
(function(){var overlay=document.getElementById('detailOverlay');overlay.addEventListener('mousemove',function(e){var r=overlay.getBoundingClientRect();overlay.style.setProperty('--mx',(e.clientX-r.left)+'px');overlay.style.setProperty('--my',(e.clientY-r.top)+'px');});overlay.addEventListener('mouseleave',function(){overlay.style.setProperty('--mx','50%');overlay.style.setProperty('--my','50%');});})();(function(){var pc=document.getElementById('detailParticles');if(!pc)return;var ctx=pc.getContext('2d');var ps=[],raf=null,n=35;function rs(){pc.width=pc.offsetWidth;pc.height=pc.offsetHeight;}function init(){ps=[];for(var i=0;i<n;i++){ps.push({x:Math.random()*pc.width,y:Math.random()*pc.height,r:Math.random()*2+0.5,vx:(Math.random()-.5)*.3,vy:-(Math.random()*.4+.1),o:Math.random()*.5+.2,c:Math.random()>.5?'0,119,255':'108,92,231'});}}function draw(){ctx.clearRect(0,0,pc.width,pc.height);for(var i=0;i<ps.length;i++){var p=ps[i];p.x+=p.vx;p.y+=p.vy;if(p.y<-10){p.y=pc.height+10;p.x=Math.random()*pc.width;}if(p.x<-10)p.x=pc.width+10;if(p.x>pc.width+10)p.x=-10;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle='rgba('+p.c+','+p.o+')';ctx.fill();}raf=requestAnimationFrame(draw);}window.addEventListener('resize',function(){rs();});window._detailStartParticles=function(){rs();init();if(!raf)draw();};window._detailStopParticles=function(){if(raf){cancelAnimationFrame(raf);raf=null;}ctx.clearRect(0,0,pc.width,pc.height);};})();
document.addEventListener('click',function(e){
if(e.target.closest('.favorite-btn')||e.target.closest('.compare-check')||e.target.closest('.detail-trigger'))return;
var card=e.target.closest('.software-card');
if(!card)return;
var id=card.dataset.id;
if(!id)return;
var soft=DB.getSoftware().find(function(s){return s.id===id;});
if(soft){App._scrollPos=window.scrollY;Detail.open(soft);}
});
document.addEventListener('keydown',function(e){
if(e.key!=='Enter'&&e.key!==' ')return;
if(!e.target||!e.target.closest)return;
var card=e.target.closest('.software-card');
if(!card||e.target.closest('input,textarea,select,[contenteditable]'))return;
if(e.target.closest('a,button'))return;
e.preventDefault();
var id=card.dataset.id;
if(!id)return;
var soft=DB.getSoftware().find(function(s){return s.id===id;});
if(soft){App._scrollPos=window.scrollY;Detail.open(soft);}
});
document.addEventListener('keydown',function(e){
if(e.key==='Escape'){
var anyClosed=false;
document.querySelectorAll('.modal-overlay.open').forEach(function(m){m.classList.remove('open');anyClosed=true;});
var detail=document.getElementById('detailOverlay');
if(detail&&detail.classList.contains('open')){detail.classList.remove('open');anyClosed=true;Detail._currentSoft=null;}
var np=document.getElementById('notifPanel');
if(np&&np.classList.contains('open')){np.classList.remove('open');anyClosed=true;}
var nd=document.getElementById('notifDetailOverlay');
if(nd){nd.classList.remove('open');setTimeout(function(){if(nd.parentNode)nd.parentNode.removeChild(nd);},320);anyClosed=true;}
if(anyClosed){document.body.style.overflow='';document.documentElement.style.overflow='';}
}
if(e.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){
e.preventDefault();
var si=document.getElementById('searchInput');
if(si){si.focus();si.select();}
}
if(e.altKey&&/^[1-7]$/.test(e.key)){
var map={1:'home',2:'list',3:'tutorials',4:'qa',5:'checkin',6:'ranking',7:'mall'};
var page=map[e.key];
e.preventDefault();
if(page==='home')App.goHome();
else if(page==='list')App.goList();
else if(page==='tutorials')App.goTutorials();
else if(page==='qa')App.goQA();
else if(page==='checkin')App.goCheckin();
else if(page==='ranking')App.goRanking();
else if(page==='mall')App.goMall();
}
});
var sidebar=document.getElementById('sidebarCategories'),trigger=document.getElementById('sidebarTrigger'),lockBtn=document.getElementById('sidebarLockBtn'),overlay=document.getElementById('sidebarOverlay'),mainContent=document.getElementById('mainContent'),mobileToggleBtn=document.getElementById('mobileToggleSidebar'),isLocked=false,isOpen=false,hoverTimeout=null;
function isMobile(){return window.innerWidth<=820;}
function openSidebar(){if(isOpen)return;isOpen=true;sidebar.classList.add('open');mainContent.classList.add('sidebar-open');if(!isMobile())trigger.style.opacity='0';if(isMobile()){overlay.classList.add('active');mobileToggleBtn.classList.add('close-btn');mobileToggleBtn.innerHTML='<i class="fas fa-times"></i>';}}
function closeSidebar(){if(isLocked&&!isMobile())return;if(!isOpen)return;isOpen=false;sidebar.classList.remove('open');mainContent.classList.remove('sidebar-open');if(!isMobile())trigger.style.opacity='0.7';if(isMobile()){overlay.classList.remove('active');mobileToggleBtn.classList.remove('close-btn');mobileToggleBtn.innerHTML='<i class="fas fa-bars"></i>';}}
function toggleLock(){isLocked=!isLocked;lockBtn.classList.toggle('locked',isLocked);if(isLocked&&!isOpen&&!isMobile())openSidebar();if(!isLocked&&!isMobile()){setTimeout(function(){if(!isOpen)return;closeSidebar();},2000);}}
function bindDesktopSidebarEvents(){trigger.addEventListener('mouseenter',desktopTriggerEnter);trigger.addEventListener('mouseleave',desktopTriggerLeave);sidebar.addEventListener('mouseenter',desktopSidebarEnter);sidebar.addEventListener('mouseleave',desktopSidebarLeave);}
function desktopTriggerEnter(){clearTimeout(hoverTimeout);if(!isLocked)openSidebar();}
function desktopTriggerLeave(){if(!isLocked){hoverTimeout=setTimeout(function(){closeSidebar();},300);}}
function desktopSidebarEnter(){clearTimeout(hoverTimeout);if(!isLocked&&!isOpen)openSidebar();}
function desktopSidebarLeave(){if(!isLocked){hoverTimeout=setTimeout(function(){closeSidebar();},400);}}
if(!isMobile()){bindDesktopSidebarEvents();}
lockBtn.addEventListener('click',toggleLock);
if(mobileToggleBtn){mobileToggleBtn.addEventListener('click',function(e){e.stopPropagation();if(isOpen){if(isLocked&&!isMobile())toggleLock();else closeSidebar();}else openSidebar();});}
if(overlay){overlay.addEventListener('click',function(){if(isMobile())closeSidebar();});}
document.addEventListener('click',function(e){if(isMobile()&&isOpen){var sidebarEl=document.getElementById('sidebarCategories');var triggerEl=document.getElementById('mobileToggleSidebar');if(!sidebarEl.contains(e.target)&&!triggerEl.contains(e.target))closeSidebar();}});
function getPinyin(text){if(!text)return '';try{if(!window.pinyinPro)return text;var r=window.pinyinPro.pinyin(text,{toneType:'none',type:'array'});return Array.isArray(r)?r.join(''):String(r);}catch(e){return text;}}
function getPinyinFirst(text){if(!text)return '';try{if(!window.pinyinPro)return text;var r=window.pinyinPro.pinyin(text,{pattern:'first',toneType:'none',type:'array'});return Array.isArray(r)?r.join(''):String(r);}catch(e){return text;}}
function matchSearch(software,keyword){if(!keyword)return true;var kw=keyword.toLowerCase().trim();var name=(software.name||'').toLowerCase();var desc=(software.description||'').toLowerCase();if(name.includes(kw)||desc.includes(kw))return true;var namePinyin=getPinyin(name);var descPinyin=getPinyin(desc);if(namePinyin.includes(kw)||descPinyin.includes(kw))return true;var nameFirst=getPinyinFirst(name);var descFirst=getPinyinFirst(desc);if(nameFirst.includes(kw)||descFirst.includes(kw))return true;return false;}
function parseVideoUrl(v){if(!v)return '';var isYoutube=v.includes('youtube.com')||v.includes('youtu.be');var isBilibili=v.includes('bilibili.com')||v.includes('b23.tv');if(isYoutube){var m=v.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?]+)/);if(m)return 'https://www.youtube.com/embed/'+m[1];}if(isBilibili){var b=v.match(/b23\.tv\/([a-zA-Z0-9]+)/)||v.match(/bilibili\.com\/video\/([a-zA-Z0-9]+)/);if(b)return 'https://player.bilibili.com/player.html?bvid='+b[1];}return v;}
function loadComments(tutorialId){
if(!tutorialId)return;
var container=document.getElementById('commentList');
if(!container)return;
if(!checkSupabase()){container.innerHTML='<div class="comment-empty">服务未加载</div>';return;}
container.innerHTML='<div class="comment-empty">加载评论中...</div>';
supabaseClient.from('tutorial_comments').select('*').eq('tutorial_id',tutorialId).order('created_at',{ascending:true}).then(function(res){
if(res.error){container.innerHTML='<div class="comment-empty">加载评论失败</div>';return;}
var data=res.data||[];
if(data.length===0){container.innerHTML='<div class="comment-empty">暂无评论，来说点什么吧</div>';return;}
container.innerHTML=data.map(function(c){return '<div class="comment-item"><span class="author">'+escapeHTML(c.author||'匿名用户')+'</span><span class="time">'+timeAgo(c.created_at)+'</span><div class="content">'+escapeHTML(c.content)+'</div></div>';}).join('');
}).catch(function(err){container.innerHTML='<div class="comment-empty">评论加载异常</div>';});
}
function submitComment(tutorialId,author,content){
if(!requireAuth())return;
if(!checkSupabase())return;
if(!tutorialId||!content.trim()){toast('请填写评论内容','warning');return;}
if(containsSensitiveWords(content)){toast('评论包含禁用词汇，请修改后重试','warning');return;}
content=filterSensitiveWords(content);
var btn=document.getElementById('commentSubmitBtn');
btn.disabled=true;btn.textContent='提交中...';
supabaseClient.from('tutorial_comments').insert([{tutorial_id:tutorialId,author:author.trim()||'匿名用户',content:content.trim()}]).then(function(res){
btn.disabled=false;btn.innerHTML='发表';
if(res.error){toast('评论失败：'+friendlyError(res.error),'error');return;}
toast('评论发表成功！','success');
document.getElementById('commentContent').value='';
loadComments(tutorialId);
}).catch(function(err){btn.disabled=false;btn.innerHTML='发表';toast('评论提交异常','error');});
}
function renderTutorials(){
var container=document.getElementById('tutorialList');
if(!container)return;
if(!checkSupabase()){container.innerHTML='<div class="empty-state"><div class="icon">📖</div><h3>服务未加载</h3><p>请刷新页面重试</p></div>';return;}
supabaseClient.from('tutorials').select('*').order('created_at',{ascending:false}).then(function(res){
if(res.error){container.innerHTML='<div class="empty-state"><div class="icon">📖</div><h3>加载教程失败</h3><p>'+escapeHTML(res.error.message||'未知错误')+'</p></div>';return;}
var data=res.data||[];
if(!Array.isArray(data))data=[];
if(data.length===0){container.innerHTML='<div class="empty-state"><div class="icon">📖</div><h3>暂无教程</h3><p>管理员正在准备内容</p></div>';return;}
var html='';
for(var t of data){
var videos=[];
try{if(t.videos)videos=typeof t.videos==='string'?JSON.parse(t.videos):t.videos;}catch(e){videos=[];}
if(!Array.isArray(videos))videos=[];
var videoCount=videos.length;
var coverUrl=t.cover||null;
if(!coverUrl&&videoCount>0){
var firstVideo=videos[0];
var ytMatch=firstVideo.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?]+)/);
if(ytMatch)coverUrl='https://img.youtube.com/vi/'+ytMatch[1]+'/maxresdefault.jpg';
}
var coverStyle=coverUrl?'background-image:url('+escapeAttr(coverUrl)+');background-size:cover;background-position:center;':'background:linear-gradient(135deg,#0077ff,#6c5ce7);';
var badgeHtml=videoCount>0?'<span style="position:absolute;top:12px;right:12px;background:rgba(0,0,0,0.65);color:#fff;padding:2px 12px;border-radius:20px;font-size:0.65rem;font-weight:600;"><i class="fas fa-video"></i> '+videoCount+'</span>':'<span style="position:absolute;top:12px;right:12px;background:rgba(0,0,0,0.45);color:#fff;padding:2px 10px;border-radius:20px;font-size:0.6rem;">📄 图文</span>';
var likes=t.likes||0;
html+='<div class="tut-card" data-id="'+escapeAttr(t.id)+'" style="cursor:pointer;border-radius:16px;overflow:hidden;background:var(--bg-card-solid);border:1px solid var(--border-glow);box-shadow:0 2px 12px rgba(0,0,0,0.04);transition:all 0.3s;position:relative;display:flex;flex-direction:column;">'+
'<div style="aspect-ratio:1200/630;width:100%;'+coverStyle+'position:relative;flex-shrink:0;background-color:#1a1a2e;">'+
'<div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 40%,rgba(0,0,0,0.4) 100%);"></div>'+
badgeHtml+
'<div style="position:absolute;bottom:0;left:0;right:0;padding:16px 18px 14px;color:#fff;">'+
'<div style="font-size:1.05rem;font-weight:700;line-height:1.3;text-shadow:0 2px 8px rgba(0,0,0,0.3);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">'+escapeHTML(t.title)+'</div></div></div>'+
'<div style="padding:14px 18px 16px;flex:1;display:flex;flex-direction:column;gap:6px;">'+
'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'+
'<span style="font-size:0.6rem;font-weight:600;background:var(--accent-gradient);color:#fff;padding:1px 12px;border-radius:50px;">'+escapeHTML(t.category)+'</span>'+
'<span style="font-size:0.7rem;color:var(--text-dim);"><i class="far fa-clock"></i> '+timeAgo(t.created_at)+'</span>'+
'</div>'+
(t.summary?'<div style="font-size:0.8rem;color:var(--text-secondary);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">'+escapeHTML(t.summary)+'</div>':'')+
'<div style="display:flex;align-items:center;justify-content:space-between;margin-top:auto;padding-top:10px;border-top:1px solid var(--border-glow);">'+
'<span style="font-size:0.7rem;color:var(--text-dim);display:flex;align-items:center;gap:4px;"><i class="far fa-heart"></i> <span class="like-count">'+likes+'</span></span>'+
'<button class="tut-like-btn" data-id="'+escapeAttr(t.id)+'" style="font-size:0.75rem;background:none;border:none;color:var(--text-dim);cursor:pointer;padding:2px 10px;border-radius:20px;display:flex;align-items:center;gap:4px;border:1px solid var(--border-glow);">'+
'<i class="far fa-heart"></i> 点赞</button>'+
'</div></div></div>';
}
container.innerHTML=html;
container.querySelectorAll('.tut-card').forEach(function(card){
card.addEventListener('click',function(e){
if(e.target.closest('.tut-like-btn'))return;
var id=this.dataset.id;
if(!id||!Array.isArray(data))return;
var tut=data.find(function(t){return t.id===id;});
if(!tut)return;
document.getElementById('tutorialDetailTitle').textContent=sanitizeUnicode(tut.title);
document.getElementById('tutorialDetailMeta').innerHTML='<span>'+escapeHTML(tut.category)+'</span><span>·</span><span><i class="far fa-clock"></i> '+timeAgo(tut.created_at)+'</span><span>·</span><span><i class="far fa-heart"></i> '+(tut.likes||0)+'</span>';
document.getElementById('tutorialDetailContent').innerHTML=sanitizeHTML(tut.content||'');
var coverBox=document.getElementById('tutorialDetailCover');
if(coverBox){
if(tut.cover){
coverBox.innerHTML='<img src="'+escapeAttr(tut.cover)+'" alt="'+escapeAttr(sanitizeUnicode(tut.title))+'" width="1200" height="630" loading="eager" style="display:block;width:100%;height:auto;aspect-ratio:1200/630;object-fit:cover;border-radius:12px;margin:10px 0;">';
coverBox.style.display='block';
}else{coverBox.innerHTML='';coverBox.style.display='none';}
}
var videos2=[];
try{if(tut.videos)videos2=typeof tut.videos==='string'?JSON.parse(tut.videos):tut.videos;}catch(e){videos2=[];}
if(!Array.isArray(videos2))videos2=[];
var videosContainer=document.getElementById('tutorialDetailVideos');
if(videosContainer){
if(videos2.length>0){
var videoHtml='';
for(var v of videos2){
var embedUrl=parseVideoUrl(v);
videoHtml+='<div style="margin:10px 0;position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:12px;background:#000;"><iframe src="'+escapeAttr(embedUrl)+'" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;" allowfullscreen loading="lazy"></iframe></div>';
}
videosContainer.innerHTML=videoHtml;
videosContainer.style.display='block';
}else{videosContainer.innerHTML='';videosContainer.style.display='none';}
}
loadComments(id);
var submitBtn=document.getElementById('commentSubmitBtn');
var contentInput=document.getElementById('commentContent');
var authorInput=document.getElementById('commentAuthor');
submitBtn.onclick=function(){submitComment(id,authorInput.value,contentInput.value);};
contentInput.onkeydown=function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submitComment(id,authorInput.value,contentInput.value);}};
document.getElementById('tutorialDetailModal').classList.add('open');
document.body.style.overflow='hidden';
});
});
container.querySelectorAll('.tut-like-btn').forEach(function(btn){
btn.addEventListener('click',function(e){
e.stopPropagation();
if(!requireAuth())return;
if(!checkSupabase())return;
var id=this.dataset.id;
supabaseClient.from('tutorials').select('likes').eq('id',id).single().then(function(res){
if(res.error){toast('点赞失败','warning');return;}
var likes=(parseInt(res.data&&res.data.likes,10)||0)+1;
supabaseClient.from('tutorials').update({likes:likes}).eq('id',id).then(function(){
toast('感谢点赞！','success');
var card=document.querySelector('.tut-card[data-id="'+id+'"]');
if(card){var likeCount=card.querySelector('.like-count');if(likeCount)likeCount.textContent=likes;}
}).catch(function(){toast('点赞异常','warning');});
}).catch(function(){toast('点赞异常','warning');});
});
});
}).catch(function(err){container.innerHTML='<div class="empty-state"><div class="icon">📖</div><h3>加载教程失败</h3><p>请检查网络或稍后重试</p></div>';});
}
function htmlToText(html){if(!html)return '';var s=String(html).replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/<br[^>]*>/gi,' ');var d=document.createElement('div');d.innerHTML=s;return (d.textContent||d.innerText||'').trim();}
var _questionsClickHandler=null;
function renderQuestions(category,silent){
var container=document.getElementById('questionList');
if(!container)return;
var detailC=document.getElementById('questionDetailContainer');
if(!silent){container.classList.remove('hidden');if(detailC)detailC.classList.add('hidden');}
window._qaCache={};
if(!checkSupabase()){container.innerHTML='<div class="empty-state"><div class="icon">❓</div><h3>服务未加载</h3><p>请刷新页面重试</p></div>';return;}
var query=supabaseClient.from('questions').select('*');
if(category){query=query.eq('category',category);}
query.order('created_at',{ascending:false}).then(function(res){
if(res.error){container.innerHTML='<div class="empty-state"><div class="icon">❓</div><h3>加载问答失败</h3><p>'+escapeHTML(res.error.message||'未知错误')+'</p></div>';return;}
var data=res.data||[];
if(data.length===0){container.innerHTML='<div class="empty-state"><div class="icon">❓</div><h3>'+(category?'暂无'+category+'类问题':'暂无问题')+'</h3><p>'+(category?'切换分类或':'成为第一个')+'提问者吧！</p></div>';return;}
container.innerHTML=data.map(function(q){
window._qaCache[q.id]=q;
var badges='';
if(q.is_pinned)badges+='<span class="badge badge-pinned"><i class="fas fa-thumbtack"></i> 置顶</span>';
if(q.is_featured)badges+='<span class="badge badge-featured"><i class="fas fa-star"></i> 精华</span>';
return '<div class="card-item" data-id="'+escapeAttr(q.id)+'"><div class="title">'+escapeHTML(q.title)+' '+badges+'</div><div class="meta"><span>'+escapeHTML(q.category)+'</span><span>'+timeAgo(q.created_at)+'</span><span>💬 '+(q.answers_count||0)+'</span><span>👁️ '+(q.views||0)+'</span></div><div class="summary">'+escapeHTML(htmlToText(q.body||'').slice(0,100))+'...</div><div class="footer"><span class="q-votes-'+escapeAttr(q.id)+'">👍 '+(q.votes||0)+'</span><div class="actions"><button class="vote-q" data-id="'+escapeAttr(q.id)+'"><i class="fas fa-thumbs-up"></i></button><button class="view-q" data-id="'+escapeAttr(q.id)+'">查看详情</button></div></div></div>';
}).join('');
if(_questionsClickHandler){container.removeEventListener('click',_questionsClickHandler);}
_questionsClickHandler=function(e){
var target=e.target.closest('button');
if(target&&target.dataset.id){
var id=target.dataset.id;
if(target.classList.contains('vote-q')){
e.stopPropagation();
if(!requireAuth())return;
if(!checkSupabase())return;
supabaseClient.from('questions').select('votes').eq('id',id).single().then(function(res){
if(res.error){toast('投票失败','warning');return;}
var votes=(parseInt(res.data&&res.data.votes,10)||0)+1;
supabaseClient.from('questions').update({votes:votes}).eq('id',id).then(function(){
toast('已投票','success');
var voteEl=container.querySelector('.q-votes-'+id);
if(voteEl)voteEl.textContent='👍 '+votes;
});
}).catch(function(){toast('投票异常','warning');});
return;
}
if(target.classList.contains('view-q')){e.stopPropagation();showQuestionDetail(id,window._qaCache[id]);return;}
}
var cardEl=e.target.closest('.card-item');
if(cardEl&&cardEl.dataset.id){showQuestionDetail(cardEl.dataset.id,window._qaCache[cardEl.dataset.id]);}
};
container.addEventListener('click',_questionsClickHandler);
}).catch(function(err){container.innerHTML='<div class="empty-state"><div class="icon">❓</div><h3>加载问答失败</h3><p>请检查网络</p></div>';});
}
document.getElementById('tutorialDetailClose').addEventListener('click',function(){document.getElementById('tutorialDetailModal').classList.remove('open');if(!document.querySelector('.detail-overlay.open')){document.body.style.overflow='';}});
document.getElementById('tutorialDetailCloseBtn').addEventListener('click',function(){document.getElementById('tutorialDetailModal').classList.remove('open');if(!document.querySelector('.detail-overlay.open')){document.body.style.overflow='';}});
function showQuestionDetail(qid,fallback){
if(!checkSupabase())return;
var container=document.getElementById('questionDetailContainer');
var list=document.getElementById('questionList');
list.classList.add('hidden');
container.classList.remove('hidden');
var bindBack=function(){var b=document.getElementById('backToQuestions');if(b)b.addEventListener('click',function(){container.classList.add('hidden');list.classList.remove('hidden');});};
var renderDetail=function(q){
var badges='';
if(q.is_pinned)badges+='<span class="badge badge-pinned"><i class="fas fa-thumbtack"></i> 置顶</span>';
if(q.is_featured)badges+='<span class="badge badge-featured"><i class="fas fa-star"></i> 精华</span>';
var html='<div class="question-detail">'+
'<div class="q-title">'+escapeHTML(q.title)+' '+badges+'</div>'+
'<div class="q-meta"><span>'+escapeHTML(q.category)+'</span> · <span>'+timeAgo(q.created_at)+'</span> · <span>👍 '+(q.votes||0)+'</span> · <span>👁️ '+(q.views||0)+'</span></div>'+
'<div class="q-body">'+sanitizeHTML(q.body||'')+'</div>'+
'<div style="margin-top:12px;">'+
'<button class="btn btn-sm btn-outline" id="backToQuestions">← 返回问题列表</button>'+
'<button class="btn btn-sm btn-primary" id="answerBtn" style="margin-left:10px;">写回答</button>'+
'</div></div><div id="answersList"></div>';
container.innerHTML=html;
document.getElementById('backToQuestions').addEventListener('click',function(){container.classList.add('hidden');list.classList.remove('hidden');});
document.getElementById('answerBtn').addEventListener('click',function(){
if(!requireAuth())return;
var modal=document.getElementById('answerModal');
modal.classList.add('open');
document.getElementById('aBody').innerHTML='';
_aAttachments=[];renderAttachmentList('a');
document.getElementById('aSubmit').dataset.qid=qid;
});
loadAnswers(qid);
};
if(fallback){
if((!fallback.title||!String(fallback.title).trim())&&(!fallback.body||!String(fallback.body).trim())){
container.innerHTML='<div class="question-detail"><div class="q-title">文章内容为空</div><div class="q-meta">该文章在数据库中暂无标题和正文，请在后台补充内容</div><div style="margin-top:12px;"><button class="btn btn-sm btn-outline" id="backToQuestions">← 返回问题列表</button></div></div>';
bindBack();
}else{
renderDetail(fallback);
}
}
else{
container.innerHTML='<div class="question-detail"><div class="q-title">正在加载文章…</div><div style="margin-top:12px;"><button class="btn btn-sm btn-outline" id="backToQuestions">← 返回问题列表</button></div></div>';
bindBack();
}
supabaseClient.from('questions').select('views').eq('id',qid).single().then(function(res){
if(!res.error){
var views=(res.data?res.data.views:0)+1;
supabaseClient.from('questions').update({views:views}).eq('id',qid).then(function(){});
}
}).catch(function(){});
supabaseClient.from('questions').select('*').eq('id',qid).single().then(function(res){
if(res.error||!res.data){
if(!fallback){
var errMsg=(res.error&&res.error.message)?escapeHTML(res.error.message):'该文章可能已被删除，或数据尚未同步到云端';
container.innerHTML='<div class="question-detail"><div class="q-title">文章加载失败</div><div class="q-meta">'+errMsg+'</div><div style="margin-top:12px;"><button class="btn btn-sm btn-outline" id="backToQuestions">← 返回问题列表</button></div></div>';
bindBack();
}
return;
}
var q=res.data;
if((!q.title||!String(q.title).trim())&&(!q.body||!String(q.body).trim())){
if(!fallback){
container.innerHTML='<div class="question-detail"><div class="q-title">文章内容为空</div><div class="q-meta">该文章在数据库中暂无标题和正文，请在后台补充内容</div><div style="margin-top:12px;"><button class="btn btn-sm btn-outline" id="backToQuestions">← 返回问题列表</button></div></div>';
bindBack();
}
return;
}
renderDetail(q);
}).catch(function(err){
if(!fallback){
var errMsg=(err&&err.message)?escapeHTML(err.message):'网络异常或文章不存在，请返回后重试';
container.innerHTML='<div class="question-detail"><div class="q-title">文章加载失败</div><div class="q-meta">'+errMsg+'</div><div style="margin-top:12px;"><button class="btn btn-sm btn-outline" id="backToQuestions">← 返回问题列表</button></div></div>';
bindBack();
}
});
}
var _answersClickHandler=null;
function loadAnswers(qid){
if(!checkSupabase()){var c0=document.getElementById('answersList');if(c0)c0.innerHTML='<p style="color:var(--text-dim);">服务未加载</p>';return;}
var container=document.getElementById('answersList');
supabaseClient.from('answers').select('*').eq('question_id',qid).order('created_at',{ascending:true}).then(function(res){
if(res.error){container.innerHTML='<p style="color:var(--text-dim);">暂无回答，快来抢沙发！</p>';return;}
var data=res.data||[];
if(data.length===0){container.innerHTML='<p style="color:var(--text-dim);">还没有回答，快来抢沙发！</p>';return;}
container.innerHTML=data.map(function(a){return '<div class="answer-item"><div class="a-meta"><span>匿名用户</span><span>'+timeAgo(a.created_at)+'</span></div><div class="a-body">'+sanitizeHTML(a.body||'')+'</div><div class="a-actions"><button class="vote-a" data-id="'+escapeAttr(a.id)+'"><i class="fas fa-thumbs-up"></i> <span class="a-votes-'+escapeAttr(a.id)+'">'+(a.votes||0)+'</span></button></div></div>';}).join('');
if(_answersClickHandler){container.removeEventListener('click',_answersClickHandler);}
_answersClickHandler=function(e){
var target=e.target.closest('button');
if(!target)return;
var id=target.dataset.id;
if(!id)return;
if(target.classList.contains('vote-a')){
if(!requireAuth())return;
if(!checkSupabase())return;
supabaseClient.from('answers').select('votes').eq('id',id).single().then(function(res){
if(res.error){toast('投票失败','warning');return;}
var votes=(parseInt(res.data&&res.data.votes,10)||0)+1;
supabaseClient.from('answers').update({votes:votes}).eq('id',id).then(function(){
toast('已投票','success');
var voteEl=container.querySelector('.a-votes-'+id);
if(voteEl)voteEl.textContent=votes;
});
}).catch(function(){toast('投票异常','warning');});
}
};
container.addEventListener('click',_answersClickHandler);
}).catch(function(err){container.innerHTML='<p style="color:var(--text-dim);">加载回答失败</p>';});
}
var currentPage=1,PAGE_SIZE=10,currentFilteredList=[];
function handleUrlParams(){
if(_urlParamsHandled)return false;
var hash=window.location.hash||'';
var p=new URLSearchParams(window.location.search);
var sc=p.get('soft'),ct=p.get('cat'),kw=p.get('search'),pg=p.get('page');
if(hash&&hash.startsWith('#software/')){
var softId=hash.replace('#software/','');
var s0=cache.software.find(function(x){return x.id===softId;});
_urlParamsHandled=true;
if(s0){var _seq0=_navSeq;App.goList(s0.category,true);setTimeout(function(){if(_navStale(_seq0))return;Detail.open(s0);},200);return true;}
return false;
}
if(sc){var s0=cache.software.find(function(x){return x.id===sc;});_urlParamsHandled=true;if(s0){var _seq0=_navSeq;App.goList(s0.category,true);setTimeout(function(){if(_navStale(_seq0))return;Detail.open(s0);},200);return true;}return false;}
if(pg==='checkin'){_urlParamsHandled=true;App.goCheckin(true);return true;}
if(pg==='ranking'){_urlParamsHandled=true;App.goRanking(true);return true;}
if(pg==='profile'){_urlParamsHandled=true;App.goProfile(true);return true;}
if(pg==='mall'){_urlParamsHandled=true;App.goMall(true);return true;}
if(pg==='myRedeems'){_urlParamsHandled=true;App.goMyRedeems(true);return true;}
if(ct){_urlParamsHandled=true;App.goList(ct,true);return true;}
if(kw){_urlParamsHandled=true;App.doSearch(kw,true);return true;}
return false;
}
function handlePopState(){
_bumpNav();
var hash=window.location.hash||'';
var p=new URLSearchParams(window.location.search);
var sc=p.get('soft'),ct=p.get('cat'),kw=p.get('search'),pg=p.get('page');
var _ov=document.getElementById('detailOverlay');
var _detailOpen=_ov&&_ov.classList.contains('open');
var _wantDetail=!!(sc||(hash&&hash.startsWith('#software/')));
if(_detailOpen&&!_wantDetail){Detail.close(true);}
if(_wantDetail){
var softId=sc?sc:hash.replace('#software/','');
var s0=cache.software.find(function(x){return x.id===softId;});
if(s0){App.goList(s0.category,true);setTimeout(function(){Detail.open(s0,true);},200);return;}
if(_detailOpen){Detail.close(true);}
}
if(pg==='checkin'){App.goCheckin(true);return;}
if(pg==='ranking'){App.goRanking(true);return;}
if(pg==='profile'){App.goProfile(true);return;}
if(pg==='mall'){App.goMall(true);return;}
if(pg==='myRedeems'){App.goMyRedeems(true);return;}
if(ct){App.goList(ct,true);return;}
if(kw){App.doSearch(kw,true);return;}
App.goHome(true);
}
window.addEventListener('popstate',handlePopState);
function clearNavActive(){document.querySelectorAll('.nav-links a').forEach(function(a){a.classList.remove('active');});var authNav=document.getElementById('authNav');if(authNav)authNav.classList.remove('active');}
function exportUserData(){
var data={version:1,favorites:safeParse(localStorage.getItem('lezhe_favorites'),[]),viewHistory:safeParse(localStorage.getItem('lezhe_view_history'),[]),searchHistory:safeParse(localStorage.getItem('lezhe_search_history'),[]),exportedAt:new Date().toISOString()};
var blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
var url=URL.createObjectURL(blob);
var a=document.createElement('a');
a.href=url;a.download='lezhe-data-'+Date.now()+'.json';
document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
toast('数据已导出','success');
}
function importUserData(file){
var reader=new FileReader();
reader.onload=function(e){
try{
var data=JSON.parse(e.target.result);
if(Array.isArray(data.favorites))localStorage.setItem('lezhe_favorites',JSON.stringify(data.favorites));
if(Array.isArray(data.viewHistory))localStorage.setItem('lezhe_view_history',JSON.stringify(data.viewHistory));
if(Array.isArray(data.searchHistory))localStorage.setItem('lezhe_search_history',JSON.stringify(data.searchHistory));
searchHistory=safeParse(localStorage.getItem('lezhe_search_history'),[]);
viewHistory=safeParse(localStorage.getItem('lezhe_view_history'),[]);
toast('数据导入成功','success');
if(App.currentPage==='profile')renderProfile();
if(App.currentPage==='home')App.refreshHome();
if(App.currentPage==='list')App.refreshListWithFilters();
}catch(err){toast('导入失败：文件格式错误','error');}
};
reader.readAsText(file);
}
var Checkin={
_today:function(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');},
_yesterday:function(){var d=new Date();d.setDate(d.getDate()-1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');},
_dateStr:function(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');},
load:async function(){
var container=document.getElementById('checkinContent');
if(!container)return;
if(!currentUser){container.innerHTML='<div class="empty-state"><div class="icon">🔐</div><h3>请先登录</h3><p>登录后即可签到获取积分</p><button class="btn btn-primary" style="margin-top:14px;" onclick="document.getElementById(\'loginModal\').classList.add(\'open\')">去登录</button></div>';return;}
if(!checkSupabase())return;
container.innerHTML='<div style="text-align:center;padding:50px;color:var(--text-dim);font-size:.85rem;"><i class="fas fa-spinner fa-spin" style="font-size:1.5rem;"></i><div style="margin-top:10px;">加载中...</div></div>';
try{
var userId=currentUser.id;
var todayStr=this._today();
var yesterdayStr=this._yesterday();
var results=await Promise.all([
supabaseClient.from('user_points').select('*').eq('user_id',userId).maybeSingle(),
supabaseClient.from('checkins').select('checkin_date,points_earned,streak').eq('user_id',userId).order('checkin_date',{ascending:false}).limit(30)
]);
var pointsRow=results[0].data||{points:0,streak:0,last_checkin:null};
var recent=results[1].data||[];
var streakMap={};
recent.forEach(function(r){streakMap[r.checkin_date]=true;});
var lastDate=pointsRow.last_checkin;
var checkedToday=lastDate===todayStr;
var streak=pointsRow.streak||0;
if(lastDate&&lastDate!==todayStr&&lastDate!==yesterdayStr)streak=0;
if(checkedToday)streak=pointsRow.streak||streak;
var dayNames=['日','一','二','三','四','五','六'];
var daysHtml='';
for(var i=6;i>=0;i--){
var d=new Date();d.setDate(d.getDate()-i);
var ds=this._dateStr(d);
var isDone=!!streakMap[ds];
var isToday=ds===todayStr;
var cls='checkin-day'+(isDone?' done':'')+(isToday?' today':'');
daysHtml+='<div class="'+cls+'"><span class="day-icon">'+(isDone?'✓':'○')+'</span><span class="day-num">'+d.getDate()+'</span><span>周'+dayNames[d.getDay()]+'</span></div>';
}
var nextBonusTip='';
if(!checkedToday){
if(streak<2)nextBonusTip='连续签 3 天起 +20，7 天起 +30 积分';
else if(streak===2)nextBonusTip='明天签到就进入 +20 区间啦';
else if(streak>=6)nextBonusTip='明天将获得最高 +30 积分！';
else nextBonusTip='已进入 +20 区间，坚持到 7 天有 +30';
}
container.innerHTML='<div class="checkin-card">'+
'<div style="font-size:.78rem;color:var(--text-secondary);letter-spacing:1px;">连 续 签 到</div>'+
'<div class="checkin-streak">'+streak+'<span style="font-size:1.1rem;font-weight:400;color:var(--text-dim);margin-left:8px;">天</span></div>'+
'<div style="margin-top:6px;font-size:.85rem;color:var(--text-secondary);">当前积分：<strong style="color:var(--accent-cyan);font-size:1rem;">'+(pointsRow.points||0)+'</strong></div>'+
'<div class="checkin-week">'+daysHtml+'</div>'+
(checkedToday
?'<button class="checkin-btn" disabled>✓ 今日已签到</button><div style="margin-top:14px;font-size:.75rem;color:var(--text-dim);">明天再来，保持连签哦～</div>'
:'<button class="checkin-btn" id="doCheckinBtn"><i class="fas fa-calendar-check"></i> 立即签到</button><div style="margin-top:14px;font-size:.75rem;color:var(--text-dim);">'+nextBonusTip+'</div>'
)+'</div>';
var btn=document.getElementById('doCheckinBtn');
if(btn)btn.addEventListener('click',function(){Checkin.doCheckin();});
}catch(e){
console.error('签到加载失败',e);
container.innerHTML='<div class="empty-state"><div class="icon">⚠</div><h3>加载失败</h3><p>'+escapeHTML(e.message||'未知错误')+'</p></div>';
}
},
doCheckin:async function(){
if(!currentUser){toast('请先登录','warning');return;}
if(!checkSupabase())return;
var btn=document.getElementById('doCheckinBtn');
if(btn){btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> 签到中...';}
try{
var userId=currentUser.id;
var todayStr=this._today();
var yesterdayStr=this._yesterday();
var curRes=await supabaseClient.from('user_points').select('*').eq('user_id',userId).maybeSingle();
var current=curRes.data||{points:0,streak:0,last_checkin:null};
if(current.last_checkin===todayStr){toast('今日已签到','warning');this.load();return;}
var newStreak=(current.last_checkin===yesterdayStr)?(current.streak||0)+1:1;
var earned=10;
if(newStreak>=7)earned=30;else if(newStreak>=3)earned=20;
var insRes=await supabaseClient.from('checkins').insert([{user_id:userId,checkin_date:todayStr,points_earned:earned,streak:newStreak}]);
if(insRes.error&&insRes.error.code==='23505'){toast('今日已签到','warning');if(btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-calendar-check"></i> 立即签到';}this.load();return;}
if(insRes.error)throw insRes.error;
var newPoints=(current.points||0)+earned;
var upRes=await supabaseClient.from('user_points').upsert({user_id:userId,points:newPoints,streak:newStreak,last_checkin:todayStr,updated_at:new Date().toISOString()},{onConflict:'user_id'});
if(upRes.error)throw upRes.error;
var tip='签到成功！+'+earned+' 积分 🎉';
if(newStreak===3)tip='连续 3 天！+'+earned+' 积分 🎉';
else if(newStreak===7)tip='连续 7 天！+'+earned+' 积分 🏆';
toast(tip,'success');
this.load();
}catch(e){
console.error('签到失败',e);
toast('签到失败：'+(e.message||'未知错误'),'error');
if(btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-calendar-check"></i> 立即签到';}
}
}
};
var Ranking={
load:async function(){
var container=document.getElementById('rankingContent');
if(!container)return;
if(!checkSupabase())return;
container.innerHTML='<div style="text-align:center;padding:50px;color:var(--text-dim);font-size:.85rem;"><i class="fas fa-spinner fa-spin" style="font-size:1.5rem;"></i><div style="margin-top:10px;">加载中...</div></div>';
try{
var res=await supabaseClient.from('user_points').select('user_id,points,streak,updated_at').order('points',{ascending:false}).limit(50);
if(res.error)throw res.error;
var data=res.data||[];
if(data.length===0){container.innerHTML='<div class="empty-state"><div class="icon">🏆</div><h3>暂无排行数据</h3><p>快去签到获取积分，抢占榜首吧！</p><button class="btn btn-primary" style="margin-top:14px;" onclick="App.goCheckin()">前往签到</button></div>';return;}
var userIds=data.map(function(d){return d.user_id;});
var profilesRes=await supabaseClient.from('profiles').select('id,username,avatar_url').in('id',userIds);
var profileMap={};
(profilesRes.data||[]).forEach(function(p){profileMap[p.id]=p;});
var myId=currentUser?currentUser.id:null;
var myRank=-1;
data.forEach(function(d,i){if(d.user_id===myId)myRank=i;});
var html='';
if(myRank>=0){
html+='<div style="max-width:640px;margin:0 auto 16px;padding:14px 18px;background:rgba(0,119,255,.06);border:1px solid var(--accent-cyan);border-radius:var(--radius-md);display:flex;align-items:center;gap:12px;font-size:.85rem;">'+
'<i class="fas fa-user-circle" style="color:var(--accent-cyan);font-size:1.2rem;"></i>'+
'<strong style="color:var(--accent-cyan);">我的排名：第 '+(myRank+1)+' 名</strong>'+
'<span style="margin-left:auto;font-weight:700;color:var(--accent-cyan);">'+data[myRank].points+' 积分</span>'+
'</div>';
}
html+='<div class="rank-list">';
data.forEach(function(d,i){
var p=profileMap[d.user_id]||{};
var name=p.username||'匿名用户';
var avatar=p.avatar_url;
var initial=(name&&name.charAt(0)?name.charAt(0).toUpperCase():'U');
var rankCls=i===0?'top1':i===1?'top2':i===2?'top3':'';
var isMe=d.user_id===myId;
var avatarHtml=avatar?'<img src="'+escapeAttr(avatar)+'" alt="avatar" width="42" height="42" loading="lazy" decoding="async" data-fallback="'+escapeAttr(initial)+'" onerror="this.parentElement.textContent=this.dataset.fallback;">':escapeHTML(initial);
var medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':(''+(i+1));
html+='<div class="rank-item '+rankCls+'">'+
'<div class="rank-num">'+medal+'</div>'+
'<div class="rank-avatar">'+avatarHtml+'</div>'+
'<div class="rank-info">'+
'<div class="rank-name">'+escapeHTML(name)+(isMe?' <span style="font-size:.62rem;color:var(--accent-cyan);font-weight:600;">（我）</span>':'')+'</div>'+
'<div class="rank-sub">连续签到 '+(d.streak||0)+' 天</div>'+
'</div>'+
'<div class="rank-points">'+(d.points||0)+'<span style="font-size:.65rem;color:var(--text-dim);font-weight:400;margin-left:2px;">分</span></div>'+
'</div>';
});
html+='</div>';
container.innerHTML=html;
}catch(e){
console.error('排行榜加载失败',e);
container.innerHTML='<div class="empty-state"><div class="icon">⚠</div><h3>加载失败</h3><p>'+escapeHTML(e.message||'未知错误')+'</p></div>';
}
}
};
var RedeemResult={
show:function(data){
var isAuto=data.isAuto;
var overlay=document.createElement('div');
overlay.className='liquid-overlay';
var title=isAuto?'🎉 兑换成功，已自动发货':'✅ 兑换成功';
var desc=isAuto?'网盘地址已发放到下方，请及时保存':'客服会尽快通过您填写的联系方式发放';
var contentHtml='';
if(isAuto&&data.autoContent){
contentHtml='<div class="liquid-content-box">'+
'<div style="font-size:.72rem;color:var(--text-dim);margin-bottom:6px;"><i class="fas fa-box-open"></i> 自动发货内容</div>'+
'<pre id="_redeemAutoContent" class="liquid-pre">'+escapeHTML(data.autoContent)+'</pre>'+
'<button id="_redeemCopyBtn" class="btn btn-sm btn-primary" style="margin-top:10px;width:100%;"><i class="fas fa-copy"></i> 复制内容</button>'+
'</div>';
}else{
contentHtml='<div style="background:rgba(243,156,18,.10);border:1px solid rgba(243,156,18,.28);border-radius:12px;padding:12px;margin:14px 0;text-align:left;font-size:.78rem;color:var(--text-secondary);line-height:1.7;">'+
'<div style="font-weight:600;color:var(--warning);margin-bottom:4px;"><i class="fas fa-clock"></i> 等待客服发放</div>'+
'<div>联系方式：<b style="color:var(--text-primary);">'+escapeHTML(data.contact||'-')+'</b></div>'+
'<div>客服微信：<b style="color:var(--text-primary);">Adob_123</b>（点击下方按钮复制）</div>'+
'</div>';
}
overlay.innerHTML='<div class="liquid-modal solid" data-type="success" style="max-width:440px;"><div class="liquid-orb liquid-orb-1"></div><div class="liquid-orb liquid-orb-2"></div><div class="liquid-content"><div class="liquid-icon" style="margin:0 auto 16px;"><i class="fas '+(isAuto?'fa-gift':'fa-check')+'"></i></div><h3 class="liquid-title" style="text-align:center;">'+title+'</h3><p class="liquid-desc" style="text-align:center;margin-bottom:6px;">'+desc+'</p><p style="font-size:.75rem;color:var(--text-dim);text-align:center;margin:0;">商品：<b style="color:var(--text-secondary);">'+escapeHTML(data.itemName)+'</b> · 消耗 <b style="color:var(--accent-cyan);">'+data.cost+'</b> 积分</p>'+contentHtml+'<div class="liquid-actions" style="margin-top:14px;"><button class="liquid-btn liquid-btn-cancel" id="_redeemGoMine" type="button">查看我的兑换</button><button class="liquid-btn liquid-btn-confirm" id="_redeemOk" type="button"><i class="fas fa-check"></i> 知道了</button></div></div></div>';
document.body.appendChild(overlay);
requestAnimationFrame(function(){overlay.classList.add('open');});
function close(){overlay.classList.remove('open');setTimeout(function(){if(overlay.parentNode)overlay.parentNode.removeChild(overlay);},350);}
overlay.querySelector('#_redeemOk').onclick=close;
overlay.querySelector('#_redeemGoMine').onclick=function(){close();setTimeout(function(){App.goMyRedeems();},300);};
overlay.onclick=function(e){if(e.target===overlay)close();};
var copyBtn=overlay.querySelector('#_redeemCopyBtn');
if(copyBtn)copyBtn.onclick=function(){
var text=data.autoContent||'';
copyTextToClipboard(text).then(function(ok){if(ok)toast('已复制发货内容','success');else toast('复制失败，请手动选择','warning');});
};
}
};
var Mall={
load:async function(){
var c=document.getElementById('mallContent');
if(!c)return;
if(!checkSupabase())return;
c.innerHTML='<div style="text-align:center;padding:40px;color:var(--text-dim);">加载中...</div>';
try{
var itemsRes=await supabaseClient.from('mall_items').select('*').eq('active',true).order('sort',{ascending:true});
if(itemsRes.error)throw itemsRes.error;
var items=itemsRes.data||[];
var myPoints=0;
var myRedeemCount=0;
if(currentUser){
var pRes=await supabaseClient.from('user_points').select('points').eq('user_id',currentUser.id).maybeSingle();
myPoints=(pRes.data&&pRes.data.points)||0;
var rdRes=await supabaseClient.from('redeems').select('id',{count:'exact'}).eq('user_id',currentUser.id);
myRedeemCount=(rdRes.data||[]).length;
}
var mallPointsEl=document.getElementById('mallMyPoints');
if(mallPointsEl)mallPointsEl.textContent=myPoints;
if(!items.length){c.innerHTML='<div class="empty-state"><div class="icon">🎁</div><h3>暂无商品</h3></div>';return;}
var pointsBar='<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;margin-bottom:14px;font-size:.78rem;color:var(--text-secondary);">'+
'当前积分：<strong style="color:var(--accent-cyan);">'+myPoints+'</strong>'+
'&nbsp;&nbsp;|&nbsp;&nbsp;'+
'<a href="#" onclick="App.goMyRedeems();return false;" style="color:var(--accent-cyan);font-weight:600;">我的兑换 ('+myRedeemCount+') →</a>'+
'</div>';
c.innerHTML=pointsBar+'<div class="mall-grid">'+items.map(function(it){
var imgLink='';
if(it.icon_url&&typeof it.icon_url==='string'&&isImageUrl(it.icon_url.trim()))imgLink=it.icon_url.trim();
else if(it.icon&&typeof it.icon==='string'&&isImageUrl(it.icon.trim()))imgLink=it.icon.trim();
var iconHtml=imgLink
? '<img src="'+escapeAttr(imgLink)+'" alt="" loading="lazy" data-fallback="'+escapeAttr(it.icon||'🎁')+'" onerror="this.style.display=\'none\';this.parentElement.textContent=this.dataset.fallback||\'🎁\';">'
: escapeHTML(it.icon||'🎁');
var stock=typeof it.stock==='number'?it.stock:-1;
var stockTag='';
var outOfStock=false;
if(stock!==-1){
if(stock<=0){stockTag='<span class="stock-tag out">已售罄</span>';outOfStock=true;}
else if(stock<=3){stockTag='<span class="stock-tag low">仅剩 '+stock+'</span>';}
else{stockTag='<span class="stock-tag">库存 '+stock+'</span>';}
}
var isAuto=it.delivery_type==='auto';
var autoTag=isAuto?'<span class="auto-tag">⚡ 自动发货</span>':'';
var btnDisabled=outOfStock?' disabled':'';
var btnText=outOfStock?'已售罄':(isAuto?'立即兑换':'联系兑换');
return '<div class="mall-card" data-id="'+escapeAttr(it.id)+'" data-cost="'+it.cost+'" data-stock="'+stock+'">'+stockTag+autoTag+
'<div class="icon">'+iconHtml+'</div>'+
'<div class="name">'+escapeHTML(it.name)+'</div>'+
'<div class="desc">'+escapeHTML(it.description||'')+'</div>'+
'<div class="cost">'+it.cost+'</div>'+
'<button class="btn btn-sm btn-primary buy-btn" data-id="'+escapeAttr(it.id)+'" data-cost="'+it.cost+'"'+btnDisabled+'>'+btnText+'</button></div>';
}).join('')+'</div>';
c.querySelectorAll('.buy-btn').forEach(function(b){
if(b.disabled)return;
b.addEventListener('click',function(){Mall.buy(this.dataset.id,parseInt(this.dataset.cost,10));});
});
}catch(e){
console.error('商城加载失败',e);
if(c)c.innerHTML='<div class="empty-state"><div class="icon">⚠️</div><h3>商城加载失败</h3><p>'+escapeHTML(e.message||'网络异常，请稍后重试')+'</p><button class="btn btn-primary" style="margin-top:14px;" onclick="Mall.load()">重试</button></div>';
}
},
buy:async function(itemId,cost){
if(!requireAuth())return;
if(!checkSupabase())return;
try{
var itemRes=await supabaseClient.from('mall_items').select('name,icon,icon_url,stock,delivery_type,auto_content').eq('id',itemId).maybeSingle();
if(!itemRes.data){toast('商品不存在','error');return;}
var item=itemRes.data;
var stock=typeof item.stock==='number'?item.stock:-1;
if(stock!==-1&&stock<=0){toast('该商品已售罄','warning');return;}
var deliveryType=item.delivery_type||'manual';
var isAuto=deliveryType==='auto';
var pRes=await supabaseClient.from('user_points').select('points').eq('user_id',currentUser.id).maybeSingle();
var points=(pRes.data&&pRes.data.points)||0;
if(points<cost){toast('积分不足，还需要 '+(cost-points)+' 积分','warning');return;}
var contact='';
if(isAuto){
var ok=await window.liquidConfirm({type:'info',title:'确认兑换？',desc:'将消耗 '+cost+' 积分兑换「'+item.name+'」，兑换后立即发放。',confirmText:'确认兑换',confirmIcon:'fa-gift',cancelText:'取消'});
if(!ok)return;
}else{
contact=await Mall.askContact(item.name,cost,points);
if(contact===null)return;
if(!String(contact||'').trim()){toast('请填写联系方式，方便客服发放','warning');return;}
}
if(stock!==-1){
var updStock=await supabaseClient.from('mall_items').update({stock:stock-1}).eq('id',itemId).eq('stock',stock).select('stock');
if(updStock.error||!updStock.data||updStock.data.length===0){
toast('下单失败：库存已变动，请刷新重试','error');
Mall.load();
return;
}
}
var redeemRow={
user_id:currentUser.id,
item_id:itemId,
cost:cost,
item_name:item.name,
item_cost:cost,
item_icon:item.icon||'🎁',
item_icon_url:item.icon_url||'',
contact:String(contact||'').trim(),
delivery_type:deliveryType,
auto_content:isAuto?(item.auto_content||''):'',
status:isAuto?'delivered':'pending'
};
if(isAuto)redeemRow.delivered_at=new Date().toISOString();
var insRes=await supabaseClient.from('redeems').insert([redeemRow]).select().single();
if(insRes.error){
if(stock!==-1){
try{var rollback=await supabaseClient.from('mall_items').update({stock:stock}).eq('id',itemId);if(rollback.error)console.error('库存回滚失败',rollback.error);}catch(e){console.error('库存回滚异常',e);}
}
toast('兑换失败：'+insRes.error.message,'error');
return;
}
var upRes=await supabaseClient.from('user_points').upsert({user_id:currentUser.id,points:points-cost,updated_at:new Date().toISOString()},{onConflict:'user_id'});
if(upRes.error){
try{if(stock!==-1){var rb=await supabaseClient.from('mall_items').update({stock:stock}).eq('id',itemId);if(rb.error)console.error('库存回滚失败',rb.error);}await supabaseClient.from('redeems').delete().eq('id',insRes.data.id);}catch(e){console.error('兑换回滚异常',e);}
toast('扣积分失败：'+upRes.error.message,'error');
return;
}
RedeemResult.show({
isAuto:isAuto,
itemName:item.name,
cost:cost,
contact:contact,
autoContent:item.auto_content||''
});
Mall.load();
}catch(e){
console.error('商城兑换异常',e);
toast('兑换异常：'+(e.message||'请稍后重试'),'error');
}
},
askContact:function(itemName,cost,points){
return new Promise(function(resolve){
var ov=document.createElement('div');
ov.className='liquid-overlay';
ov.innerHTML='<div class="liquid-modal solid" data-type="info" style="max-width:420px;"><div class="liquid-orb liquid-orb-1"></div><div class="liquid-orb liquid-orb-2"></div><div class="liquid-content" style="text-align:left;"><div class="liquid-icon" style="margin:0 auto 16px;"><i class="fas fa-gift"></i></div><h3 class="liquid-title" style="text-align:center;">确认兑换</h3><p class="liquid-desc" style="text-align:center;margin-bottom:14px;">'+escapeHTML(itemName)+'<br><span style="font-size:.75rem;">当前 <b>'+points+'</b> 积分 → 兑换后剩余 <b>'+(points-cost)+'</b></span></p><label style="display:block;font-size:.78rem;font-weight:600;color:var(--text-secondary);margin-bottom:4px;">联系方式 <span style="color:var(--danger);">*</span></label><input type="text" id="_mallContact" class="liquid-field" placeholder="微信号 / 邮箱 / QQ" /><p style="font-size:.68rem;color:var(--text-dim);margin:8px 0 0;line-height:1.5;">💡 客服将通过此联系方式发放商品，请务必填写有效信息</p><div class="liquid-actions" style="margin-top:16px;"><button class="liquid-btn liquid-btn-cancel" id="_mallCancel" type="button">取消</button><button class="liquid-btn liquid-btn-confirm" id="_mallOk" type="button"><i class="fas fa-check"></i> 确认兑换</button></div></div></div>';
document.body.appendChild(ov);
requestAnimationFrame(function(){ov.classList.add('open');});
var inp=ov.querySelector('#_mallContact');
setTimeout(function(){inp.focus();},150);
var done=false;
function finish(v){if(done)return;done=true;ov.classList.remove('open');setTimeout(function(){if(ov.parentNode)ov.parentNode.removeChild(ov);resolve(v);},350);}
ov.querySelector('#_mallCancel').onclick=function(){finish(null);};
ov.querySelector('#_mallOk').onclick=function(){finish(inp.value||'');};
ov.onclick=function(e){if(e.target===ov)finish(null);};
inp.onkeydown=function(e){if(e.key==='Enter')finish(inp.value||'');};
});
}
};
var MyRedeems={
load:async function(){
var c=document.getElementById('myRedeemsContent');
if(!c)return;
if(!requireAuth())return;
if(!checkSupabase())return;
c.innerHTML='<div style="text-align:center;padding:40px;color:var(--text-dim);">加载中...</div>';
try{
var res=await supabaseClient.from('redeems').select('*').eq('user_id',currentUser.id).order('created_at',{ascending:false});
if(res.error)throw res.error;
var list=res.data||[];
if(!list.length){
c.innerHTML='<div class="empty-state"><div class="icon">📦</div><h3>还没有兑换记录</h3><p>去商城看看吧～</p><button class="btn btn-primary" style="margin-top:14px;" onclick="App.goMall()">前往商城</button></div>';
return;
}
var itemsRes=await supabaseClient.from('mall_items').select('id,delivery_type,auto_content');
var itemMap={};
(itemsRes.data||[]).forEach(function(it){itemMap[it.id]=it;});
list=list.map(function(r){
var it=itemMap[r.item_id];
if(it){
if(!r.delivery_type)r.delivery_type=it.delivery_type||'manual';
if(!r.auto_content)r.auto_content=it.auto_content||'';
}
if(!r.delivery_type)r.delivery_type='manual';
if(r.status!==null&&r.status!==undefined)r.status=String(r.status);else r.status='pending';
return r;
});
var stMap={pending:'待发放',delivered:'已发放',rejected:'已拒绝',done:'已发放',completed:'已发放',success:'已发放',cancelled:'已取消',failed:'已取消'};
var html='<div class="redeem-list">'+list.map(function(r){
var imgLink='';
if(r.item_icon_url&&typeof r.item_icon_url==='string'&&isImageUrl(r.item_icon_url.trim()))imgLink=r.item_icon_url.trim();
else if(r.item_icon&&typeof r.item_icon==='string'&&isImageUrl(r.item_icon.trim()))imgLink=r.item_icon.trim();
var iconHtml=imgLink
? '<img src="'+escapeAttr(imgLink)+'" alt="" loading="lazy" data-fallback="'+escapeAttr(r.item_icon||'🎁')+'" onerror="this.style.display=\'none\';this.parentElement.textContent=this.dataset.fallback||\'🎁\';">'
: escapeHTML(r.item_icon||'🎁');
var status=r.status||'pending';
var statusText=stMap[status]||'待发放';
var statusCls=status==='delivered'||status==='done'||status==='completed'||status==='success'?'delivered':(status==='rejected'||status==='cancelled'||status==='failed'?'rejected':'pending');
var actionBtn='';
if(r.delivery_type==='auto'&&r.auto_content){
actionBtn='<button class="btn btn-xs btn-primary" data-action="view-content" data-id="'+escapeAttr(r.id)+'" style="margin-top:6px;"><i class="fas fa-box-open"></i> 查看内容</button>';
}else if(status==='pending'||statusCls==='pending'){
actionBtn='<div style="font-size:.62rem;color:var(--warning);text-align:right;margin-top:6px;">请等待客服联系</div>';
}
return '<div class="redeem-item">'+
'<div class="r-icon">'+iconHtml+'</div>'+
'<div class="r-info">'+
'<div class="r-name">'+escapeHTML(r.item_name||'未知商品')+'</div>'+
'<div class="r-meta">兑换于 '+(r.created_at?new Date(r.created_at).toLocaleString('zh-CN'):'-')+'</div>'+
(r.contact?'<div class="r-meta">联系方式：'+escapeHTML(r.contact)+'</div>':'')+
(r.delivered_at&&r.delivery_type==='manual'?'<div class="r-meta">发放于 '+new Date(r.delivered_at).toLocaleString('zh-CN')+'</div>':'')+
'</div>'+
'<div class="r-right">'+
'<div class="r-cost">-'+(r.cost||0)+'</div>'+
'<span class="r-status '+statusCls+'">'+statusText+'</span>'+
actionBtn+
'</div></div>';
}).join('')+'</div>';
c.innerHTML=html;
c.querySelectorAll('[data-action="view-content"]').forEach(function(b){
b.addEventListener('click',function(){
var id=this.dataset.id;
var r=list.find(function(x){return x.id===id;});
if(!r||!r.auto_content)return;
var ov=document.createElement('div');
ov.className='liquid-overlay';
ov.innerHTML='<div class="liquid-modal solid" data-type="info" style="max-width:440px;"><div class="liquid-orb liquid-orb-1"></div><div class="liquid-orb liquid-orb-2"></div><div class="liquid-content"><div class="liquid-icon" style="margin:0 auto 16px;"><i class="fas fa-box-open"></i></div><h3 class="liquid-title" style="text-align:center;">'+escapeHTML(r.item_name||'发货内容')+'</h3><div class="liquid-content-box"><pre id="_myredeemContent" class="liquid-pre">'+escapeHTML(r.auto_content)+'</pre></div><div class="liquid-actions"><button class="liquid-btn liquid-btn-cancel" id="_myredeemClose" type="button">关闭</button><button class="liquid-btn liquid-btn-confirm" id="_myredeemCopy" type="button"><i class="fas fa-copy"></i> 复制内容</button></div></div></div>';
document.body.appendChild(ov);
requestAnimationFrame(function(){ov.classList.add('open');});
function close(){ov.classList.remove('open');setTimeout(function(){if(ov.parentNode)ov.parentNode.removeChild(ov);},350);}
ov.querySelector('#_myredeemClose').onclick=close;
ov.querySelector('#_myredeemCopy').onclick=function(){
var text=r.auto_content||'';
copyTextToClipboard(text).then(function(ok){if(ok)toast('已复制','success');else toast('复制失败，请手动选择','warning');});
};
ov.onclick=function(e){if(e.target===ov)close();};
});
});
}catch(e){
console.error('兑换记录加载失败',e);
if(c)c.innerHTML='<div class="empty-state"><div class="icon">⚠️</div><h3>加载失败</h3><p>'+(e.message||'网络异常，请稍后重试')+'</p><button class="btn btn-primary" style="margin-top:14px;" onclick="MyRedeems.load()">重试</button></div>';
}
}
};
var Notif={
_readKey:'lezhe_notif_read',_readIds:[],_rtChannel:null,_lastLoadTs:0,
addReadId:function(id){var sid=String(id);if(this._readIds.indexOf(sid)===-1){this._readIds.push(sid);if(this._readIds.length>200)this._readIds=this._readIds.slice(-200);}},
load:function(){
var _now=Date.now();
if(_now-this._lastLoadTs<300)return;
this._lastLoadTs=_now;
this._readIds=safeParse(localStorage.getItem(this._readKey),[]);
if(!checkSupabase())return;
var pAnn=supabaseClient.from('announcements').select('*').order('pinned',{ascending:false}).order('created_at',{ascending:false}).limit(30);
var pNotif=currentUser
? supabaseClient.from('notifications').select('*').eq('user_id',currentUser.id).order('created_at',{ascending:false}).limit(30)
: Promise.resolve({data:[]});
Promise.all([pAnn,pNotif]).then(function(arr){
var anns=(arr[0].data||[]).map(function(a){
return {_id:'a_'+a.id,_rawId:a.id,_type:'ann',title:sanitizeUnicode(a.title),content:sanitizeUnicode(a.content),pinned:a.pinned,level:a.level,created_at:a.created_at,is_read:Notif._readIds.indexOf(String(a.id))>-1};
});
var notifs=(arr[1].data||[]).map(function(n){
var tt=sanitizeUnicode(n.content||'');
var m=tt.match(/^【([^】]+)】([\s\S]+)$/);
return {_id:'n_'+n.id,_rawId:n.id,_type:'notif',title:m?m[1]:'系统通知',content:m?m[2]:tt,pinned:false,level:(n.type==='system'?'info':'info'),created_at:n.created_at,is_read:!!n.is_read};
});
var list=anns.concat(notifs).sort(function(a,b){return new Date(b.created_at)-new Date(a.created_at);});
Notif.render(list);
}).catch(function(){
var _nc=document.getElementById('notifList');
if(_nc)_nc.innerHTML='<div class="notif-empty">通知加载失败，请稍后重试</div>';
});
},
render:function(list){
var c=document.getElementById('notifList');if(!c)return;
if(!list.length){c.innerHTML='<div class="notif-empty">暂无通知</div>';Notif.updateBadge(0);return;}
var unread=list.filter(function(n){return !n.is_read;}).length;
Notif.updateBadge(unread);
c.innerHTML=list.map(function(n){
return '<div class="notif-item level-'+(n.level||'info')+(n.is_read?'':' unread')+'" data-id="'+escapeAttr(n._id)+'" data-rawid="'+escapeAttr(n._rawId)+'" data-type="'+n._type+'">'+
'<div class="notif-title">'+(n.pinned?'📌 ':'')+escapeHTML(n.title)+'</div>'+
(n.content?'<div class="notif-content">'+escapeHTML(n.content)+'</div>':'')+
'<div class="notif-time">'+timeAgo(n.created_at)+'</div></div>';
}).join('');
c.querySelectorAll('.notif-item').forEach(function(el){
el.addEventListener('click',function(){
var rawId=this.dataset.rawid;
var type=this.dataset.type;
var id=this.dataset.id;
var item=list.find(function(x){return x._id===id;});
if(!item)return;
if(!this.classList.contains('unread')){
Notif.showDetail(item);
return;
}
this.classList.remove('unread');
if(type==='notif'&&currentUser){
supabaseClient.from('notifications').update({is_read:true}).eq('id',rawId).eq('user_id',currentUser.id).then(function(){
var remain=document.querySelectorAll('#notifList .notif-item.unread').length;
Notif.updateBadge(remain);
});
}else{
Notif.addReadId(rawId);
try{localStorage.setItem(Notif._readKey,JSON.stringify(Notif._readIds));}catch(e){}
Notif.updateBadge();
}
Notif.showDetail(item);
});
});
},
showDetail:function(item){
var ex=document.getElementById('notifDetailOverlay');
if(ex)ex.remove();
var ov=document.createElement('div');
ov.id='notifDetailOverlay';
ov.className='notif-detail-overlay';
ov.innerHTML='<div class="notif-detail-modal">'+
'<div class="notif-detail-header">'+
'<div class="notif-detail-icon"><i class="fas fa-bell"></i></div>'+
'<div style="flex:1;min-width:0;">'+
'<div class="notif-detail-title">'+escapeHTML(item.title)+'</div>'+
'<div class="notif-detail-time">'+timeAgo(item.created_at)+'</div>'+
'</div>'+
'<button class="notif-detail-close" type="button">&times;</button>'+
'</div>'+
'<div class="notif-detail-body">'+escapeHTML(item.content||'')+'</div>'+
'</div>';
document.body.appendChild(ov);
requestAnimationFrame(function(){ov.classList.add('open');});
var onKey=function(e){if(e.key==='Escape'){close();}};
function close(){
ov.classList.remove('open');
document.removeEventListener('keydown',onKey);
setTimeout(function(){if(ov.parentNode)ov.parentNode.removeChild(ov);},320);
}
ov.querySelector('.notif-detail-close').addEventListener('click',close);
ov.addEventListener('click',function(e){if(e.target===ov)close();});
document.addEventListener('keydown',onKey);
},
updateBadge:function(count){
var b=document.getElementById('bellBadge');if(!b)return;
if(count===undefined)count=document.querySelectorAll('#notifList .notif-item.unread').length;
if(count>0){b.textContent=count>99?'99+':count;b.classList.remove('hidden');}else b.classList.add('hidden');
},
toggle:function(){
var p=document.getElementById('notifPanel');if(!p)return;
if(p.classList.contains('open')){p.classList.remove('open');return;}
p.classList.add('open');Notif.load();
},
markAllRead:function(){
document.querySelectorAll('#notifList .notif-item').forEach(function(el){
var rawId=el.dataset.rawid;
if(el.dataset.type!=='notif'){
Notif.addReadId(rawId);
}
el.classList.remove('unread');
});
try{localStorage.setItem(Notif._readKey,JSON.stringify(Notif._readIds));}catch(e){}
if(currentUser&&checkSupabase()){
supabaseClient.from('notifications').update({is_read:true}).eq('user_id',currentUser.id).eq('is_read',false).then(function(){Notif.updateBadge(0);});
}else{
Notif.updateBadge(0);
}
},
subscribeRealtime:async function(){
if(window._lezheRtDisabled||rtIsDead())return;
if(!currentUser||!checkSupabase())return;
await Notif.unsubscribeRealtime();
try{
var s=await supabaseClient.auth.getSession();
var token=s&&s.data&&s.data.session&&s.data.session.access_token;
if(token&&supabaseClient.realtime&&supabaseClient.realtime.setAuth){
await supabaseClient.realtime.setAuth(token);
}
}catch(e){}
var uid=currentUser.id;
Notif._rtChannel=supabaseClient
.channel('notif-'+uid)
.on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:'user_id=eq.'+uid},function(payload){
var b=document.getElementById('bellBadge');
var cur=parseInt((b&&b.textContent)||'0',10)||0;
Notif.updateBadge(cur+1);
var c=sanitizeUnicode((payload.new&&payload.new.content)||'');
var m=c.match(/^【([^】]+)】/);
if(typeof toast==='function')toast('📬 '+(m?sanitizeUnicode(m[1]):'新消息'),'success');
var p=document.getElementById('notifPanel');
if(p&&p.classList.contains('open'))Notif.load();
})
.subscribe(function(status){
if(status==='SUBSCRIBED'){try{localStorage.removeItem('lezhe_rt_dead');}catch(e){}console.log('[notif realtime]',status);return;}
if(rtIsError(status)){rtNoteFail();return;}
console.log('[notif realtime]',status);
});
},
unsubscribeRealtime:async function(){
if(Notif._rtChannel){
try{await supabaseClient.removeChannel(Notif._rtChannel);}catch(e){}
Notif._rtChannel=null;
}
}
};
var Compare={
_key:'lezhe_compare_list',_list:[],
init:function(){this._list=safeParse(localStorage.getItem(this._key),[]);this.renderBar();},
toggle:function(id){
var i=this._list.indexOf(id);
if(i>-1)this._list.splice(i,1);
else{if(this._list.length>=4){toast('最多同时对比 4 款','warning');return false;}this._list.push(id);}
try{localStorage.setItem(this._key,JSON.stringify(this._list));}catch(e){}
this.renderBar();
return this._list.indexOf(id)>-1;
},
clear:function(){this._list=[];try{localStorage.setItem(this._key,JSON.stringify(this._list));}catch(e){}this.renderBar();document.querySelectorAll('.compare-check.active').forEach(function(el){el.classList.remove('active');});},
renderBar:function(){
var bar=document.getElementById('compareBar');if(!bar)return;
if(!this._list.length){bar.classList.add('hidden');return;}
bar.classList.remove('hidden');
var ccEl=document.getElementById('compareCount');
if(ccEl)ccEl.textContent='已选 '+this._list.length+' 款';
var th=document.getElementById('compareThumbs');
var all=DB.getSoftware();
th.innerHTML=this._list.map(function(id){var s=all.find(function(x){return x.id===id;});if(!s)return '';return '<div class="compare-thumb">'+renderIcon(s)+'</div>';}).join('');
},
open:function(){
var all=DB.getSoftware();
var softs=this._list.map(function(id){return all.find(function(x){return x.id===id;});}).filter(Boolean);
if(softs.length<2){toast('至少选 2 款才能对比','warning');return;}
var rows=[
['名称',function(s){return '<div class="col-head">'+escapeHTML(s.name)+'</div>';}],
['图标',function(s){return '<div class="col-icon">'+renderIcon(s)+'</div>';}],
['分类',function(s){return escapeHTML(s.category||'—');}],
['版本',function(s){return 'v'+escapeHTML(s.version||'1.0');}],
['大小',function(s){return escapeHTML(s.size||'—');}],
['平台',function(s){return (s.platforms||[]).join(' / ')||'—';}],
['查看',function(s){return (s.views||0)+' 次';}],
['下载',function(s){return (s.downloads||0)+' 次';}],
['描述',function(s){return escapeHTML(sanitizeUnicode(s.description||'—'));}]
];
var html='<table class="compare-table"><thead><tr><th></th>'+softs.map(function(s){return '<th>'+escapeHTML(s.name)+'</th>';}).join('')+'</tr></thead><tbody>';
rows.forEach(function(r){
html+='<tr><th>'+r[0]+'</th>'+softs.map(function(s){return '<td>'+r[1](s)+'</td>';}).join('')+'</tr>';
});
html+='</tbody></table>';
document.getElementById('compareBody').innerHTML=html;
document.getElementById('compareModal').classList.add('open');
}
};
function attachCompareButtons(){
document.querySelectorAll('.software-card').forEach(function(card){
if(card.querySelector('.compare-check'))return;
var id=card.dataset.id;
if(!id)return;
var btn=document.createElement('button');
btn.className='compare-check'+(Compare._list.indexOf(id)>-1?' active':'');
btn.title='加入对比';
btn.innerHTML='<i class="fas fa-columns"></i>';
btn.addEventListener('click',function(e){
e.stopPropagation();
var on=Compare.toggle(id);
this.classList.toggle('active',on);
});
card.appendChild(btn);
});
}
var Share={
_soft:null,_url:'',
open:function(soft){
this._soft=soft;
var url='https://www.lezhesoft.cn/soft/'+soft.id+'.html';
this._url=url;
document.getElementById('shareTitle').textContent=sanitizeUnicode(soft.name);
var c=document.getElementById('shareQr');
var render=function(){
if(typeof qrcode==='function'){
try{var qr=qrcode(0,'M');qr.addData(url);qr.make();c.innerHTML=qr.createImgTag(6,8);return true;}
catch(e){c.innerHTML='<div style="padding:20px;color:#999;">二维码生成失败</div>';}
}else c.innerHTML='<div style="padding:20px;color:#999;">二维码加载中...</div>';
return false;
};
if(!render()&&typeof loadScript==='function'&&typeof CDNS!=='undefined'&&CDNS.qrcode){
loadScript('qrcode',orderUrls('qrcode',CDNS.qrcode),0,function(ok){if(ok)render();});
}
document.getElementById('shareModal').classList.add('open');
},
close:function(){document.getElementById('shareModal').classList.remove('open');}
};
var Collections={
load:function(){
if(!checkSupabase())return;
supabaseClient.from('collections').select('*').eq('active',true).order('sort',{ascending:true}).limit(6).then(function(res){
var list=res.data||[];
var sec=document.getElementById('collectionsSection');
var grid=document.getElementById('collectionGrid');
if(!sec||!grid||!list.length)return;
sec.classList.remove('hidden');
grid.innerHTML=list.map(function(c){
var bg='background:linear-gradient(135deg,#0077ff,#6c5ce7);';
if(c.cover&&isImageUrl(c.cover)){var safeUrl=c.cover.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\)/g,'\\)');bg='background-image:url("'+safeUrl+'");';}
return '<div class="collection-card" data-id="'+escapeAttr(c.id)+'" style="'+bg+'"><div class="cc-info"><div class="cc-title">'+escapeHTML(c.title)+'</div><div class="cc-sub">'+escapeHTML(c.subtitle||'')+'</div></div></div>';
}).join('');
grid.querySelectorAll('.collection-card').forEach(function(el){
el.addEventListener('click',function(){
var id=this.dataset.id;
var c=list.find(function(x){return x.id===id;});
if(!c)return;
Collections.openDetail(c);
});
});
});
},
openDetail:function(c){
var ids=Array.isArray(c.software_ids)?c.software_ids:(safeParse(JSON.stringify(c.software_ids),[]));
var all=DB.getSoftware();
var softs=ids.map(function(i){return all.find(function(s){return s.id===i;});}).filter(Boolean);
var c2=document.getElementById('collectionDetailBody');
if(!c2)return;
c2.innerHTML='<h2 style="margin-bottom:4px;">'+escapeHTML(c.title)+'</h2>'+
'<p style="font-size:.8rem;color:var(--text-dim);margin-bottom:14px;">'+escapeHTML(c.subtitle||'')+'</p>'+
(softs.length?'<div class="software-grid" id="collectionSoftGrid"></div>':'<div class="empty-state">该合集暂无软件</div>');
document.getElementById('collectionDetailModal').classList.add('open');
if(softs.length)Render.renderCards(document.getElementById('collectionSoftGrid'),softs,true);
}
};
var ACHIEVEMENTS=[
{id:'first_fav',name:'初次收藏',icon:'💖',desc:'收藏第 1 个软件',check:function(d){return d.favCount>=1;}},
{id:'fav10',name:'收藏达人',icon:'⭐',desc:'收藏达到 10 个软件',check:function(d){return d.favCount>=10;}},
{id:'fav30',name:'收藏狂魔',icon:'🌟',desc:'收藏达到 30 个软件',check:function(d){return d.favCount>=30;}},
{id:'view10',name:'初探门径',icon:'👀',desc:'浏览过 10 个软件',check:function(d){return d.viewCount>=10;}},
{id:'view50',name:'博览群书',icon:'📖',desc:'浏览过 50 个软件',check:function(d){return d.viewCount>=50;}},
{id:'search5',name:'寻宝猎人',icon:'🔍',desc:'搜索过 5 次',check:function(d){return d.searchCount>=5;}},
{id:'streak7',name:'周更签到',icon:'🔥',desc:'连续签到 7 天',check:function(d){return d.streak>=7;}},
{id:'streak30',name:'月更达人',icon:'🏆',desc:'连续签到 30 天',check:function(d){return d.streak>=30;}},
{id:'points100',name:'小有积蓄',icon:'💰',desc:'积分达到 100',check:function(d){return d.points>=100;}},
{id:'points500',name:'家财万贯',icon:'💎',desc:'积分达到 500',check:function(d){return d.points>=500;}},
{id:'first_redeem',name:'首次兑换',icon:'🎁',desc:'在商城完成第一次兑换',check:function(d){return d.redeemCount>=1;}},
{id:'redeem5',name:'剁手党',icon:'🛒',desc:'兑换达到 5 次',check:function(d){return d.redeemCount>=5;}}
];
var Achievement={
_key:'lezhe_achievements',
getUnlocked:function(){return safeParse(localStorage.getItem(this._key),[]);},
check:async function(){
if(!currentUser)return;
var favCount=safeParse(localStorage.getItem('lezhe_favorites'),[]).length;
var viewCount=safeParse(localStorage.getItem('lezhe_view_history'),[]).length;
var searchCount=safeParse(localStorage.getItem('lezhe_search_history'),[]).length;
var streak=0,points=0;
try{
var r=await supabaseClient.from('user_points').select('points,streak').eq('user_id',currentUser.id).maybeSingle();
if(r.data){points=r.data.points||0;streak=r.data.streak||0;}
}catch(e){}
var redeemCount=0;
try{
var rr=await supabaseClient.from('redeems').select('id').eq('user_id',currentUser.id);
redeemCount=(rr.data||[]).length;
}catch(e){}
var data={favCount:favCount,viewCount:viewCount,searchCount:searchCount,streak:streak,points:points,redeemCount:redeemCount};
var unlocked=this.getUnlocked();
var changed=false;
ACHIEVEMENTS.forEach(function(a){
if(unlocked.indexOf(a.id)===-1&&a.check(data)){unlocked.push(a.id);changed=true;toast('🏅 解锁成就：'+a.name,'success');}
});
if(changed)try{localStorage.setItem(this._key,JSON.stringify(unlocked));}catch(e){}
},
render:function(container){
if(!container)return;
var unlocked=this.getUnlocked();
container.innerHTML='<div class="achievement-grid">'+ACHIEVEMENTS.map(function(a){
var on=unlocked.indexOf(a.id)>-1;
return '<div class="achievement-item '+(on?'unlocked':'locked')+'">'+
'<div class="ach-icon">'+escapeHTML(a.icon)+'</div>'+
'<div class="ach-name">'+escapeHTML(a.name)+'</div>'+
'<div class="ach-desc">'+escapeHTML(a.desc)+'</div></div>';
}).join('')+'</div>';
}
};
/* ── 启动期导航令牌（防「骨架屏期间点了别的板块又被弹回首页」）─────────────
   冷启动时首页数据走 REST，会有 1~3 秒骨架屏；旧逻辑在数据到达后的
   requestIdleCallback 里无条件 App.goHome()，把用户已经点开的板块顶回首页。
   设计取自成熟路由库的通用做法 —— page.js 的 page.stop()、React Router
   （remix-run/react-router, MIT）「每次新导航 abort 上一笔」：给「用户最后一次
   导航」打单调递增令牌，异步收尾发现令牌变了就放弃提交。纯令牌实现，零依赖。 */
var _navSeq=0;
function _bumpNav(){_navSeq++;}
function _navStale(seq){return seq!==_navSeq;}

var App={
currentPage:'home',
currentCategory:'all',
sortBy:'date',
searchKeyword:'',
platformFilter:'all',
_scrollPos:0,
init:function(){
var self=this;
var savedSort=localStorage.getItem('lezhe_sort_by');
if(savedSort&&['date','views','downloads'].includes(savedSort)){self.sortBy=savedSort;document.getElementById('sortSelect').value=savedSort;}
var themeToggle=document.getElementById('themeToggle'),headerThemeBtn=document.getElementById('headerThemeBtn');
var savedTheme='';
try{savedTheme=localStorage.getItem('theme')||'';}catch(e){}
if(THEME_VALUES.indexOf(savedTheme)===-1){savedTheme=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';}
applyTheme(savedTheme);
if(window.matchMedia){try{window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',function(e){var stored='';try{stored=localStorage.getItem('theme')||'';}catch(err){}if(!stored)applyTheme(e.matches?'dark':'light');});}catch(err){}}
if(themeToggle)themeToggle.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();openThemePicker();});
if(headerThemeBtn)headerThemeBtn.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();openThemePicker();});
var cached=getCachedData(true);/* 首屏只吃 10 分钟内的新缓存：过期缓存不上屏（避免先旧后新），仅作断网兜底 */
var _idle=window.requestIdleCallback||function(cb){return setTimeout(cb,200);};
var _todayBox=document.getElementById('todayStackContainer');
if(_todayBox){
_todayBox.innerHTML='<div class="stack-wrapper"><div class="skeleton-card" style="height:100%;box-sizing:border-box;"></div></div>';
delete _todayBox.dataset.todaySig;
}
if(!cached){
Render.renderSkeleton(document.getElementById('recommendGrid'),6);
Render.renderSkeleton(document.getElementById('latestGrid'),6);
}else{
self.refreshAll({skipToday:true});
}
var _bootSeq=_navSeq;
DB.loadAll(!!cached).then(function(){
self.refreshAll();
window.dispatchEvent(new Event('lezhe:ready'));
_idle(function(){
renderTutorials();
renderQuestions();
/* 用户已经自己点进某个板块了 —— 启动收尾只补数据，不许再改当前页 */
if(_navStale(_bootSeq))return;
if(!handleUrlParams())App.goHome(true);
});
}).catch(function(){
var _stale=getCachedData();/* 拉新失败才回退旧缓存（断网兜底） */
if(_stale&&!window._lezheLoadFailed)self.refreshAll({skipToday:true});
window.dispatchEvent(new Event('lezhe:ready'));
});
document.querySelectorAll('.nav-links a[data-page]').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();var page=this.dataset.page;if(page==='home')self.goHome();else if(page==='list')self.goList();else if(page==='tutorials')self.goTutorials();else if(page==='qa')self.goQA();else if(page==='checkin')self.goCheckin();else if(page==='ranking')self.goRanking();else if(page==='mall')self.goMall();});});
document.querySelectorAll('#mobileBottomNav a').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();var page=this.dataset.page;if(page==='home')self.goHome();else if(page==='list')self.goList();else if(page==='tutorials')self.goTutorials();else if(page==='qa')self.goQA();else if(page==='checkin')self.goCheckin();else if(page==='ranking')self.goRanking();else if(page==='mall')self.goMall();else if(page==='profile')self.goProfile();});});
var searchInput=document.getElementById('searchInput'),searchBtn=document.getElementById('searchBtn');
if(searchBtn){searchBtn.addEventListener('click',function(){closeSearchSuggestions();self.doSearch(searchInput.value.trim());});}
if(searchInput){searchInput.addEventListener('input',function(e){if(e.isComposing)return;showSuggestions(this.value.trim());});searchInput.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.isComposing){closeSearchSuggestions();self.doSearch(this.value.trim());}});}
var sidebarSearchInput=document.getElementById('sidebarSearchInput'),sidebarSearchBtn=document.getElementById('sidebarSearchBtn');
if(sidebarSearchBtn){sidebarSearchBtn.addEventListener('click',function(){closeSearchSuggestions();self.doSearch(sidebarSearchInput.value.trim());});}
if(sidebarSearchInput){sidebarSearchInput.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.isComposing){closeSearchSuggestions();self.doSearch(this.value.trim());}});}
document.getElementById('logoHome').addEventListener('click',function(e){e.preventDefault();self.goHome();});
document.getElementById('mobileToggle').addEventListener('click',function(e){e.stopPropagation();document.getElementById('navLinks').classList.toggle('open');});
/* 移动端导航下拉：点击页面空白处自动收起 */
document.addEventListener('click',function(e){var nl=document.getElementById('navLinks'),mt=document.getElementById('mobileToggle');if(nl&&nl.classList.contains('open')&&!nl.contains(e.target)&&!(mt&&mt.contains(e.target))){nl.classList.remove('open');}});
document.addEventListener('touchstart',function(e){var nl=document.getElementById('navLinks'),mt=document.getElementById('mobileToggle');if(nl&&nl.classList.contains('open')&&!nl.contains(e.target)&&!(mt&&mt.contains(e.target))){nl.classList.remove('open');}},{passive:true});
document.getElementById('prevPageBtn').addEventListener('click',function(){if(currentPage>1){currentPage--;self.renderListPage();}});
document.getElementById('nextPageBtn').addEventListener('click',function(){var total=Math.ceil(currentFilteredList.length/PAGE_SIZE);if(currentPage<total){currentPage++;self.renderListPage();}});
document.getElementById('sortSelect').addEventListener('change',function(){self.sortBy=this.value;try{localStorage.setItem('lezhe_sort_by',self.sortBy);}catch(e){}currentPage=1;self.refreshListWithFilters();});
document.getElementById('jumpPageBtn').addEventListener('click',function(){var p=parseInt(document.getElementById('jumpPageInput').value);var total=Math.ceil(currentFilteredList.length/PAGE_SIZE);if(p>=1&&p<=total){currentPage=p;self.renderListPage();}});
document.getElementById('platformFilter').addEventListener('change',function(){self.platformFilter=this.value;currentPage=1;self.refreshListWithFilters();});
document.getElementById('resetFiltersBtn').addEventListener('click',function(){
document.getElementById('platformFilter').value='all';
self.platformFilter='all';
document.getElementById('searchInput').value='';
document.getElementById('sidebarSearchInput').value='';
self.searchKeyword='';
self.currentCategory='all';
currentPage=1;
self.refreshList(null);
self.updateSidebarHighlight(null);
var ft=document.getElementById('filterTags');
if(ft){ft.querySelectorAll('button').forEach(function(b){b.classList.remove('active');if(b.dataset.cat==='all')b.classList.add('active');});}
});
var wechatContact=document.getElementById('wechatContact');
if(wechatContact){wechatContact.addEventListener('click',function(){copyTextToClipboard('Adob_123').then(function(ok){if(ok)toast('已复制微信号: Adob_123','success');else toast('请手动复制微信号: Adob_123','warning');});});}
var wechatContact2=document.getElementById('wechatContact2');
if(wechatContact2){wechatContact2.addEventListener('click',function(){copyTextToClipboard('Adob_123').then(function(ok){if(ok)toast('已复制微信号: Adob_123','success');else toast('请手动复制微信号: Adob_123','warning');});});}
document.getElementById('newQuestionBtn').addEventListener('click',function(){if(!requireAuth())return;document.getElementById('qTitle').value='';var qe0=document.getElementById('qBody');if(qe0)qe0.innerHTML='';_qAttachments=[];renderAttachmentList('q');document.getElementById('questionModal').classList.add('open');});
document.getElementById('questionModalClose').addEventListener('click',function(){document.getElementById('questionModal').classList.remove('open');});
document.getElementById('qCancel').addEventListener('click',function(){document.getElementById('questionModal').classList.remove('open');});
function initRichToolbar(modalId){
var modal=document.getElementById(modalId);
if(!modal||modal.dataset.richInit)return;
modal.dataset.richInit='1';
var editors=modal.querySelectorAll('.rich-editor');
editors.forEach(function(editor){
var wrapper=editor.closest('.rich-editor-wrapper');
if(!wrapper)return;
var toolbar=wrapper.querySelector('.rich-toolbar');
if(!toolbar)return;
var imageUploadInput=modal.querySelector('input[type="file"][id*="ImageUpload"]');
toolbar.addEventListener('click',function(e){
var btn=e.target.closest('button[data-action]');
if(!btn)return;
e.preventDefault();
var action=btn.dataset.action;
editor.focus();
if(action==='createLink'){
var url=prompt('请输入链接地址:','https://');
if(url){document.execCommand('createLink',false,url);}
}else if(action==='insertCode'){
var selection=window.getSelection();
if(selection.rangeCount>0){
var range=selection.getRangeAt(0);
var codeText=selection.toString()||'code here';
var codeEl=document.createElement('code');
codeEl.textContent=codeText;
range.deleteContents();
range.insertNode(codeEl);
selection.removeAllRanges();
var newRange=document.createRange();
newRange.selectNodeContents(codeEl);
selection.addRange(newRange);
}
}else if(action==='insertImage'&&imageUploadInput){
imageUploadInput.click();
imageUploadInput.onchange=function(evt){
var file=evt.target.files[0];
if(!file)return;
if(!file.type.startsWith('image/')){toast('请选择图片文件','warning');return;}
if(file.size>5*1024*1024){toast('图片大小不能超过5MB','warning');return;}
var reader=new FileReader();
reader.onload=function(e){
var imgSrc=e.target.result;
compressImage(imgSrc,function(compressedSrc){
var img='<img src="'+compressedSrc+'" style="max-width:100%;height:auto;border-radius:8px;margin:8px 0;" alt="用户上传的图片" />';
document.execCommand('insertHTML',false,img);
});
};
reader.readAsDataURL(file);
imageUploadInput.value='';
};
}
else{
document.execCommand(action,false,null);
}
});
});
}
function compressImage(src,callback,maxWidth=800,quality=0.8){
var img=new Image();
img.onload=function(){
var canvas=document.createElement('canvas');
var ctx=canvas.getContext('2d');
var width=img.width;
var height=img.height;
if(width>maxWidth){height=Math.round(height*maxWidth/width);width=maxWidth;}
canvas.width=width;
canvas.height=height;
ctx.drawImage(img,0,0,width,height);
callback(canvas.toDataURL('image/jpeg',quality));
};
img.src=src;
}
initRichToolbar('questionModal');
initRichToolbar('answerModal');
function renderSensitiveWordsList(){
var list=document.getElementById('sensitiveWordsList');
if(!list)return;
document.getElementById('sensitiveWordCount').textContent=_sensitiveWords.length;
list.innerHTML=_sensitiveWords.map(function(word){
return '<span class="badge" style="background:var(--bg-secondary);color:var(--text-primary);cursor:pointer;padding:4px 10px;" title="点击删除" data-word="'+escapeAttr(word)+'">'+escapeHTML(word)+' ✕</span>';
}).join('');
}
(function(){
var list=document.getElementById('sensitiveWordsList');
if(!list||list.dataset.delInit)return;
list.dataset.delInit='1';
list.addEventListener('click',function(e){
var badge=e.target.closest('[data-word]');
if(!badge)return;
var word=badge.dataset.word;
if(confirm('确定要删除敏感词 "'+word+'" 吗？')){
_sensitiveWords=_sensitiveWords.filter(function(w){return w!==word;});
saveSensitiveWords();
renderSensitiveWordsList();
toast('已删除','success');
}
});
})();
document.getElementById('addSensitiveWordBtn').addEventListener('click',function(){
var input=document.getElementById('newSensitiveWord');
var word=input.value.trim();
if(!word){toast('请输入敏感词','warning');return;}
addSensitiveWord(word);
input.value='';
renderSensitiveWordsList();
toast('已添加','success');
});
document.getElementById('sensitiveWordsModalClose').addEventListener('click',function(){document.getElementById('sensitiveWordsModal').classList.remove('open');});
document.getElementById('sensitiveWordsClose').addEventListener('click',function(){document.getElementById('sensitiveWordsModal').classList.remove('open');});
window.openSensitiveWordsManager=function(){
loadSensitiveWords();
renderSensitiveWordsList();
document.getElementById('sensitiveWordsModal').classList.add('open');
};
var _qAttachments=[];
var _aAttachments=[];
function renderAttachmentList(prefix){
var attachments=prefix==='q'?_qAttachments:_aAttachments;
var listEl=document.getElementById(prefix+'AttachmentList');
if(!listEl)return;
if(attachments.length===0){listEl.innerHTML='';return;}
listEl.innerHTML=attachments.map(function(att,idx){
var sizeStr=att.size<1024?att.size+'B':att.size<1024*1024?(att.size/1024).toFixed(1)+'KB':(att.size/1024/1024).toFixed(1)+'MB';
return '<div class="attachment-item" style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg-secondary);border-radius:8px;margin-bottom:6px;font-size:0.85rem;"><i class="fas fa-file" style="color:var(--accent-cyan);"></i><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+escapeHTML(att.name)+'</span><span style="color:var(--text-dim);font-size:0.75rem;">'+sizeStr+'</span><button type="button" data-idx="'+idx+'" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:0.9rem;" title="删除"><i class="fas fa-times"></i></button></div>';
}).join('');
listEl.querySelectorAll('button[data-idx]').forEach(function(btn){
btn.addEventListener('click',function(){
var idx=parseInt(this.dataset.idx,10);
attachments.splice(idx,1);
renderAttachmentList(prefix);
});
});
}
function initAttachmentUpload(prefix){
var area=document.getElementById(prefix+'AttachmentArea');
var input=document.getElementById(prefix+'FileUpload');
var listEl=document.getElementById(prefix+'AttachmentList');
if(!area||!input)return;
area.addEventListener('click',function(){input.click();});
area.addEventListener('dragover',function(e){e.preventDefault();area.style.borderColor='var(--accent-cyan)';area.style.background='rgba(0,119,255,0.05)';});
area.addEventListener('dragleave',function(e){e.preventDefault();area.style.borderColor='var(--border-glow)';area.style.background='var(--bg-secondary)';});
area.addEventListener('drop',function(e){
e.preventDefault();
area.style.borderColor='var(--border-glow)';
area.style.background='var(--bg-secondary)';
var files=e.dataTransfer.files;
handleFiles(files,prefix);
});
input.addEventListener('change',function(e){
handleFiles(e.target.files,prefix);
input.value='';
});
function handleFiles(files,prefix){
var attachments=prefix==='q'?_qAttachments:_aAttachments;
Array.from(files).forEach(function(file){
if(file.size>10*1024*1024){toast('文件 '+file.name+' 超过10MB限制','warning');return;}
var reader=new FileReader();
reader.onload=function(e){
attachments.push({name:file.name,size:file.size,type:file.type,data:e.target.result});
renderAttachmentList(prefix);
};
reader.readAsDataURL(file);
});
}
}
initAttachmentUpload('q');
initAttachmentUpload('a');
document.getElementById('qSubmit').addEventListener('click',async function(){
if(this.disabled)return;
if(!requireAuth())return;
if(!checkSupabase())return;
var title=document.getElementById('qTitle').value.trim();
var editor=document.getElementById('qBody');
var bodyText=(editor.innerText||'').trim();
var body=sanitizeHTML(editor.innerHTML||'');
var category=document.getElementById('qCategory').value;
if(!title||!bodyText||!category){toast('标题、描述和分类不能为空','warning');return;}
if(containsSensitiveWords(title)||containsSensitiveWords(bodyText)){
toast('内容包含禁用词汇，请修改后重试','warning');
return;
}
title=filterSensitiveWords(title);
var attachmentsData=_qAttachments.map(function(att){return{name:att.name,size:att.size,type:att.type};});
this.disabled=true;this.textContent='提交中...';
supabaseClient.from('questions').insert([{title:title,body:body,category:category,answers_count:0,votes:0,attachments:attachmentsData}]).then(function(res){
qSubmitBtnRestore();
if(res.error){toast('提问失败：'+friendlyError(res.error),'error');return;}
toast('问题提交成功！','success');
document.getElementById('questionModal').classList.remove('open');
document.getElementById('qTitle').value='';
document.getElementById('qBody').innerHTML='';
_qAttachments=[];
renderAttachmentList('q');
renderQuestions();
}).catch(function(){qSubmitBtnRestore();});
});
function qSubmitBtnRestore(){var b=document.getElementById('qSubmit');if(b){b.disabled=false;b.innerHTML='<i class="fas fa-paper-plane"></i> 提交问题';}}
document.getElementById('answerModalClose').addEventListener('click',function(){document.getElementById('answerModal').classList.remove('open');});
document.getElementById('aCancel').addEventListener('click',function(){document.getElementById('answerModal').classList.remove('open');});
document.getElementById('aSubmit').addEventListener('click',function(){
if(!requireAuth())return;
if(!checkSupabase())return;
var qid=this.dataset.qid;
var answerEditor=document.getElementById('aBody');
var bodyText=(answerEditor.innerText||'').trim();
var body=sanitizeHTML(answerEditor.innerHTML||'');
if(!bodyText){toast('请填写回答内容','warning');return;}
if(containsSensitiveWords(bodyText)){
toast('内容包含禁用词汇，请修改后重试','warning');
return;
}
var attachmentsData=_aAttachments.map(function(att){return{name:att.name,size:att.size,type:att.type};});
supabaseClient.from('answers').insert([{question_id:qid,body:body,votes:0,attachments:attachmentsData}]).then(function(res){
if(res.error){toast('回答失败：'+friendlyError(res.error),'error');return;}
toast('回答成功！','success');
document.getElementById('answerModal').classList.remove('open');
document.getElementById('aBody').innerHTML='';
_aAttachments=[];
renderAttachmentList('a');
loadAnswers(qid);
supabaseClient.from('questions').select('answers_count').eq('id',qid).single().then(function(res2){
if(!res2.error){
var count=(parseInt(res2.data&&res2.data.answers_count,10)||0)+1;
supabaseClient.from('questions').update({answers_count:count}).eq('id',qid).then(function(){renderQuestions(null,true);});
}
});
});
});
document.getElementById('openSubmitSoftwareBtn').addEventListener('click',function(){if(!requireAuth())return;document.getElementById('submitSoftwareModal').classList.add('open');});
document.getElementById('submitSoftwareModalClose').addEventListener('click',function(){document.getElementById('submitSoftwareModal').classList.remove('open');});
document.getElementById('subCancel').addEventListener('click',function(){document.getElementById('submitSoftwareModal').classList.remove('open');});
document.getElementById('subSubmit').addEventListener('click',function(){
if(this.disabled)return;
if(!requireAuth())return;
if(!checkSupabase())return;
var name=document.getElementById('subName').value.trim();
var category=document.getElementById('subCategory').value;
var version=document.getElementById('subVersion').value.trim();
var desc=document.getElementById('subDesc').value.trim();
var platforms=document.getElementById('subPlatforms').value.split(',').map(function(p){return p.trim();}).filter(Boolean);
var downloadUrl=document.getElementById('subDownloadUrl').value.trim();
var iconUrl=document.getElementById('subIconUrl').value.trim();
var contact=document.getElementById('subContact').value.trim();
if(!name||!downloadUrl){toast('软件名称和下载链接为必填','warning');return;}
var subBtn=this;subBtn.disabled=true;subBtn.textContent='提交中...';
supabaseClient.from('software_submissions').insert([{name:name,category:category,version:version,description:desc,platforms:platforms,download_url:downloadUrl,icon_url:iconUrl,contact:contact,status:'pending',user_id:currentUser.id}]).then(function(res){
subBtn.disabled=false;subBtn.textContent='提交软件';
if(res.error){toast('提交失败：'+friendlyError(res.error),'error');return;}
toast('提交成功！等待审核','success');
document.getElementById('submitSoftwareModal').classList.remove('open');
document.getElementById('subName').value='';
document.getElementById('subVersion').value='';
document.getElementById('subDesc').value='';
document.getElementById('subPlatforms').value='';
document.getElementById('subDownloadUrl').value='';
document.getElementById('subIconUrl').value='';
document.getElementById('subContact').value='';
});
});
document.addEventListener('click',function(e){var searchWrapper=document.querySelector('.search-wrapper');if(!searchWrapper)return;if(!searchWrapper.contains(e.target))closeSearchSuggestions();});
},
goHome:function(isPop){
if(!isPop)_bumpNav();
closeSearchSuggestions();
this.currentPage='home';this.currentCategory='all';this.searchKeyword='';
document.getElementById('searchInput').value='';document.getElementById('sidebarSearchInput').value='';
['pageList','pageTutorials','pageQA','pageProfile','pageCheckin','pageRanking','pageMall','pageMyRedeems'].forEach(function(id){var el=document.getElementById(id);if(el)el.classList.add('hidden');});
document.getElementById('pageHome').classList.remove('hidden');
clearNavActive();
var homeLink=document.querySelector('.nav-links a[data-page="home"]');if(homeLink)homeLink.classList.add('active');
document.getElementById('navLinks').classList.remove('open');
this.refreshHome();
document.querySelectorAll('#mobileBottomNav a').forEach(function(a){a.classList.remove('active');});
var mbHome=document.querySelector('#mobileBottomNav a[data-page="home"]');if(mbHome)mbHome.classList.add('active');
this.updateSidebarHighlight(null);
document.getElementById('sidebarSearchWrapper').classList.remove('active');
document.getElementById('sidebarStats').style.display='block';
var ft=document.getElementById('filterTags');
if(ft){ft.querySelectorAll('button').forEach(function(b){b.classList.remove('active');if(b.dataset.cat==='all')b.classList.add('active');});}
if(isMobile()&&isOpen)closeSidebar();
if(!isPop)window.history.replaceState(null,'',window.location.pathname);
},
goList:function(cat,isPop){
if(!isPop)_bumpNav();
closeSearchSuggestions();
cat=cat||'all';
this.currentPage='list';this.currentCategory=cat;this.searchKeyword='';
document.getElementById('searchInput').value='';document.getElementById('sidebarSearchInput').value='';
['pageHome','pageTutorials','pageQA','pageProfile','pageCheckin','pageRanking','pageMall','pageMyRedeems'].forEach(function(id){var el=document.getElementById(id);if(el)el.classList.add('hidden');});
document.getElementById('pageList').classList.remove('hidden');
clearNavActive();
var listLink=document.querySelector('.nav-links a[data-page="list"]');if(listLink)listLink.classList.add('active');
document.getElementById('navLinks').classList.remove('open');
currentPage=1;
this.refreshList();
document.querySelectorAll('#mobileBottomNav a').forEach(function(a){a.classList.remove('active');});
var mbList=document.querySelector('#mobileBottomNav a[data-page="list"]');if(mbList)mbList.classList.add('active');
this.updateSidebarHighlight(cat==='all'?null:cat);
document.getElementById('sidebarSearchWrapper').classList.add('active');
document.getElementById('sidebarStats').style.display='none';
if(isMobile()&&isOpen)closeSidebar();
var ft=document.getElementById('filterTags');
if(ft){ft.querySelectorAll('button').forEach(function(b){b.classList.remove('active');if(b.dataset.cat===cat)b.classList.add('active');});
if(cat==='all'){var allBtn=ft.querySelector('button[data-cat="all"]');if(allBtn)allBtn.classList.add('active');}}
if(!isPop)window.history.pushState(null,'',window.location.pathname+'?cat='+encodeURIComponent(cat));
},
goTutorials:function(){
_bumpNav();
closeSearchSuggestions();
this.currentPage='tutorials';
['pageHome','pageList','pageQA','pageProfile','pageCheckin','pageRanking','pageMall','pageMyRedeems'].forEach(function(id){var el=document.getElementById(id);if(el)el.classList.add('hidden');});
document.getElementById('pageTutorials').classList.remove('hidden');
clearNavActive();
var tLink=document.querySelector('.nav-links a[data-page="tutorials"]');if(tLink)tLink.classList.add('active');
document.getElementById('navLinks').classList.remove('open');
document.querySelectorAll('#mobileBottomNav a').forEach(function(a){a.classList.remove('active');});
var mbT=document.querySelector('#mobileBottomNav a[data-page="tutorials"]');if(mbT)mbT.classList.add('active');
if(isMobile()&&isOpen)closeSidebar();
renderTutorials();
},
goQA:function(){
_bumpNav();
closeSearchSuggestions();
this.currentPage='qa';
['pageHome','pageList','pageTutorials','pageProfile','pageCheckin','pageRanking','pageMall','pageMyRedeems'].forEach(function(id){var el=document.getElementById(id);if(el)el.classList.add('hidden');});
document.getElementById('pageQA').classList.remove('hidden');
clearNavActive();
var qaLink=document.querySelector('.nav-links a[data-page="qa"]');if(qaLink)qaLink.classList.add('active');
document.getElementById('navLinks').classList.remove('open');
document.querySelectorAll('#mobileBottomNav a').forEach(function(a){a.classList.remove('active');});
var mbQA=document.querySelector('#mobileBottomNav a[data-page="qa"]');if(mbQA)mbQA.classList.add('active');
if(isMobile()&&isOpen)closeSidebar();
var tabsContainer=document.getElementById('qaCategoryTabs');
if(tabsContainer&&!tabsContainer.dataset.handlerAttached){
tabsContainer.dataset.handlerAttached='1';
tabsContainer.addEventListener('click',function(e){
var tab=e.target.closest('.qa-tab');
if(!tab)return;
tabsContainer.querySelectorAll('.qa-tab').forEach(function(t){t.classList.remove('active');});
tab.classList.add('active');
var cat=tab.dataset.cat;
renderQuestions(cat==='all'?null:cat);
});
}
renderQuestions();
},
goCheckin:function(isPop){
if(!isPop)_bumpNav();
closeSearchSuggestions();
this.currentPage='checkin';
['pageHome','pageList','pageTutorials','pageQA','pageProfile','pageRanking','pageMall','pageMyRedeems'].forEach(function(id){var el=document.getElementById(id);if(el)el.classList.add('hidden');});
document.getElementById('pageCheckin').classList.remove('hidden');
clearNavActive();
var l=document.querySelector('.nav-links a[data-page="checkin"]');if(l)l.classList.add('active');
document.getElementById('navLinks').classList.remove('open');
document.querySelectorAll('#mobileBottomNav a').forEach(function(a){a.classList.remove('active');});
var mb=document.querySelector('#mobileBottomNav a[data-page="checkin"]');if(mb)mb.classList.add('active');
if(isMobile()&&isOpen)closeSidebar();
Checkin.load();
if(!isPop)window.history.pushState(null,'',window.location.pathname+'?page=checkin');
},
goRanking:function(isPop){
if(!isPop)_bumpNav();
closeSearchSuggestions();
this.currentPage='ranking';
['pageHome','pageList','pageTutorials','pageQA','pageProfile','pageCheckin','pageMall','pageMyRedeems'].forEach(function(id){var el=document.getElementById(id);if(el)el.classList.add('hidden');});
document.getElementById('pageRanking').classList.remove('hidden');
clearNavActive();
var l=document.querySelector('.nav-links a[data-page="ranking"]');if(l)l.classList.add('active');
document.getElementById('navLinks').classList.remove('open');
document.querySelectorAll('#mobileBottomNav a').forEach(function(a){a.classList.remove('active');});
var mb=document.querySelector('#mobileBottomNav a[data-page="ranking"]');if(mb)mb.classList.add('active');
if(isMobile()&&isOpen)closeSidebar();
Ranking.load();
if(!isPop)window.history.pushState(null,'',window.location.pathname+'?page=ranking');
},
goMall:function(isPop){
if(!isPop)_bumpNav();
closeSearchSuggestions();
this.currentPage='mall';
['pageHome','pageList','pageTutorials','pageQA','pageProfile','pageCheckin','pageRanking','pageMyRedeems'].forEach(function(id){var el=document.getElementById(id);if(el)el.classList.add('hidden');});
document.getElementById('pageMall').classList.remove('hidden');
clearNavActive();
var l=document.querySelector('.nav-links a[data-page="mall"]');if(l)l.classList.add('active');
document.getElementById('navLinks').classList.remove('open');
document.querySelectorAll('#mobileBottomNav a').forEach(function(a){a.classList.remove('active');});
var mb=document.querySelector('#mobileBottomNav a[data-page="mall"]');if(mb)mb.classList.add('active');
if(isMobile()&&isOpen)closeSidebar();
Mall.load();
if(!isPop)window.history.pushState(null,'',window.location.pathname+'?page=mall');
},
goMyRedeems:function(isPop){
if(!isPop)_bumpNav();
closeSearchSuggestions();
if(!currentUser){toast('请先登录','warning');document.getElementById('loginModal').classList.add('open');return;}
this.currentPage='myRedeems';
['pageHome','pageList','pageTutorials','pageQA','pageProfile','pageCheckin','pageRanking','pageMall'].forEach(function(id){var el=document.getElementById(id);if(el)el.classList.add('hidden');});
document.getElementById('pageMyRedeems').classList.remove('hidden');
clearNavActive();
document.getElementById('navLinks').classList.remove('open');
if(isMobile()&&isOpen)closeSidebar();
MyRedeems.load();
if(!isPop)window.history.pushState(null,'',window.location.pathname+'?page=myRedeems');
},
goProfile:function(isPop){
if(!isPop)_bumpNav();
closeSearchSuggestions();
var targetUrl=window.location.pathname+'?page=profile';
if(!currentUser){
toast('请先登录','warning');
document.getElementById('loginModal').classList.add('open');
if(!isPop&&window.location.search!=='?page=profile'){window.history.pushState(null,'',targetUrl);}
return;
}
this.currentPage='profile';
['pageHome','pageList','pageTutorials','pageQA','pageCheckin','pageRanking','pageMall','pageMyRedeems'].forEach(function(id){var el=document.getElementById(id);if(el)el.classList.add('hidden');});
document.getElementById('pageProfile').classList.remove('hidden');
clearNavActive();
var authNav=document.getElementById('authNav');if(authNav)authNav.classList.add('active');
if(isMobile()&&isOpen)closeSidebar();
renderProfile();
setTimeout(function(){renderRecentHistory();},50);
if(!isPop&&window.location.search!=='?page=profile'){window.history.pushState(null,'',targetUrl);}
},
updateSidebarHighlight:function(cat){
var container=document.getElementById('categoryList');
if(!(container))return;
container.querySelectorAll('.category-item-side,.category-item-all').forEach(function(el){el.classList.remove('active');});
if(!cat||cat==='all'){
var allEl=container.querySelector('.category-item-all');
if(allEl){allEl.classList.add('active');requestAnimationFrame(function(){allEl.scrollIntoView({block:'nearest',behavior:'smooth'});});}
return;
}
var target=null;
container.querySelectorAll('.category-item-side').forEach(function(el){if(el.dataset.cat===cat)target=el;});
if(target){
target.classList.add('active');
var parentGroup=target.closest('.category-group');
if(parentGroup){
var header=parentGroup.querySelector('.group-header');
var items=parentGroup.querySelector('.group-items');
if(header&&items){
var gid=header.dataset.group;
var states=getGroupStates();
if(!states[gid]){states[gid]=true;saveGroupStates(states);items.classList.add('open');var icon=header.querySelector('.toggle-icon');if(icon)icon.classList.add('open');}
}
}
requestAnimationFrame(function(){target.scrollIntoView({block:'nearest',behavior:'smooth'});});
}else{
var allEl2=container.querySelector('.category-item-all');
if(allEl2){allEl2.classList.add('active');requestAnimationFrame(function(){allEl2.scrollIntoView({block:'nearest',behavior:'smooth'});});}
}
},
doSearch:function(kw,isPop){
if(!isPop)_bumpNav();
var keyword=kw||document.getElementById('searchInput').value.trim()||document.getElementById('sidebarSearchInput').value.trim();
if(!keyword){this.goHome();return;}
closeSearchSuggestions();
addSearchHistory(keyword);
this.searchKeyword=keyword;this.currentPage='list';this.currentCategory='all';
['pageHome','pageTutorials','pageQA','pageProfile','pageCheckin','pageRanking','pageMall','pageMyRedeems'].forEach(function(id){var el=document.getElementById(id);if(el)el.classList.add('hidden');});
document.getElementById('pageList').classList.remove('hidden');
clearNavActive();
var listLink=document.querySelector('.nav-links a[data-page="list"]');if(listLink)listLink.classList.add('active');
currentPage=1;
this.refreshList(keyword);
document.querySelectorAll('#mobileBottomNav a').forEach(function(a){a.classList.remove('active');});
var mbList=document.querySelector('#mobileBottomNav a[data-page="list"]');if(mbList)mbList.classList.add('active');
document.getElementById('sidebarSearchWrapper').classList.add('active');
document.getElementById('sidebarStats').style.display='none';
if(isMobile()&&isOpen)closeSidebar();
this.updateSidebarHighlight(null);
var ft=document.getElementById('filterTags');
if(ft){ft.querySelectorAll('button').forEach(function(b){b.classList.remove('active');if(b.dataset.cat==='all')b.classList.add('active');});}
document.getElementById('searchSuggestions').classList.remove('open');
document.getElementById('searchHistory').classList.remove('open');
if(!isPop)window.history.pushState(null,'',window.location.pathname+'?search='+encodeURIComponent(keyword));
},
refreshHome:function(options){
options=options||{};
var self=this;
var all=DB.getSoftware();
Render.renderAnnouncements(document.getElementById('announcementContainer'));
Render.renderCategories(document.getElementById('categoryList'),null,function(cat){self.goList(cat);});
if(!options.skipToday){
Render.renderTodayNew(document.getElementById('todayStackContainer'));
}
var _isMobileView=window.innerWidth<=768;
var _homeLimit=_isMobileView?3:6;
Render.renderCards(document.getElementById('recommendGrid'),all.filter(function(s){return s.recommend;}).slice(0,_homeLimit),true);
Render.renderCards(document.getElementById('latestGrid'),all.slice().sort(function(a,b){return new Date(b.created_at)-new Date(a.created_at);}).slice(0,_homeLimit),true);
document.getElementById('sidebarSearchWrapper').classList.remove('active');
document.getElementById('sidebarStats').style.display='block';
},
refreshList:function(keyword){
var self=this;
var all=DB.getSoftware();
var list=all.slice();
var cats=DB.getCategories();
var filterContainer=document.getElementById('filterTags');
if(filterContainer){
filterContainer.innerHTML='<button class="btn btn-sm btn-outline active" data-cat="all">全部</button>'+cats.map(function(c){return '<button class="btn btn-sm btn-outline" data-cat="'+escapeAttr(c)+'">'+escapeHTML(c)+'</button>';}).join('');
filterContainer.querySelectorAll('button').forEach(function(btn){
if(btn.dataset.cat===self.currentCategory)btn.classList.add('active');
else btn.classList.remove('active');
btn.addEventListener('click',function(){
filterContainer.querySelectorAll('button').forEach(function(b){b.classList.remove('active');});
this.classList.add('active');
self.currentCategory=this.dataset.cat;
self.searchKeyword='';
document.getElementById('searchInput').value='';
document.getElementById('sidebarSearchInput').value='';
currentPage=1;
self.refreshList();
self.updateSidebarHighlight(self.currentCategory==='all'?null:self.currentCategory);
if(isMobile()&&isOpen)closeSidebar();
});
});
}
if(keyword){var kw=keyword.toLowerCase();list=list.filter(function(s){return matchSearch(s,kw);});}
if(self.currentCategory!=='all')list=list.filter(function(s){return s.category===self.currentCategory;});
if(self.platformFilter!=='all')list=list.filter(function(s){return(s.platforms||[]).includes(self.platformFilter);});
if(self.sortBy==='views')list.sort(function(a,b){return(b.views||0)-(a.views||0);});
else if(self.sortBy==='downloads')list.sort(function(a,b){return(b.downloads||0)-(a.downloads||0);});
else list.sort(function(a,b){return new Date(b.created_at)-new Date(a.created_at);});
currentFilteredList=list;
if(keyword)document.getElementById('listSub').textContent='搜索结果: "'+keyword+'" ('+list.length+'项)';
else if(self.currentCategory!=='all')document.getElementById('listSub').textContent=self.currentCategory+' ('+list.length+'项)';
else document.getElementById('listSub').textContent='全部软件 ('+list.length+'项)';
self.renderListPage(keyword);
document.getElementById('resultCount').textContent='共 '+list.length+' 款';
document.getElementById('sidebarSearchWrapper').classList.add('active');
document.getElementById('sidebarStats').style.display='none';
},
renderListPage:function(keyword){
var total=currentFilteredList.length,totalPages=Math.ceil(total/PAGE_SIZE)||1;
if(currentPage>totalPages)currentPage=totalPages;
if(currentPage<1)currentPage=1;
var items=currentFilteredList.slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE);
var grid=document.getElementById('listGrid');
Render.renderCards(grid,items,true,keyword||this.searchKeyword);
document.getElementById('pageInfo').textContent='第 '+currentPage+' / '+totalPages+' 页';
document.getElementById('prevPageBtn').disabled=currentPage<=1;
document.getElementById('nextPageBtn').disabled=currentPage>=totalPages;
document.getElementById('jumpPageInput').value=currentPage;
document.getElementById('jumpPageInput').max=totalPages;
applyViewMode();
},
refreshListWithFilters:function(){this.refreshList(this.searchKeyword||null);},
refreshAll:function(options){
if(this.currentPage==='home')this.refreshHome(options);
else if(this.currentPage==='list')this.refreshListWithFilters();
else if(this.currentPage==='tutorials')renderTutorials();
else if(this.currentPage==='qa')renderQuestions();
else if(this.currentPage==='profile'){renderProfile();renderRecentHistory();}
else if(this.currentPage==='checkin')Checkin.load();
else if(this.currentPage==='ranking')Ranking.load();
else if(this.currentPage==='mall')Mall.load();
else if(this.currentPage==='myRedeems')MyRedeems.load();
}
};
function shareOn(platform){
var url=encodeURIComponent(window.location.href);
var title=encodeURIComponent('乐哲软件 · 精选高效工具');
var shareMap={wechat:'https://api.addthis.com/oexchange/0.8/forward/wechat/offer?url='+url+'&title='+title,weibo:'https://service.weibo.com/share/share.php?url='+url+'&title='+title+'&pic=',twitter:'https://twitter.com/intent/tweet?text='+title+'&url='+url};
if(platform==='wechat'){copyLinkText('乐哲软件 · 精选高效工具',window.location.href);toast('请复制链接后打开微信分享给好友','success');return;}
window.open(shareMap[platform],'_blank','width=600,height=500,noopener,noreferrer');
}
function copyLinkText(title,url){var text=title+'\n'+url;if(navigator.clipboard){navigator.clipboard.writeText(text).then(function(){toast('已复制标题与链接','success');});}else{var input=document.createElement('input');input.value=text;document.body.appendChild(input);input.select();document.execCommand('copy');document.body.removeChild(input);toast('已复制标题与链接','success');}}
function copyLink(){copyLinkText('乐哲软件 · 精选高效工具',window.location.href);}
async function loadUser(){
initSupabase();
if(!supabaseClient){updateUIForLoggedOut();return;}
var hash=window.location.hash||'';
var search=window.location.search||'';
if(hash.indexOf('error_description')!==-1||search.indexOf('error_description')!==-1){
try{
var hp=new URLSearchParams(hash.replace(/^#/,''));
var sp=new URLSearchParams(search);
var errMsg=hp.get('error_description')||sp.get('error_description')||'链接已失效';
showResetPwError(decodeURIComponent(errMsg.replace(/\+/g,' ')));
setTimeout(function(){var modal=document.getElementById('resetPasswordSetModal');if(modal)modal.classList.add('open');},300);
}catch(e){updateUIForLoggedOut();return;}
updateUIForLoggedOut();return;
}
try{
var sess=await supabaseClient.auth.getSession();
if(!sess.data||!sess.data.session){currentUser=null;userProfile=null;isAdmin=false;updateUIForLoggedOut();return;}
var userRes=await supabaseClient.auth.getUser();
var user=userRes.data?userRes.data.user:null;
if(user){
currentUser=user;
await loadProfile(user.id);
try{var profileRes=await supabaseClient.from('profiles').select('is_admin').eq('id',user.id).maybeSingle();isAdmin=(profileRes.data&&profileRes.data.is_admin===true);}catch(e){isAdmin=false;}
updateUIForLoggedIn(user);
}else{
currentUser=null;userProfile=null;isAdmin=false;
updateUIForLoggedOut();
}
}catch(e){
currentUser=null;userProfile=null;isAdmin=false;
updateUIForLoggedOut();
}
}
function setupAuthListener(){
initSupabase();
if(!supabaseClient)return;
supabaseClient.auth.onAuthStateChange(function(event,session){
setTimeout(async function(){
if(event==='PASSWORD_RECOVERY'&&session&&session.user){
document.querySelectorAll('.modal-overlay.open').forEach(function(m){m.classList.remove('open');});
document.getElementById('resetPasswordSetModal').classList.add('open');
document.getElementById('resetPasswordEmail').value=session.user.email||'';
document.getElementById('resetPasswordNew').value='';
document.getElementById('resetPasswordConfirm').value='';
document.getElementById('resetPwError').style.display='none';
var otpEl=document.getElementById('resetPasswordOtp');
if(otpEl&&otpEl.closest('.form-group'))otpEl.closest('.form-group').style.display='none';
var resendWrap=document.getElementById('resendResetOtpBtn');
if(resendWrap&&resendWrap.parentElement)resendWrap.parentElement.style.display='none';
var warnHint=document.querySelector('#resetPasswordSetModal .reset-hint-warn');
if(warnHint)warnHint.style.display='none';
var modalTitle=document.querySelector('#resetPasswordSetModal h3');
if(modalTitle)modalTitle.innerHTML='<i class="fas fa-key"></i> 设置新密码';
var modalDesc=document.querySelector('#resetPasswordSetModal h3 + p');
if(modalDesc)modalDesc.textContent='邮箱已验证，请设置新的登录密码。';
return;
}
if(session&&session.user){
currentUser=session.user;
await loadProfile(session.user.id);
try{var profileRes=await supabaseClient.from('profiles').select('is_admin').eq('id',session.user.id).maybeSingle();isAdmin=(profileRes.data&&profileRes.data.is_admin===true);}catch(e){isAdmin=false;}
updateUIForLoggedIn(session.user);
}else{
currentUser=null;userProfile=null;isAdmin=false;
updateUIForLoggedOut();
}
},0);
});
}
async function loadProfile(userId){
if(!userId)return;
try{
var res=await supabaseClient.from('profiles').select('*').eq('id',userId).maybeSingle();
if(res.error){userProfile=null;return;}
userProfile=res.data||null;
}catch(e){userProfile=null;}
}
function getDisplayName(){
if(userProfile&&userProfile.username)return userProfile.username;
if(currentUser&&currentUser.email)return currentUser.email.split('@')[0];
return '用户';
}
function getAvatarUrl(){if(userProfile&&userProfile.avatar_url&&userProfile.avatar_url.trim())return userProfile.avatar_url.trim();return null;}
function getEmailInitial(user){var email=(user&&user.email)||(currentUser&&currentUser.email)||'';return email?email.charAt(0).toUpperCase():'U';}
function updateUIForLoggedIn(user){
var authNav=document.getElementById('authNav');
var textSpan=document.getElementById('authNavText');
var avatarSpan=document.getElementById('authAvatar');
if(authNav){
authNav.style.display='inline-flex';
authNav.style.alignItems='center';
authNav.style.gap='6px';
var avatarUrl=getAvatarUrl();
var initial=getEmailInitial(user);
if(avatarSpan){
avatarSpan.style.display='inline-flex';
if(avatarUrl){avatarSpan.innerHTML='<img src="'+escapeAttr(avatarUrl)+'" alt="avatar" width="28" height="28" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" data-fallback="'+escapeAttr(initial)+'" onerror="this.parentElement.textContent=this.dataset.fallback;">';}
else{avatarSpan.textContent=initial;}
}
if(textSpan){textSpan.style.display='none';textSpan.textContent='';}
authNav.classList.add('avatar-only');
authNav.title='个人中心 · '+getDisplayName();
authNav.onclick=function(e){e.preventDefault();App.goProfile();};
}
document.querySelectorAll('#mobileBottomNav a').forEach(function(a){if(a.dataset.page==='profile')a.style.display='flex';});
Notif.load();
Notif.subscribeRealtime();
}
function updateUIForLoggedOut(){
var authNav=document.getElementById('authNav');
var textSpan=document.getElementById('authNavText');
var avatarSpan=document.getElementById('authAvatar');
if(authNav){
authNav.style.display='inline-flex';
authNav.style.alignItems='center';
authNav.style.gap='6px';
if(avatarSpan){avatarSpan.style.display='none';avatarSpan.innerHTML='';}
authNav.classList.remove('avatar-only');
authNav.title='';
if(textSpan){textSpan.style.display='';textSpan.textContent='登录';}
authNav.onclick=function(e){e.preventDefault();document.getElementById('loginModal').classList.add('open');};
}
document.querySelectorAll('#mobileBottomNav a').forEach(function(a){if(a.dataset.page==='profile')a.style.display='none';});
Notif.unsubscribeRealtime();
var _bb=document.getElementById('bellBadge');if(_bb)_bb.classList.add('hidden');
}
function setLoginLoading(loading){var btn=document.getElementById('loginBtn');var text=document.getElementById('loginBtnText');var spinner=document.getElementById('loginSpinner');if(!btn)return;btn.disabled=loading;if(loading){text.textContent='登录中...';spinner.style.display='inline';}else{text.textContent='登 录';spinner.style.display='none';}}
function setRegisterLoading(loading){var btn=document.getElementById('registerBtn');var text=document.getElementById('registerBtnText');var spinner=document.getElementById('registerSpinner');if(!btn)return;btn.disabled=loading;if(loading){text.textContent='注册中...';spinner.style.display='inline';}else{text.textContent='注 册';spinner.style.display='none';}}
function showLoginError(msg){var el=document.getElementById('loginError');if(el){el.textContent=sanitizeUnicode(msg);el.style.display='block';}}
function showRegisterError(msg){var el=document.getElementById('registerError');if(el){el.textContent=sanitizeUnicode(msg);el.style.display='block';}}
function hideLoginError(){var el=document.getElementById('loginError');if(el)el.style.display='none';}
function hideRegisterError(){var el=document.getElementById('registerError');if(el)el.style.display='none';}
function validateEmail(email){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);}
function validatePasswordStrength(pw){if(pw.length<8)return '密码至少8位';if(!/[a-z]/.test(pw))return '密码需包含小写字母';if(!/[A-Z]/.test(pw))return '密码需包含大写字母';if(!/\d/.test(pw))return '密码需包含数字';return null;}
function friendlyError(err){if(!err)return '操作失败，请稍后重试';var msg=(err.message||err.error_description||String(err)).toLowerCase();var status=err.status||err.statusCode;if(status===429||/rate limit|too many|overloaded/i.test(msg))return '操作过于频繁，请稍后再试';if(status===408||/timeout|timed out|network|fetch failed|failed to fetch|load failed/i.test(msg))return '网络连接超时，请检查网络后重试';if(/invalid login credentials|invalid credentials/i.test(msg))return '邮箱或密码错误';if(/email not confirmed|email_confirm/i.test(msg))return '邮箱尚未验证，请先查收验证邮件';if(/user already registered|already registered/i.test(msg))return '该邮箱已注册，请直接登录';if(/invalid token|otp expired|token expired|verification code/i.test(msg))return '验证码错误或已过期，请重新获取';if(/weak password/i.test(msg))return '密码强度不足，请使用更复杂的密码';if(/email/i.test(msg)&&/invalid/i.test(msg))return '邮箱格式不正确';if(/auth/i.test(msg)&&/session/i.test(msg))return '登录状态已过期，请重新登录';if(/permission/i.test(msg)||/not authorized/i.test(msg))return '没有权限执行此操作';if(/connection|network|cors|failed to fetch/i.test(msg))return '网络连接失败，请检查网络后重试';return '操作失败，请稍后重试';}
function passwordScore(pw){if(!pw)return 0;var s=0;if(pw.length>=8)s++;if(pw.length>=12)s++;if(/[a-z]/.test(pw)&&/[A-Z]/.test(pw))s++;if(/\d/.test(pw))s++;if(/[^a-zA-Z0-9]/.test(pw))s++;return s;}
function renderStrengthBar(inputId,barId,labelId){var input=document.getElementById(inputId);if(!input)return;input.addEventListener('input',function(){var pw=this.value;var bar=document.getElementById(barId);var label=document.getElementById(labelId);if(!bar||!label)return;var score=passwordScore(pw);var labels=['','弱','一般','较强','强','强'];var colors=['','#e74c3c','#f39c12','#3498db','#2ecc71','#2ecc71'];if(!pw){bar.style.display='none';label.textContent='';return;}bar.style.display='flex';var segments=bar.querySelectorAll('.strength-seg');for(var i=0;i<segments.length;i++){segments[i].style.background=i<score?colors[score]:'var(--border-glow)';}label.textContent=labels[score]||'';label.style.color=colors[score]||'';});}
function setResetLoading(loading){var btn=document.getElementById('resetPasswordBtn');var text=document.getElementById('resetBtnText');var spinner=document.getElementById('resetSpinner');if(!btn)return;btn.disabled=loading;if(loading){text.textContent='发送中...';spinner.style.display='inline';}else{text.textContent='发送重置邮件';spinner.style.display='none';}}
function showResetError(msg){var el=document.getElementById('resetError');if(el){el.textContent=sanitizeUnicode(msg);el.style.display='block';}}
function hideResetError(){var el=document.getElementById('resetError');if(el)el.style.display='none';}
function showResetSuccess(msg){var el=document.getElementById('resetSuccess');if(el){el.textContent=msg;el.style.display='block';}}
function hideResetSuccess(){var el=document.getElementById('resetSuccess');if(el)el.style.display='none';}
function setChangePwLoading(loading){var btn=document.getElementById('changePasswordBtn');var text=document.getElementById('changePwBtnText');var spinner=document.getElementById('changePwSpinner');if(!btn)return;btn.disabled=loading;if(loading){text.textContent='修改中...';spinner.style.display='inline';}else{text.textContent='修改密码';spinner.style.display='none';}}
function showChangePwError(msg){var el=document.getElementById('changePwError');if(el){el.textContent=sanitizeUnicode(msg);el.style.display='block';}}
function hideChangePwError(){var el=document.getElementById('changePwError');if(el)el.style.display='none';}
function setResetPwLoading(loading){var btn=document.getElementById('resetPasswordSetBtn');var text=document.getElementById('resetPwBtnText');var spinner=document.getElementById('resetPwSpinner');if(!btn)return;btn.disabled=loading;if(loading){text.textContent='修改中...';spinner.style.display='inline';}else{text.textContent='确认修改';spinner.style.display='none';}}
function showResetPwError(msg){var el=document.getElementById('resetPwError');if(el){el.textContent=sanitizeUnicode(msg);el.style.display='block';}}
function hideResetPwError(){var el=document.getElementById('resetPwError');if(el)el.style.display='none';}
var resendCountdownTimer=null;
function startResendCountdown(seconds){var btn=document.getElementById('resendResetOtpBtn');var cd=document.getElementById('resendCountdown');var secEl=document.getElementById('resendSeconds');if(!btn||!cd||!secEl)return;if(resendCountdownTimer){clearInterval(resendCountdownTimer);resendCountdownTimer=null;}seconds=typeof seconds==='number'?seconds:300;if(seconds<=0){btn.style.display='inline';cd.style.display='none';btn.disabled=false;return;}var remaining=seconds;btn.style.display='none';cd.style.display='inline';secEl.textContent=remaining;resendCountdownTimer=setInterval(function(){remaining--;if(remaining<=0){clearInterval(resendCountdownTimer);resendCountdownTimer=null;btn.style.display='inline';cd.style.display='none';btn.disabled=false;}else{secEl.textContent=remaining;}},1000);}
function stopResendCountdown(){if(resendCountdownTimer){clearInterval(resendCountdownTimer);resendCountdownTimer=null;}var btn=document.getElementById('resendResetOtpBtn');var cd=document.getElementById('resendCountdown');if(btn){btn.style.display='inline';btn.disabled=false;}if(cd)cd.style.display='none';}
var _resendBtn=document.getElementById('resendResetOtpBtn');
if(_resendBtn)_resendBtn.addEventListener('click',async function(){
if(!checkSupabase())return;
var email=document.getElementById('resetPasswordEmail').value.trim();
if(!email||!validateEmail(email)){showResetPwError('请先填写有效的邮箱地址');return;}
var lastTs=parseInt(localStorage.getItem('lezhe_reset_ts_'+email)||'0',10);
var elapsed=Date.now()-lastTs;
if(elapsed<RESET_COOLDOWN_MS){var left=Math.ceil((RESET_COOLDOWN_MS-elapsed)/1000);showResetPwError('请求过于频繁，请等待 '+left+' 秒后再试');return;}
var btn=this;btn.disabled=true;var originalText=btn.textContent;btn.textContent='发送中...';
try{
var res=await supabaseClient.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+window.location.pathname});
btn.disabled=false;btn.textContent=originalText;
if(res.error){
var isRate=res.error.status===429||/rate limit/i.test(res.error.message)||/too many/i.test(res.error.message);
if(isRate){try{localStorage.setItem('lezhe_reset_ts_'+email,Date.now());}catch(e){}showResetPwError('邮件发送过于频繁，请稍后再试');startResendCountdown(300);return;}
showResetPwError(friendlyError(res.error));return;
}
try{localStorage.setItem('lezhe_reset_ts_'+email,Date.now());}catch(e){}
hideResetPwError();toast('验证码已重新发送，请查收垃圾箱 📧','success');
document.getElementById('resetPasswordOtp').value='';
document.getElementById('resetPasswordOtp').focus();
startResendCountdown(300);
}catch(err){btn.disabled=false;btn.textContent=originalText;showResetPwError('网络异常，请稍后重试');}
});
var _toggleLoginPwd=document.getElementById('toggleLoginPwd');
if(_toggleLoginPwd)_toggleLoginPwd.addEventListener('click',function(){var input=document.getElementById('loginPassword');input.type=input.type==='password'?'text':'password';this.textContent=input.type==='password'?'👁️':'🙈';});
var _toggleRegPwd=document.getElementById('toggleRegPwd');
if(_toggleRegPwd)_toggleRegPwd.addEventListener('click',function(){var input=document.getElementById('registerPassword');input.type=input.type==='password'?'text':'password';this.textContent=input.type==='password'?'👁️':'🙈';});
var _toggleRegPwdConfirm=document.getElementById('toggleRegPwdConfirm');
if(_toggleRegPwdConfirm)_toggleRegPwdConfirm.addEventListener('click',function(){var input=document.getElementById('registerPasswordConfirm');input.type=input.type==='password'?'text':'password';this.textContent=input.type==='password'?'👁️':'🙈';});
var _loginBtn=document.getElementById('loginBtn');
if(_loginBtn)_loginBtn.addEventListener('click',async function(){
if(this.disabled)return;
if(!checkSupabase())return;
var email=document.getElementById('loginEmail').value.trim();
var password=document.getElementById('loginPassword').value.trim();
hideLoginError();
if(!email||!password){showLoginError('请填写完整的邮箱和密码');return;}
if(!validateEmail(email)){showLoginError('请输入有效的邮箱地址');return;}
setLoginLoading(true);
var res=await supabaseClient.auth.signInWithPassword({email:email,password:password});
setLoginLoading(false);
if(res.error){showLoginError(friendlyError(res.error));return;}
toast('登录成功！欢迎回来 🎉','success');
document.getElementById('loginModal').classList.remove('open');
if(res.data&&res.data.user){
currentUser=res.data.user;
await loadProfile(res.data.user.id);
updateUIForLoggedIn(res.data.user);
}
if(App&&App.refreshAll)App.refreshAll();
Achievement.check();
setTimeout(function(){
try{
var p=new URLSearchParams(window.location.search);
if(p.get('page')==='profile'&&currentUser){App.goProfile(true);}
if(p.get('page')==='myRedeems'&&currentUser){App.goMyRedeems(true);}
}catch(e){}
},350);
});
var _registerBtn=document.getElementById('registerBtn');
if(_registerBtn)_registerBtn.addEventListener('click',async function(){
if(this.disabled)return;
if(!checkSupabase())return;
var email=document.getElementById('registerEmail').value.trim();
var password=document.getElementById('registerPassword').value.trim();
var confirm=document.getElementById('registerPasswordConfirm').value.trim();
var agree=document.getElementById('agreeTerms').checked;
hideRegisterError();
if(!email||!password||!confirm){showRegisterError('请填写所有字段');return;}
if(!validateEmail(email)){showRegisterError('请输入有效的邮箱地址');return;}
var pwError=validatePasswordStrength(password);
if(pwError){showRegisterError(pwError);return;}
if(password!==confirm){showRegisterError('两次输入的密码不一致');return;}
if(!agree){showRegisterError('请先同意用户协议和隐私政策');return;}
setRegisterLoading(true);
var res=await supabaseClient.auth.signUp({email:email,password:password});
setRegisterLoading(false);
if(res.error){showRegisterError(friendlyError(res.error));return;}
if(res.data&&res.data.user&&res.data.user.identities&&res.data.user.identities.length===0){
toast('该邮箱已注册，请直接登录','warning');
document.getElementById('registerModal').classList.remove('open');
document.getElementById('loginModal').classList.add('open');
return;
}
var needsConfirm=!(res.data&&res.data.session);
toast(needsConfirm?'注册成功！请查收验证邮件完成激活（含垃圾箱）📧':'注册成功！已自动登录','success');
document.getElementById('registerModal').classList.remove('open');
if(App&&App.refreshAll)App.refreshAll();
});
var _loginEmail=document.getElementById('loginEmail');
if(_loginEmail)_loginEmail.addEventListener('keydown',function(e){if(e.key==='Enter'){var b=document.getElementById('loginBtn');if(b)b.click();}});
var _loginPwd=document.getElementById('loginPassword');
if(_loginPwd)_loginPwd.addEventListener('keydown',function(e){if(e.key==='Enter'){var b=document.getElementById('loginBtn');if(b)b.click();}});
var _regEmail=document.getElementById('registerEmail');
if(_regEmail)_regEmail.addEventListener('keydown',function(e){if(e.key==='Enter'){var b=document.getElementById('registerBtn');if(b)b.click();}});
var _regPwd=document.getElementById('registerPassword');
if(_regPwd)_regPwd.addEventListener('keydown',function(e){if(e.key==='Enter'){var b=document.getElementById('registerBtn');if(b)b.click();}});
var _regPwdConfirm=document.getElementById('registerPasswordConfirm');
if(_regPwdConfirm)_regPwdConfirm.addEventListener('keydown',function(e){if(e.key==='Enter'){var b=document.getElementById('registerBtn');if(b)b.click();}});
var _switchToRegister=document.getElementById('switchToRegister');
if(_switchToRegister)_switchToRegister.addEventListener('click',function(e){e.preventDefault();document.getElementById('loginModal').classList.remove('open');document.getElementById('registerModal').classList.add('open');});
var _switchToLogin=document.getElementById('switchToLogin');
if(_switchToLogin)_switchToLogin.addEventListener('click',function(e){e.preventDefault();document.getElementById('registerModal').classList.remove('open');document.getElementById('loginModal').classList.add('open');});
var _forgotPw=document.getElementById('forgotPasswordLink');
if(_forgotPw)_forgotPw.addEventListener('click',function(e){e.preventDefault();document.getElementById('loginModal').classList.remove('open');document.getElementById('resetPasswordModal').classList.add('open');hideResetError();hideResetSuccess();document.getElementById('resetEmail').value='';});
var _resetPwBtn=document.getElementById('resetPasswordBtn');
if(_resetPwBtn)_resetPwBtn.addEventListener('click',async function(){
if(this.disabled)return;
if(!checkSupabase())return;
var email=document.getElementById('resetEmail').value.trim();
hideResetError();hideResetSuccess();
if(!email){showResetError('请输入邮箱地址');return;}
if(!validateEmail(email)){showResetError('请输入有效的邮箱地址');return;}
var lastTs=parseInt(localStorage.getItem('lezhe_reset_ts_'+email)||'0',10);
var elapsed=Date.now()-lastTs;
if(elapsed<RESET_COOLDOWN_MS){var left=Math.ceil((RESET_COOLDOWN_MS-elapsed)/1000);showResetError('请求过于频繁，请等待 '+left+' 秒后再试');return;}
setResetLoading(true);
try{
var res=await supabaseClient.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+window.location.pathname});
setResetLoading(false);
if(res.error){
var isRate=res.error.status===429||/rate limit/i.test(res.error.message)||/too many/i.test(res.error.message);
if(isRate){try{localStorage.setItem('lezhe_reset_ts_'+email,Date.now());}catch(e){}showResetError('邮件发送过于频繁，请等待 5-10 分钟后再试');return;}
showResetError(friendlyError(res.error));return;
}
try{localStorage.setItem('lezhe_reset_ts_'+email,Date.now());}catch(e){}
document.getElementById('resetPasswordModal').classList.remove('open');
document.getElementById('resetPasswordSetModal').classList.add('open');
document.getElementById('resetPasswordEmail').value=email;
document.getElementById('resetPasswordOtp').value='';
document.getElementById('resetPasswordNew').value='';
document.getElementById('resetPasswordConfirm').value='';
document.getElementById('resetPwError').style.display='none';
var otpEl=document.getElementById('resetPasswordOtp');
if(otpEl&&otpEl.closest('.form-group'))otpEl.closest('.form-group').style.display='';
var resendWrap=document.getElementById('resendResetOtpBtn');
if(resendWrap&&resendWrap.parentElement)resendWrap.parentElement.style.display='';
var warnHint=document.querySelector('#resetPasswordSetModal .reset-hint-warn');
if(warnHint)warnHint.style.display='';
var modalTitle=document.querySelector('#resetPasswordSetModal h3');
if(modalTitle)modalTitle.innerHTML='<i class="fas fa-key"></i> 重置密码';
var modalDesc=document.querySelector('#resetPasswordSetModal h3 + p');
if(modalDesc)modalDesc.textContent='请输入您收到的验证码，并设置新密码。';
document.getElementById('resetPasswordOtp').focus();
toast('重置邮件已发送，请查收（含垃圾箱）📧','success');
startResendCountdown(300);
}catch(err){setResetLoading(false);showResetError('网络异常，请稍后重试');}
});
var _profileLogoutBtn=document.getElementById('profileLogoutBtn');
if(_profileLogoutBtn)_profileLogoutBtn.addEventListener('click',async function(){
if(!checkSupabase())return;
var ok=await window.liquidConfirm({type:'danger',title:'确定退出登录？',desc:'退出后需要重新登录才能访问个人中心、签到、排行榜等功能。',confirmText:'确认退出',confirmIcon:'fa-sign-out-alt',cancelText:'再想想'});
if(!ok)return;
var res=await supabaseClient.auth.signOut();
if(res.error){toast('退出失败','error');return;}
toast('已安全退出','success');
setTimeout(function(){App.goHome();},200);
});
async function saveProfile(username,avatar_url,bio){
if(!currentUser)return;
var payload={id:currentUser.id};
if(username!==undefined)payload.username=username.trim()||null;
if(avatar_url!==undefined)payload.avatar_url=avatar_url.trim()||null;
if(bio!==undefined)payload.bio=bio.trim()||null;
payload.updated_at=new Date().toISOString();
var res=await supabaseClient.from('profiles').upsert(payload,{onConflict:'id'});
if(res.error)throw res.error;
await loadProfile(currentUser.id);
}
var _editProfileSave=document.getElementById('editProfileSave');
if(_editProfileSave)_editProfileSave.addEventListener('click',async function(){
if(!checkSupabase())return;
var username=document.getElementById('editUsername').value.trim();
var avatar=document.getElementById('editAvatar').value.trim();
var bio=document.getElementById('editBio').value.trim();
var errorEl=document.getElementById('editProfileError');
errorEl.style.display='none';
try{
await saveProfile(username||undefined,avatar||undefined,bio||undefined);
toast('资料更新成功','success');
document.getElementById('editProfileModal').classList.remove('open');
renderProfile();
renderRecentHistory();
updateUIForLoggedIn(currentUser);
}catch(e){errorEl.textContent=friendlyError(e);errorEl.style.display='block';}
});
var _editProfileCancel=document.getElementById('editProfileCancel');
if(_editProfileCancel)_editProfileCancel.addEventListener('click',function(){document.getElementById('editProfileError').style.display='none';document.getElementById('editProfileModal').classList.remove('open');});
var _loginModalClose=document.getElementById('loginModalClose');
if(_loginModalClose)_loginModalClose.addEventListener('click',function(){hideLoginError();document.getElementById('loginModal').classList.remove('open');});
var _registerModalClose=document.getElementById('registerModalClose');
if(_registerModalClose)_registerModalClose.addEventListener('click',function(){hideRegisterError();document.getElementById('registerModal').classList.remove('open');});
var _resetPasswordModalClose=document.getElementById('resetPasswordModalClose');
if(_resetPasswordModalClose)_resetPasswordModalClose.addEventListener('click',function(){hideResetError();hideResetSuccess();document.getElementById('resetPasswordModal').classList.remove('open');});
var _changePasswordModalClose=document.getElementById('changePasswordModalClose');
if(_changePasswordModalClose)_changePasswordModalClose.addEventListener('click',function(){hideChangePwError();document.getElementById('changePasswordModal').classList.remove('open');});
var _editProfileModalClose=document.getElementById('editProfileModalClose');
if(_editProfileModalClose)_editProfileModalClose.addEventListener('click',function(){document.getElementById('editProfileError').style.display='none';document.getElementById('editProfileModal').classList.remove('open');});
function renderProfile(){
var container=document.getElementById('profileContent');
if(!container)return;
if(!currentUser){container.innerHTML='<p style="color:var(--text-secondary);padding:20px;text-align:center;">请先登录</p>';return;}
var favorites=safeParse(localStorage.getItem('lezhe_favorites'),[]);
var history=safeParse(localStorage.getItem('lezhe_view_history'),[]);
var favSoft=cache.software.filter(function(s){return favorites.includes(s.id);});
var histSoft=cache.software.filter(function(s){return history.includes(s.id);});
var totalDownloads=0;
cache.software.forEach(function(s){totalDownloads+=(s.downloads||0);});
var avatarUrl=getAvatarUrl();
var displayName=getDisplayName();
var bio=(userProfile&&userProfile.bio)||'';
var emailStr=currentUser.email||'';
var emailInitial=escapeHTML(getEmailInitial(currentUser));
var avatarHtml=avatarUrl?'<img src="'+escapeAttr(avatarUrl)+'" alt="avatar" width="68" height="68" style="width:100%;height:100%;object-fit:cover;" data-fallback="'+escapeAttr(getEmailInitial(currentUser))+'" onerror="this.parentElement.textContent=this.dataset.fallback;">':emailInitial;
var createdAt=currentUser.created_at||new Date().toISOString();
container.innerHTML='<div class="profile-wrap">'+
'<div class="profile-card pf-side">'+
'<div class="pf-cover"><span class="pf-orb"></span></div>'+
'<div class="pf-id">'+
'<div class="pf-ava">'+avatarHtml+'</div>'+
'<h3>'+escapeHTML(displayName)+'</h3>'+
'<p class="email"><i class="far fa-envelope"></i> '+escapeHTML(emailStr||'未绑定邮箱')+'</p>'+
(bio?'<p class="bio">'+escapeHTML(bio)+'</p>':'')+
'<div class="ph-chips"><span class="ph-chip"><i class="far fa-calendar-alt"></i> 注册于 '+new Date(createdAt).toLocaleDateString()+'</span></div>'+
'<div class="pf-stats">'+
'<div class="pf-stat"><div class="pf-num">'+favSoft.length+'</div><div class="pf-lab">收藏</div></div>'+
'<div class="pf-stat"><div class="pf-num">'+histSoft.length+'</div><div class="pf-lab">浏览记录</div></div>'+
'<div class="pf-stat"><div class="pf-num">'+totalDownloads+'</div><div class="pf-lab">总下载</div></div>'+
'</div>'+
'<div class="pf-menu">'+
'<button class="pf-mi hot" id="editProfileBtn"><span class="mi-ico ico-cyan"><i class="fas fa-user-edit"></i></span><span>编辑资料</span><i class="fas fa-chevron-right mi-arrow"></i></button>'+
'<button class="pf-mi" id="changePasswordNavBtn"><span class="mi-ico ico-gold"><i class="fas fa-key"></i></span><span>修改密码</span><i class="fas fa-chevron-right mi-arrow"></i></button>'+
'<button class="pf-mi" id="myRedeemsBtn"><span class="mi-ico ico-purple"><i class="fas fa-box-open"></i></span><span>我的兑换</span><i class="fas fa-chevron-right mi-arrow"></i></button>'+
'<button class="pf-mi" id="exportDataBtn"><span class="mi-ico ico-danger"><i class="fas fa-download"></i></span><span>导出数据</span><i class="fas fa-chevron-right mi-arrow"></i></button>'+
'<button class="pf-mi" id="importDataBtn"><span class="mi-ico ico-cyan"><i class="fas fa-upload"></i></span><span>导入数据</span><i class="fas fa-chevron-right mi-arrow"></i></button>'+
'<input type="file" id="importDataInput" accept=".json,application/json" style="display:none;">'+
'</div>'+
'</div></div>'+
'<div class="pf-main">'+
'<div class="profile-two-col">'+
'<div class="profile-list-box">'+
'<div class="plb-head"><span class="plb-ico ico-danger"><i class="fas fa-heart"></i></span><h4>我的收藏</h4><span class="plb-count">'+favSoft.length+' 款</span></div>'+
'<div class="list-content">'+(favSoft.length?favSoft.map(function(s,idx){return '<div class="list-row"><a href="#" data-id="'+escapeAttr(s.id)+'" class="profile-link"><span class="row-idx">'+(idx+1)+'</span>'+(isSoftUpdated(s)?'<span class="row-new">NEW</span>':'')+'<span class="row-name">'+escapeHTML(s.name)+'</span></a></div>';}).join(''):'<div class="empty-tip"><i class="far fa-heart"></i><p>还没有收藏的软件</p><a href="#" class="empty-cta" data-goto="list">去发现好软件</a></div>')+'</div>'+
'</div>'+
'<div class="profile-list-box">'+
'<div class="plb-head"><span class="plb-ico ico-cyan"><i class="fas fa-history"></i></span><h4>浏览历史</h4><span class="plb-count">'+histSoft.length+' 条</span></div>'+
'<div class="list-content">'+(histSoft.length?histSoft.map(function(s,idx){return '<div class="list-row"><a href="#" data-id="'+escapeAttr(s.id)+'" class="profile-link"><span class="row-idx">'+(idx+1)+'</span><span class="row-name">'+escapeHTML(s.name)+'</span></a></div>';}).join(''):'<div class="empty-tip"><i class="fas fa-history"></i><p>暂无浏览记录</p><a href="#" class="empty-cta" data-goto="list">去逛逛软件库</a></div>')+'</div>'+
(histSoft.length?'<div class="plb-foot"><button class="ph-btn" id="clearHistoryBtn"><i class="fas fa-trash-alt"></i> 清空历史</button></div>':'')+
'</div>'+
'</div>'+
'<div class="profile-card"><div class="plb-head"><span class="plb-ico ico-gold"><i class="fas fa-medal"></i></span><h4>我的成就</h4><span class="plb-count" id="achCount"></span></div><div id="profileAchievements"></div></div>'+
'<div class="profile-card hidden" id="profileRecentSection">'+
'<div class="plb-head"><span class="plb-ico ico-cyan"><i class="fas fa-clock"></i></span><h4>最近浏览</h4></div>'+
'<div class="profile-recent-grid" id="profileRecentGrid"></div>'+
'</div>'+
'</div>'+
'</div>';
document.querySelectorAll('.empty-cta').forEach(function(a){
a.addEventListener('click',function(e){e.preventDefault();App.goList();});
});
var _achCount=document.getElementById('achCount');
if(_achCount)_achCount.textContent=Achievement.getUnlocked().length+' / '+ACHIEVEMENTS.length;
document.querySelectorAll('.profile-link').forEach(function(a){
a.addEventListener('click',function(e){
e.preventDefault();
var id=this.dataset.id;
var soft=cache.software.find(function(s){return s.id===id;});
if(soft){App.goHome();setTimeout(function(){Detail.open(soft);},200);}
});
});
document.getElementById('editProfileBtn').addEventListener('click',function(){
document.getElementById('editUsername').value=(userProfile&&userProfile.username)||'';
document.getElementById('editAvatar').value=(userProfile&&userProfile.avatar_url)||'';
document.getElementById('editBio').value=(userProfile&&userProfile.bio)||'';
document.getElementById('editProfileError').style.display='none';
document.getElementById('editProfileModal').classList.add('open');
});
document.getElementById('changePasswordNavBtn').addEventListener('click',function(){
document.getElementById('changePasswordModal').classList.add('open');
hideChangePwError();
document.getElementById('oldPassword').value='';
document.getElementById('newPassword').value='';
document.getElementById('newPasswordConfirm').value='';
});
document.getElementById('myRedeemsBtn').addEventListener('click',function(){App.goMyRedeems();});
var _clearHisBtn=document.getElementById('clearHistoryBtn');
_clearHisBtn&&_clearHisBtn.addEventListener('click',async function(){
var ok=await window.liquidConfirm({type:'warning',title:'清空浏览历史？',desc:'所有浏览记录将被删除，此操作不可恢复。',confirmText:'清空',confirmIcon:'fa-trash-alt',cancelText:'取消'});
if(!ok)return;
try{localStorage.setItem('lezhe_view_history',JSON.stringify([]));}catch(e){}
viewHistory=[];
renderProfile();
renderRecentHistory();
toast('浏览历史已清空','success');
});
document.getElementById('exportDataBtn').addEventListener('click',exportUserData);
document.getElementById('importDataBtn').addEventListener('click',function(){document.getElementById('importDataInput').click();});
document.getElementById('importDataInput').addEventListener('change',function(e){var file=e.target.files&&e.target.files[0];if(file)importUserData(file);this.value='';});
Achievement.render(document.getElementById('profileAchievements'));
renderRecentHistory();
}
var _changePasswordBtn=document.getElementById('changePasswordBtn');
if(_changePasswordBtn)_changePasswordBtn.addEventListener('click',async function(){
if(this.disabled)return;
if(!checkSupabase())return;
var oldPw=document.getElementById('oldPassword').value.trim();
var newPw=document.getElementById('newPassword').value.trim();
var confirmPw=document.getElementById('newPasswordConfirm').value.trim();
hideChangePwError();
if(!oldPw||!newPw||!confirmPw){showChangePwError('请填写所有字段');return;}
var pwError=validatePasswordStrength(newPw);
if(pwError){showChangePwError(pwError);return;}
if(newPw!==confirmPw){showChangePwError('两次输入的新密码不一致');return;}
if(!currentUser||!currentUser.email){showChangePwError('当前账号未绑定邮箱，无法修改密码');return;}
setChangePwLoading(true);
var verifyRes=await supabaseClient.auth.signInWithPassword({email:currentUser.email,password:oldPw});
if(verifyRes.error){setChangePwLoading(false);showChangePwError('当前密码不正确');return;}
var res=await supabaseClient.auth.updateUser({password:newPw});
setChangePwLoading(false);
if(res.error){showChangePwError(friendlyError(res.error));return;}
toast('密码修改成功！','success');
document.getElementById('changePasswordModal').classList.remove('open');
});
var _resetPwSetBtn=document.getElementById('resetPasswordSetBtn');
if(_resetPwSetBtn)_resetPwSetBtn.addEventListener('click',async function(){
if(this.disabled)return;
if(!checkSupabase())return;
var email=document.getElementById('resetPasswordEmail').value.trim();
var otpEl=document.getElementById('resetPasswordOtp');
var otpGroup=otpEl?otpEl.closest('.form-group'):null;
var needOtp=!!(otpGroup&&otpGroup.style.display!=='none');
var otp=otpEl?otpEl.value.trim():'';
var newPw=document.getElementById('resetPasswordNew').value.trim();
var confirmPw=document.getElementById('resetPasswordConfirm').value.trim();
hideResetPwError();
if(needOtp){
if(!email||!otp||!newPw||!confirmPw){showResetPwError('请填写所有字段');return;}
if(!/^\d{6,8}$/.test(otp)){showResetPwError('验证码为6-8位数字，请检查后输入');return;}
}else{
if(!newPw||!confirmPw){showResetPwError('请填写新密码');return;}
}
var pwError=validatePasswordStrength(newPw);
if(pwError){showResetPwError(pwError);return;}
if(newPw!==confirmPw){showResetPwError('两次输入的密码不一致');return;}
setResetPwLoading(true);
try{
if(needOtp){
var verifyRes=await supabaseClient.auth.verifyOtp({email:email,token:otp,type:'recovery'});
if(verifyRes.error){
setResetPwLoading(false);
var vmsg=verifyRes.error.message||'';
var vRate=verifyRes.error.status===429||/rate/i.test(vmsg);
showResetPwError(vRate?'操作过于频繁，请稍后重试':'验证码错误或已过期，请重新获取');
return;
}
}
var res=await supabaseClient.auth.updateUser({password:newPw});
setResetPwLoading(false);
if(res.error){showResetPwError(friendlyError(res.error));return;}
toast('✅ 密码已更新，请重新登录','success');
stopResendCountdown();
document.getElementById('resetPasswordSetModal').classList.remove('open');
await supabaseClient.auth.signOut();
setTimeout(function(){document.getElementById('loginModal').classList.add('open');},500);
}catch(err){setResetPwLoading(false);showResetPwError('网络异常，请稍后重试');}
});
var _resetPwSetModalClose=document.getElementById('resetPasswordSetModalClose');
if(_resetPwSetModalClose)_resetPwSetModalClose.addEventListener('click',function(){
stopResendCountdown();
var otpEl=document.getElementById('resetPasswordOtp');
if(otpEl&&otpEl.closest('.form-group'))otpEl.closest('.form-group').style.display='';
var resendWrap=document.getElementById('resendResetOtpBtn');
if(resendWrap&&resendWrap.parentElement)resendWrap.parentElement.style.display='';
var warnHint=document.querySelector('#resetPasswordSetModal .reset-hint-warn');
if(warnHint)warnHint.style.display='';
var modalTitle=document.querySelector('#resetPasswordSetModal h3');
if(modalTitle)modalTitle.innerHTML='<i class="fas fa-key"></i> 重置密码';
var modalDesc=document.querySelector('#resetPasswordSetModal h3 + p');
if(modalDesc)modalDesc.textContent='请输入您收到的验证码，并设置新密码。';
document.getElementById('resetPasswordSetModal').classList.remove('open');
});
renderStrengthBar('registerPassword','regStrengthBar','regStrengthLabel');
renderStrengthBar('newPassword','changeStrengthBar','changeStrengthLabel');
renderStrengthBar('resetPasswordNew','resetStrengthBar','resetStrengthLabel');
document.getElementById('switchToRegister').addEventListener('click',function(){hideLoginError();document.getElementById('loginEmail').value='';document.getElementById('loginPassword').value='';});
document.getElementById('switchToLogin').addEventListener('click',function(){hideRegisterError();document.getElementById('registerEmail').value='';document.getElementById('registerPassword').value='';document.getElementById('registerPasswordConfirm').value='';var rb=document.getElementById('regStrengthBar');if(rb)rb.style.display='none';var rl=document.getElementById('regStrengthLabel');if(rl)rl.textContent='';});
var agreementTexts={
user:'用户协议\n\n欢迎使用乐哲软件平台。在使用本平台服务前，请您仔细阅读以下条款：\n\n1. 用户注册与账号安全\n   - 用户需提供真实、有效的邮箱信息进行注册。\n   - 用户应妥善保管自己的账号和密码。\n\n2. 使用规范\n   - 用户应遵守国家法律法规，不得利用本平台传播违法信息。\n\n3. 版权声明\n   - 本平台提供的所有软件资源版权归原作者所有，仅供个人学习、研究使用，请勿用于商业用途。\n\n4. 免责声明\n   - 平台内容来自用户分享，不对软件的安全性、稳定性做任何担保。\n\n5. 隐私保护\n   - 我们承诺保护您的个人隐私，详细内容请查看《隐私政策》。\n\n6. 协议修改\n   - 乐哲软件有权随时修改本协议，修改后的协议将在平台公示。\n\n如果您有任何疑问，请联系我们：LeZheSoft@outlook.com',
privacy:'隐私政策\n\n乐哲软件非常重视您的隐私。本隐私政策说明我们如何收集、使用和保护您的个人信息。\n\n1. 信息收集\n   - 注册时：邮箱地址、用户名（如有）。\n   - 使用过程中：IP地址、浏览器类型、访问时间等常规日志信息。\n\n2. 信息使用\n   - 用于提供服务、发送通知、优化用户体验。\n   - 未经您的明确同意，我们不会将您的信息提供给第三方。\n\n3. 信息存储\n   - 您的信息存储在我们的安全服务器上，我们采取行业标准的安全措施保护您的数据。\n\n4. 您的权利\n   - 您可以随时登录个人中心查看、修改或删除您的个人信息。\n\n5. Cookie\n   - 我们使用 Cookie 保存您的登录状态。\n\n6. 联系我们\n   - 如有隐私相关问题，请发邮件至：LeZheSoft@outlook.com\n\n本隐私政策最后更新于 2026 年 1 月 1 日。'
};
var _showUserAgreement=document.getElementById('showUserAgreement');
if(_showUserAgreement)_showUserAgreement.addEventListener('click',function(e){e.preventDefault();document.getElementById('agreementModalTitle').textContent='📄 用户协议';document.getElementById('agreementModalBody').textContent=agreementTexts.user;document.getElementById('agreementModal').classList.add('open');});
var _showPrivacyPolicy=document.getElementById('showPrivacyPolicy');
if(_showPrivacyPolicy)_showPrivacyPolicy.addEventListener('click',function(e){e.preventDefault();document.getElementById('agreementModalTitle').textContent='📄 隐私政策';document.getElementById('agreementModalBody').textContent=agreementTexts.privacy;document.getElementById('agreementModal').classList.add('open');});
var _agreementModalClose=document.getElementById('agreementModalClose');
if(_agreementModalClose)_agreementModalClose.addEventListener('click',function(){document.getElementById('agreementModal').classList.remove('open');});
var _agreementModalCloseBtn=document.getElementById('agreementModalCloseBtn');
if(_agreementModalCloseBtn)_agreementModalCloseBtn.addEventListener('click',function(){document.getElementById('agreementModal').classList.remove('open');});
var _agreementModal=document.getElementById('agreementModal');
if(_agreementModal)_agreementModal.addEventListener('click',function(e){if(e.target===this)this.classList.remove('open');});
document.querySelectorAll('.search-hints span').forEach(function(span){span.addEventListener('click',function(){var kw=this.dataset.kw;document.getElementById('searchInput').value=kw;App.doSearch(kw);});});
document.addEventListener('DOMContentLoaded',function(){var donateModal=document.getElementById('donateModal');if(donateModal){donateModal.addEventListener('click',function(e){if(e.target===this){closeDonateModal();}});}});
var _rtFailCount=0;
function rtIsError(status){return status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED';}
function rtIsDead(){try{var until=parseInt(localStorage.getItem('lezhe_rt_dead')||'0',10);return until>Date.now();}catch(e){return false;}}
function rtNoteFail(){
_rtFailCount++;
if(window._lezheRtDisabled)return;
window._lezheRtDisabled=true;
try{localStorage.setItem('lezhe_rt_dead',String(Date.now()+6*3600*1000));}catch(e){}
if(supabaseClient&&supabaseClient.realtime&&supabaseClient.realtime.disconnect){try{supabaseClient.realtime.disconnect();}catch(e){}}
console.warn('[realtime] 实时连接不可用，已停用实时功能（不影响正常浏览）');
}
if(IS_LOCAL_PREVIEW){window._lezheRtDisabled=true;}
function initPresence(){
if(window._lezheRtDisabled||rtIsDead())return;
if(!supabaseClient||typeof supabase==='undefined'||!supabaseClient.channel)return;
try{
var key=(currentUser&&currentUser.id)||('anon-'+Math.random().toString(36).slice(2,8));
var ch=supabaseClient.channel('online-users',{config:{presence:{key:key}}});
ch.on('presence',{event:'sync'},function(){
var state=ch.presenceState();
var count=Object.keys(state).length;
var el=document.getElementById('onlineCount');
if(el)el.textContent=count;
}).subscribe(function(status){
if(status==='SUBSCRIBED'){try{localStorage.removeItem('lezhe_rt_dead');}catch(e){}ch.track({online_at:new Date().toISOString()});}
else if(rtIsError(status))rtNoteFail();
});
}catch(e){console.warn('presence 初始化失败',e);}
}
document.addEventListener('DOMContentLoaded',function(){
App.init();
var bell=document.getElementById('headerBellBtn');
if(bell)bell.addEventListener('click',function(e){e.stopPropagation();Notif.toggle();});
var mk=document.getElementById('notifMarkAllRead');
if(mk)mk.addEventListener('click',function(e){e.stopPropagation();Notif.markAllRead();});
document.addEventListener('click',function(e){
var p=document.getElementById('notifPanel'),b=document.getElementById('headerBellBtn');
if(p&&p.classList.contains('open')&&!p.contains(e.target)&&!b.contains(e.target))p.classList.remove('open');
});
Notif.load();
Compare.init();
var _cmpClear=document.getElementById('compareClearBtn');
if(_cmpClear)_cmpClear.addEventListener('click',function(){Compare.clear();});
var _cmpGo=document.getElementById('compareGoBtn');
if(_cmpGo)_cmpGo.addEventListener('click',function(){Compare.open();});
var _cmpModalClose=document.getElementById('compareModalClose');
if(_cmpModalClose)_cmpModalClose.addEventListener('click',function(){document.getElementById('compareModal').classList.remove('open');});
var _cmpModal=document.getElementById('compareModal');
if(_cmpModal)_cmpModal.addEventListener('click',function(e){if(e.target===this)this.classList.remove('open');});
Collections.load();
var cdb=document.getElementById('collectionDetailClose');
if(cdb)cdb.addEventListener('click',function(){document.getElementById('collectionDetailModal').classList.remove('open');});
var _cdm=document.getElementById('collectionDetailModal');
if(_cdm)_cdm.addEventListener('click',function(e){if(e.target===this)this.classList.remove('open');});
var shareClose=document.getElementById('shareModalClose');
if(shareClose)shareClose.addEventListener('click',function(){Share.close();});
var shareModal=document.getElementById('shareModal');
if(shareModal)shareModal.addEventListener('click',function(e){if(e.target===this)Share.close();});
var shareCopyBtn=document.getElementById('shareCopyBtn');
if(shareCopyBtn)shareCopyBtn.addEventListener('click',function(){
if(!Share._soft)return;
var text=Share._soft.name+' - 乐哲软件\n'+Share._url;
if(navigator.clipboard)navigator.clipboard.writeText(text).then(function(){toast('已复制分享文案','success');});
else{var i=document.createElement('input');i.value=text;document.body.appendChild(i);i.select();document.execCommand('copy');document.body.removeChild(i);toast('已复制','success');}
});
var shareDownloadQrBtn=document.getElementById('shareDownloadQrBtn');
if(shareDownloadQrBtn)shareDownloadQrBtn.addEventListener('click',function(){
var img=document.querySelector('#shareQr img');
if(!img){toast('二维码未就绪','warning');return;}
var a=document.createElement('a');a.href=img.src;a.download=(Share._soft?Share._soft.name:'share')+'-qr.png';a.click();
});
var fbModal=document.getElementById('feedbackModal');
var fbClose=function(){if(fbModal)fbModal.classList.remove('open');};
var _fbClose=document.getElementById('feedbackModalClose');
if(_fbClose)_fbClose.addEventListener('click',fbClose);
var _fbCancel=document.getElementById('fbCancel');
if(_fbCancel)_fbCancel.addEventListener('click',fbClose);
if(fbModal)fbModal.addEventListener('click',function(e){if(e.target===this)fbClose();});
var _fbSubmit=document.getElementById('fbSubmit');
if(_fbSubmit)_fbSubmit.addEventListener('click',async function(){
if(!checkSupabase())return;
var content=document.getElementById('fbContent').value.trim();
if(!content){toast('请填写反馈内容','warning');return;}
this.disabled=true;
var _fbPayload={software_id:fbModal.dataset.softId||null,type:document.getElementById('fbType').value,content:content,contact:document.getElementById('fbContact').value.trim()||null,user_id:currentUser?currentUser.id:null};
var r=await supabaseClient.from('feedback').insert([_fbPayload]);
this.disabled=false;
if(r.error){var _fbErrMsg=(r.error.message||'');if(/feedback|relation/i.test(_fbErrMsg)&&/does not exist|not exist|undefined_table/i.test(_fbErrMsg)){toast('反馈功能暂未开放，请稍后再试','warning');return;}if(_fbPayload.software_id&&/invalid input syntax for type uuid/i.test(_fbErrMsg)){this.disabled=true;delete _fbPayload.software_id;var r2=await supabaseClient.from('feedback').insert([_fbPayload]);this.disabled=false;if(r2.error){toast('提交失败：'+(r2.error.message||'未知错误'),'error');}else{toast('反馈已提交，感谢！','success');document.getElementById('fbContent').value='';fbClose();}return;}toast('提交失败：'+_fbErrMsg,'error');return;}
toast('反馈已提交，感谢！','success');
document.getElementById('fbContent').value='';
fbClose();
});
setTimeout(function(){Achievement.check();},1500);
setTimeout(initPresence,800);
(function(){
  var _lastCount=DB.getSoftware().length;
  var _timer=null;
  async function _poll(){
    if(document.hidden)return;
    try{
      await DB.loadAll(true);
      var _newCount=DB.getSoftware().length;
      if(_newCount!==_lastCount){
        _lastCount=_newCount;
        var _tc=document.getElementById('todayStackContainer');
        if(_tc&&!document.querySelector('.detail-overlay.open')){
          Render.renderTodayNew(_tc);
          toast('发现新软件上架！','success');
        }
      }
    }catch(e){}
  }
  _timer=setInterval(_poll,300000);
  document.addEventListener('visibilitychange',function(){if(!document.hidden)_poll();});
})();
});
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',loadUser);}else{loadUser();}
setupAuthListener();
(function(){
var ls=document.getElementById('loadingScreen');
if(!ls){document.body.classList.remove('ls-locked');return;}
var _done=false;
function finishLoading(){
if(_done)return;
_done=true;
try{
ls.classList.add('ls-done');
document.body.classList.remove('ls-locked');
setTimeout(function(){
ls.classList.add('hide');
setTimeout(function(){
if(ls&&ls.parentNode)ls.parentNode.removeChild(ls);
},700);
},400);
}catch(e){
if(ls&&ls.parentNode)ls.parentNode.removeChild(ls);
document.body.classList.remove('ls-locked');
}
}
window._lsStartTs=Date.now();
window.addEventListener('lezhe:ready',finishLoading,{once:true});
if(document.readyState==='complete'){
setTimeout(finishLoading,800);
}else{
window.addEventListener('load',function(){setTimeout(finishLoading,300);},{once:true});
}
setTimeout(finishLoading,2500);
})();