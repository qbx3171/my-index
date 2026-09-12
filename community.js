(function(){
var Community={};
window.Community=Community;
Community.currentSoft=null;
Community._injectingProfile=false;

Community.escapeHTML=function(str){
if(str===null||str===undefined)return '';
var d=document.createElement('div');
d.textContent=String(str);
return d.innerHTML;
};

Community.toast=function(msg,type){
if(typeof toast==='function')toast(msg,type||'success');
else console.log('[Community]',msg);
};

Community.requireLogin=function(){
Community.toast('请先登录','warning');
var lm=document.getElementById('loginModal');
if(lm)lm.classList.add('open');
};

Community.init=function(){
if(typeof supabaseClient==='undefined'||!supabaseClient){setTimeout(Community.init,500);return;}
Community.runInit();
Community.startRetry();
};

Community.runInit=function(){
var fns=[
Community.hijackDetailOpen,
Community.hijackGoProfile,
Community.hijackFavoriteToggle,
Community.hijackViewHistory,
Community.addNotificationBell,
Community.addLeaderboard,
Community.initEasterEggs,
Community.initThemes,
Community.initPWA,
Community.bindAuthListener
];
for(var i=0;i<fns.length;i++){
try{fns[i]();}catch(e){console.warn('[Community] init step failed:',e);}
}
};

Community.startRetry=function(){
if(Community._retryTimer)return;
var retry=0;
Community._retryTimer=setInterval(function(){
retry++;
if(retry>60){clearInterval(Community._retryTimer);Community._retryTimer=null;return;}
try{
if(!document.getElementById('communityLeaderboard'))Community.addLeaderboard();
if(!document.getElementById('communityBell'))Community.addNotificationBell();
if(window.App&&!App._communityHijacked)Community.hijackGoProfile();
if(window.Detail&&!Detail._communityHijacked)Community.hijackDetailOpen();
if(typeof toggleFavorite==='function'&&!toggleFavorite._communityHijacked)Community.hijackFavoriteToggle();
if(typeof addViewHistory==='function'&&!addViewHistory._communityHijacked)Community.hijackViewHistory();
var pp=document.getElementById('pageProfile');
if(pp&&!pp.classList.contains('hidden')&&!document.getElementById('communityProfileSection')){
Community.injectProfile();
}
}catch(e){}
},1000);
};

Community.bindAuthListener=function(){
if(Community._authBound)return;
Community._authBound=true;
try{
supabaseClient.auth.onAuthStateChange(function(event,session){
if(session&&session.user){
window.currentUser=session.user;
Community.onLogin();
}else{
window.currentUser=null;
Community.onLogout();
}
});
}catch(e){console.warn('[Community] onAuthStateChange error:',e);}
setTimeout(function(){
if(window.currentUser){Community.onLogin();}
},1500);
};

Community.onLogin=async function(){
Community.refreshProfileIfVisible();
try{await Community.ensureProfile();}catch(e){console.warn('[Community] ensureProfile:',e);}
await Promise.all([
Community.syncFavorites().catch(function(e){console.warn('syncFavorites:',e);}),
Community.syncHistory().catch(function(e){console.warn('syncHistory:',e);}),
Community.loadPoints().catch(function(e){console.warn('loadPoints:',e);}),
Community.loadNotifications().catch(function(e){console.warn('loadNotifications:',e);})
]);
Community.updateAvatarLevel();
Community.refreshProfileIfVisible();
};

Community.onLogout=function(){
var bell=document.getElementById('communityBell');
if(bell)bell.style.display='none';
var badge=document.getElementById('communityLevelBadge');
if(badge)badge.remove();
window.userPoints=0;
window.userLevel=1;
window.userStreak=0;
window.userLastCheckin=null;
Community.refreshProfileIfVisible();
};

Community.ensureProfile=async function(){
if(!window.currentUser)return;
var res=await supabaseClient.from('profiles').select('id').eq('id',window.currentUser.id).maybeSingle();
if(res.error){console.warn('ensureProfile 查询失败:',res.error);return;}
if(res.data)return;
var ins=await supabaseClient.from('profiles').insert({
id:window.currentUser.id,
points:0,
level:1,
streak:0,
updated_at:new Date().toISOString()
});
if(ins.error)console.warn('ensureProfile 创建失败:',ins.error);
};

Community.syncFavorites=async function(){
if(!window.currentUser)return;
var res=await supabaseClient.from('favorites').select('software_id').eq('user_id',window.currentUser.id);
if(res.error)return;
var ids=(res.data||[]).map(function(x){return x.software_id;});
localStorage.setItem('lezhe_favorites',JSON.stringify(ids));
};

Community.syncHistory=async function(){
if(!window.currentUser)return;
var res=await supabaseClient.from('view_history').select('software_id').eq('user_id',window.currentUser.id).order('viewed_at',{ascending:false}).limit(6);
if(res.error)return;
var ids=(res.data||[]).map(function(x){return x.software_id;});
localStorage.setItem('lezhe_view_history',JSON.stringify(ids));
if(typeof renderRecentHistory==='function')renderRecentHistory();
};

Community.addFavoriteCloud=async function(softwareId){
if(!window.currentUser)return;
await supabaseClient.from('favorites').upsert({user_id:window.currentUser.id,software_id:String(softwareId)},{onConflict:'user_id,software_id'});
};

Community.removeFavoriteCloud=async function(softwareId){
if(!window.currentUser)return;
await supabaseClient.from('favorites').delete().eq('user_id',window.currentUser.id).eq('software_id',String(softwareId));
};

Community.addHistoryCloud=async function(softwareId){
if(!window.currentUser)return;
await supabaseClient.from('view_history').upsert({user_id:window.currentUser.id,software_id:String(softwareId),viewed_at:new Date().toISOString()},{onConflict:'user_id,software_id'});
};

Community.reloadPoints=async function(){
if(!window.currentUser)return;
var res=await supabaseClient.from('profiles').select('points,level,streak,last_checkin').eq('id',window.currentUser.id).maybeSingle();
if(res.error){console.warn('加载积分失败:',res.error);return;}
if(res.data){
window.userPoints=res.data.points||0;
window.userLevel=res.data.level||1;
window.userStreak=res.data.streak||0;
window.userLastCheckin=res.data.last_checkin||null;
}else{
window.userPoints=0;
window.userLevel=1;
window.userStreak=0;
window.userLastCheckin=null;
}
};

Community.loadPoints=async function(){
await Community.reloadPoints();
};

Community.addPoints=async function(points){
if(!window.currentUser)return;
var profileRes=await supabaseClient.from('profiles').select('points').eq('id',window.currentUser.id).maybeSingle();
var curPoints=(profileRes.data&&profileRes.data.points)||0;
var newPoints=curPoints+points;
var level=Math.floor(newPoints/100)+1;
var res=await supabaseClient.from('profiles').upsert({
id:window.currentUser.id,
points:newPoints,
level:level,
updated_at:new Date().toISOString()
},{onConflict:'id'});
if(res.error){Community.toast('积分保存失败: '+res.error.message,'error');return;}
await Community.reloadPoints();
Community.updateAvatarLevel();
Community.refreshProfileIfVisible();
Community.toast('积分 +'+points,'success');
};

Community.updateAvatarLevel=function(){
var level=window.userLevel||1;
var badge=document.getElementById('communityLevelBadge');
if(!badge){
var authNav=document.getElementById('authNav');
if(!authNav)return;
badge=document.createElement('span');
badge.id='communityLevelBadge';
badge.style.cssText='font-size:0.6rem;background:var(--accent-gradient);color:#fff;padding:1px 6px;border-radius:20px;margin-left:4px;line-height:1.4;';
authNav.appendChild(badge);
}
badge.textContent='Lv'+level;
};

Community.addNotificationBell=function(){
if(document.getElementById('communityBell'))return;
var headerInner=document.querySelector('.header-inner');
if(!headerInner)return;
var bell=document.createElement('button');
bell.id='communityBell';
bell.className='header-theme-btn';
bell.style.cssText='position:relative;display:none;';
bell.innerHTML='<i class="fas fa-bell"></i><span id="communityBellDot" style="position:absolute;top:2px;right:2px;width:8px;height:8px;border-radius:50%;background:#e74c3c;display:none;box-shadow:0 0 0 2px var(--bg-card-solid);"></span>';
bell.addEventListener('click',Community.showNotifications);
var last=headerInner.lastElementChild;
headerInner.insertBefore(bell,last);
};

Community.loadNotifications=async function(){
if(!window.currentUser)return;
var bell=document.getElementById('communityBell');
if(bell)bell.style.display='flex';
var res=await supabaseClient.from('notifications').select('id').eq('user_id',window.currentUser.id).eq('is_read',false);
var dot=document.getElementById('communityBellDot');
if(dot)dot.style.display=(res.data&&res.data.length>0)?'block':'none';
};

Community.showNotifications=async function(){
if(!window.currentUser)return;
var existing=document.getElementById('communityNotifPanel');
if(existing){existing.remove();return;}
if(!document.getElementById('communityNotifStyles')){
var s=document.createElement('style');
s.id='communityNotifStyles';
s.textContent=[
'@keyframes notifIn{from{opacity:0;transform:translateY(-14px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}',
'@keyframes notifOut{to{opacity:0;transform:translateY(-10px) scale(.97)}}',
'@keyframes notifDotPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.4);opacity:.6}}',
'#communityNotifBody::-webkit-scrollbar{width:5px}',
'#communityNotifBody::-webkit-scrollbar-thumb{background:rgba(0,119,255,0.2);border-radius:10px}',
'.notif-del-btn:hover{background:rgba(239,68,68,0.12) !important;color:#ef4444 !important;opacity:1 !important;}'
].join('');
document.head.appendChild(s);
}
var res=await supabaseClient.from('notifications').select('*').eq('user_id',window.currentUser.id).order('created_at',{ascending:false}).limit(30);
var data=res.data||[];
var unreadCount=data.filter(function(n){return !n.is_read;}).length;

var panel=document.createElement('div');
panel.id='communityNotifPanel';
panel.style.cssText='position:fixed;top:70px;right:16px;width:380px;max-width:calc(100vw - 32px);max-height:520px;background:var(--bg-card-solid);border:1px solid var(--border-glow-strong);border-radius:18px;box-shadow:0 20px 56px rgba(0,0,0,0.18),0 2px 8px rgba(0,0,0,0.06);z-index:9999;overflow:hidden;display:flex;flex-direction:column;animation:notifIn .3s cubic-bezier(.2,.8,.3,1);';

var header=document.createElement('div');
header.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:16px 20px 14px;border-bottom:1px solid var(--border-glow);';
header.innerHTML='<div style="display:flex;align-items:center;gap:10px;">'+
'<div style="width:32px;height:32px;border-radius:10px;background:var(--accent-gradient);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.95rem;">'+
'<i class="fas fa-bell"></i></div>'+
'<div>'+
'<div style="font-size:0.95rem;font-weight:700;color:var(--text-primary);line-height:1.2;">消息通知</div>'+
'<div style="font-size:0.68rem;color:var(--text-dim);margin-top:2px;" id="communityNotifSubtitle">'+(unreadCount>0?('<span style="color:#0077ff;font-weight:600;">'+unreadCount+'</span> 条未读'):'全部已读')+'</div>'+
'</div></div>';

var closeBtn=document.createElement('button');
closeBtn.innerHTML='&times;';
closeBtn.style.cssText='background:rgba(0,0,0,0.04);border:none;width:30px;height:30px;border-radius:50%;color:var(--text-dim);font-size:1.2rem;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center;transition:.2s;flex-shrink:0;';
header.appendChild(closeBtn);
panel.appendChild(header);

var body=document.createElement('div');
body.id='communityNotifBody';
body.style.cssText='flex:1;overflow-y:auto;padding:10px;background:var(--bg-primary);';

if(data.length===0){
body.innerHTML='<div style="text-align:center;padding:56px 20px;"><div style="font-size:2.8rem;opacity:0.25;margin-bottom:10px;">📭</div><div style="font-size:0.88rem;color:var(--text-secondary);">暂无新消息</div></div>';
}else{
var typeConfig={
'software':{color:'#0b9e5a',bg:'rgba(11,158,90,0.1)',icon:'🚀'},
'update':{color:'#f59e0b',bg:'rgba(245,158,11,0.1)',icon:'⚡'},
'tutorial':{color:'#7c3aed',bg:'rgba(124,58,237,0.1)',icon:'📖'},
'activity':{color:'#ec4899',bg:'rgba(236,72,153,0.1)',icon:'🎉'},
'system':{color:'#0077ff',bg:'rgba(0,119,255,0.1)',icon:'🔔'}
};

data.forEach(function(n){
var unread=!n.is_read;
var contentStr=String(n.content||'');
var titleMatch=contentStr.match(/^【([^】]+)】([\s\S]+)$/);
var title=titleMatch?titleMatch[1]:'系统通知';
var bodyText=titleMatch?titleMatch[2]:contentStr;
var cfg=typeConfig.system;
if(title.indexOf('新软件')!==-1||title.indexOf('上架')!==-1){cfg=typeConfig.software;}
else if(title.indexOf('更新')!==-1){cfg=typeConfig.update;}
else if(title.indexOf('教程')!==-1){cfg=typeConfig.tutorial;}
else if(title.indexOf('活动')!==-1||title.indexOf('🎉')!==-1){cfg=typeConfig.activity;}

var card=document.createElement('div');
card.className='notif-card';
card.style.cssText='position:relative;background:var(--bg-card-solid);border-radius:12px;padding:14px 16px 13px;margin-bottom:8px;border:1px solid '+(unread?cfg.color+'30':'var(--border-glow)')+';cursor:pointer;';

var topRow=document.createElement('div');
topRow.style.cssText='display:flex;align-items:center;gap:8px;margin-bottom:8px;';
var iconBox=document.createElement('div');
iconBox.style.cssText='width:28px;height:28px;border-radius:8px;background:'+cfg.bg+';display:flex;align-items:center;justify-content:center;font-size:0.85rem;flex-shrink:0;';
iconBox.textContent=cfg.icon;
var titleWrap=document.createElement('div');
titleWrap.style.cssText='flex:1;min-width:0;display:flex;align-items:center;gap:6px;';
var titleText=document.createElement('span');
titleText.style.cssText='font-size:0.85rem;font-weight:700;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
titleText.textContent=title;
titleWrap.appendChild(titleText);

var rightGroup=document.createElement('div');
rightGroup.style.cssText='display:flex;align-items:center;gap:4px;flex-shrink:0;';
var timeEl=document.createElement('span');
timeEl.style.cssText='font-size:0.65rem;color:var(--text-dim);white-space:nowrap;';
timeEl.textContent=(typeof timeAgo==='function'?timeAgo(n.created_at):'刚刚');

var delBtn=document.createElement('button');
delBtn.className='notif-del-btn';
delBtn.innerHTML='&times;';
delBtn.title='删除';
delBtn.style.cssText='width:22px;height:22px;border-radius:6px;background:transparent;border:none;color:var(--text-dim);font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0.35;padding:0;line-height:1;flex-shrink:0;';
delBtn.onclick=async function(e){
e.stopPropagation();
if(!confirm('确定删除这条通知吗？'))return;
delBtn.disabled=true;
try{
var delRes=await supabaseClient.from('notifications').delete().eq('id',n.id);
if(delRes.error){Community.toast('删除失败: '+delRes.error.message,'error');delBtn.disabled=false;return;}
card.style.transition='all .3s';
card.style.opacity='0';
card.style.transform='translateX(30px)';
setTimeout(function(){card.remove();},300);
}catch(err){Community.toast('删除异常','error');delBtn.disabled=false;}
};

rightGroup.appendChild(timeEl);
rightGroup.appendChild(delBtn);
topRow.appendChild(iconBox);
topRow.appendChild(titleWrap);
topRow.appendChild(rightGroup);
card.appendChild(topRow);

var bodyEl=document.createElement('div');
bodyEl.style.cssText='font-size:0.8rem;line-height:1.6;color:var(--text-secondary);padding-left:36px;word-break:break-word;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;';
bodyEl.textContent=bodyText;
card.appendChild(bodyEl);

if(unread){
var leftBar=document.createElement('div');
leftBar.style.cssText='position:absolute;left:0;top:14px;bottom:14px;width:3px;border-radius:0 3px 3px 0;background:'+cfg.color+';';
card.appendChild(leftBar);
}
body.appendChild(card);
});
}
panel.appendChild(body);
document.body.appendChild(panel);

var closePanel=function(){panel.style.animation='notifOut .22s ease forwards';setTimeout(function(){if(panel.parentNode)panel.remove();document.removeEventListener('click',outsideClick);},200);};
closeBtn.onclick=closePanel;
var outsideClick=function(e){if(!panel.contains(e.target)&&!e.target.closest('#communityBell')){closePanel();}};
setTimeout(function(){document.addEventListener('click',outsideClick);},10);

if(unreadCount>0){
await supabaseClient.from('notifications').update({is_read:true}).eq('user_id',window.currentUser.id).eq('is_read',false);
var bellDot=document.getElementById('communityBellDot');
if(bellDot)bellDot.style.display='none';
}
};

Community.hijackDetailOpen=function(){
if(!window.Detail||Detail._communityHijacked)return;
if(typeof Detail.open!=='function')return;
Detail._communityHijacked=true;
var orig=Detail.open;
Detail.open=function(soft){
orig.call(Detail,soft);
Community.currentSoft=soft;
Community.addHistoryCloud(soft.id);
Community.injectDetail(soft);
};
};

Community.hijackGoProfile=function(){
if(!window.App||App._communityHijacked)return;
if(typeof App.goProfile!=='function')return;
App._communityHijacked=true;
var orig=App.goProfile;
App.goProfile=function(){
orig.call(App);
Community.injectProfile();
setTimeout(function(){
Community.reloadPoints().then(Community.injectProfile);
if(typeof renderRecentHistory==='function')renderRecentHistory();
},100);
};
};

Community.hijackFavoriteToggle=function(){
if(typeof toggleFavorite!=='function'||toggleFavorite._communityHijacked)return;
toggleFavorite._communityHijacked=true;
var orig=toggleFavorite;
window.toggleFavorite=function(id){
var result=orig(id);
if(result){Community.addFavoriteCloud(id);}
else{Community.removeFavoriteCloud(id);}
return result;
};
};

Community.hijackViewHistory=function(){
if(typeof addViewHistory!=='function'||addViewHistory._communityHijacked)return;
addViewHistory._communityHijacked=true;
var orig=addViewHistory;
window.addViewHistory=function(id){
orig(id);
Community.addHistoryCloud(id);
if(typeof renderRecentHistory==='function'){
var pp=document.getElementById('pageProfile');
if(pp&&!pp.classList.contains('hidden'))renderRecentHistory();
}
};
};

Community.injectDetail=function(soft){
if(!soft)return;
var modalBody=document.getElementById('modalBody');
if(!modalBody)return;
var old=document.getElementById('communityDetailSection');
if(old)old.remove();
var section=document.createElement('div');
section.id='communityDetailSection';
section.style.cssText='margin-top:16px;border-top:1px solid var(--border-glow);padding-top:12px;';
section.innerHTML='<h4 style="font-size:0.9rem;margin-bottom:8px;"><i class="fas fa-star"></i> 评分与评论</h4>'+
'<div id="communityRatingBox" style="margin-bottom:10px;"></div>'+
'<div id="communityReviewList"></div>'+
'<div style="margin-top:10px;"><textarea id="communityReviewContent" placeholder="写下你的评价..." style="width:100%;padding:8px;border:1px solid var(--border-glow);border-radius:8px;background:var(--bg-primary);color:var(--text-primary);font-size:0.8rem;min-height:60px;"></textarea>'+
'<div style="display:flex;gap:8px;margin-top:6px;align-items:center;"><select id="communityRatingSelect" style="padding:4px 8px;border-radius:6px;border:1px solid var(--border-glow);background:var(--bg-primary);color:var(--text-primary);font-size:0.8rem;"><option value="5">5星</option><option value="4">4星</option><option value="3">3星</option><option value="2">2星</option><option value="1">1星</option></select><button class="btn btn-sm btn-primary" id="communitySubmitReview">发表评价</button></div></div>'+
'<h4 style="font-size:0.9rem;margin:16px 0 8px;"><i class="fas fa-comments"></i> 讨论区</h4>'+
'<div id="communityDiscussionList"></div>'+
'<div style="margin-top:10px;"><textarea id="communityDiscussionContent" placeholder="参与讨论..." style="width:100%;padding:8px;border:1px solid var(--border-glow);border-radius:8px;background:var(--bg-primary);color:var(--text-primary);font-size:0.8rem;min-height:60px;"></textarea>'+
'<button class="btn btn-sm btn-primary" id="communitySubmitDiscussion" style="margin-top:6px;">发表讨论</button></div>';
modalBody.appendChild(section);
Community.loadReviews(soft.id);
Community.loadDiscussions(soft.id);
document.getElementById('communitySubmitReview').onclick=function(){Community.submitReview(soft.id);};
document.getElementById('communitySubmitDiscussion').onclick=function(){Community.submitDiscussion(soft.id);};
};

Community.loadReviews=async function(softwareId){
var list=document.getElementById('communityReviewList');
if(!list)return;
var res=await supabaseClient.from('software_reviews').select('*').eq('software_id',String(softwareId)).order('created_at',{ascending:false});
if(res.error){list.innerHTML='<p style="color:var(--text-dim);font-size:0.8rem;">暂无评价</p>';return;}
var data=res.data||[];
if(data.length===0){list.innerHTML='<p style="color:var(--text-dim);font-size:0.8rem;">暂无评价，来写第一条吧</p>';return;}
var avg=0;var html='';
for(var i=0;i<data.length;i++){var r=data[i];avg+=r.rating;var stars='';for(var j=1;j<=5;j++){stars+=j<=r.rating?'★':'☆';}html+='<div style="padding:8px 0;border-bottom:1px solid var(--border-glow);"><div style="display:flex;justify-content:space-between;font-size:0.75rem;"><span style="color:var(--accent-cyan);">'+stars+'</span><span style="color:var(--text-dim);">'+(typeof timeAgo==='function'?timeAgo(r.created_at):'')+'</span></div><div style="font-size:0.8rem;margin-top:2px;">'+Community.escapeHTML(r.content||'')+'</div></div>';}
avg=(avg/data.length).toFixed(1);
var ratingBox=document.getElementById('communityRatingBox');
if(ratingBox)ratingBox.innerHTML='<div style="font-size:1.2rem;font-weight:700;color:var(--accent-cyan);">'+avg+' 分</div><div style="font-size:0.7rem;color:var(--text-dim);">共 '+data.length+' 条评价</div>';
list.innerHTML=html;
};

Community.submitReview=async function(softwareId){
if(!window.currentUser){Community.requireLogin();return;}
var contentEl=document.getElementById('communityReviewContent');
var ratingEl=document.getElementById('communityRatingSelect');
if(!contentEl||!ratingEl)return;
var content=contentEl.value.trim();
var rating=parseInt(ratingEl.value);
if(!content){Community.toast('请填写评价内容','warning');return;}
var res=await supabaseClient.from('software_reviews').upsert({user_id:window.currentUser.id,software_id:String(softwareId),rating:rating,content:content},{onConflict:'user_id,software_id'});
if(res.error){Community.toast('评价失败: '+res.error
