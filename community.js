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
Community.addRandomButton,
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
bell.innerHTML='<i class="fas fa-bell"></i><span id="communityBellDot" style="position:absolute;top:2px;right:2px;width:8px;height:8px;border-radius:50%;background:#e74c3c;display:none;"></span>';
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
var res=await supabaseClient.from('notifications').select('*').eq('user_id',window.currentUser.id).order('created_at',{ascending:false}).limit(30);
var html='<div id="communityNotifPanel" style="position:fixed;top:70px;right:20px;width:320px;max-height:400px;overflow-y:auto;background:var(--bg-card-solid);border:1px solid var(--border-glow);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.15);z-index:9999;padding:12px;">';
html+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><strong>通知</strong><button id="communityNotifClose" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--text-dim);">&times;</button></div>';
if(!res.data||res.data.length===0){
html+='<p style="color:var(--text-dim);font-size:0.8rem;">暂无通知</p>';
}else{
for(var i=0;i<res.data.length;i++){
var n=res.data[i];
html+='<div style="padding:6px 0;border-bottom:1px solid var(--border-glow);font-size:0.8rem;'+(n.is_read?'opacity:0.6':'')+'">'+Community.escapeHTML(n.content||'')+'<div style="font-size:0.6rem;color:var(--text-dim);">'+(typeof timeAgo==='function'?timeAgo(n.created_at):'')+'</div></div>';
}
await supabaseClient.from('notifications').update({is_read:true}).eq('user_id',window.currentUser.id).eq('is_read',false);
var dot=document.getElementById('communityBellDot');
if(dot)dot.style.display='none';
}
html+='</div>';
var wrapper=document.createElement('div');
wrapper.innerHTML=html;
var panel=wrapper.firstChild;
document.body.appendChild(panel);
document.getElementById('communityNotifClose').onclick=function(){panel.remove();};
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
var avg=0;
var html='';
for(var i=0;i<data.length;i++){
var r=data[i];
avg+=r.rating;
var stars='';
for(var j=1;j<=5;j++){stars+=j<=r.rating?'★':'☆';}
html+='<div style="padding:8px 0;border-bottom:1px solid var(--border-glow);"><div style="display:flex;justify-content:space-between;font-size:0.75rem;"><span style="color:var(--accent-cyan);">'+stars+'</span><span style="color:var(--text-dim);">'+(typeof timeAgo==='function'?timeAgo(r.created_at):'')+'</span></div><div style="font-size:0.8rem;margin-top:2px;">'+Community.escapeHTML(r.content||'')+'</div></div>';
}
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
if(res.error){Community.toast('评价失败: '+res.error.message,'error');return;}
Community.toast('评价成功','success');
contentEl.value='';
Community.loadReviews(softwareId);
await Community.addPoints(5);
};

Community.loadDiscussions=async function(softwareId){
var list=document.getElementById('communityDiscussionList');
if(!list)return;
var res=await supabaseClient.from('software_discussions').select('*').eq('software_id',String(softwareId)).is('parent_id',null).order('created_at',{ascending:false});
if(res.error){list.innerHTML='<p style="color:var(--text-dim);font-size:0.8rem;">暂无讨论</p>';return;}
var data=res.data||[];
if(data.length===0){list.innerHTML='<p style="color:var(--text-dim);font-size:0.8rem;">暂无讨论，来发表第一条吧</p>';return;}
var html='';
for(var i=0;i<data.length;i++){
var d=data[i];
html+='<div style="padding:8px 0;border-bottom:1px solid var(--border-glow);"><div style="font-size:0.7rem;color:var(--text-dim);">'+(typeof timeAgo==='function'?timeAgo(d.created_at):'')+'</div><div style="font-size:0.8rem;margin-top:2px;">'+Community.escapeHTML(d.content)+'</div></div>';
}
list.innerHTML=html;
};

Community.submitDiscussion=async function(softwareId){
if(!window.currentUser){Community.requireLogin();return;}
var contentEl=document.getElementById('communityDiscussionContent');
if(!contentEl)return;
var content=contentEl.value.trim();
if(!content){Community.toast('请填写讨论内容','warning');return;}
var res=await supabaseClient.from('software_discussions').insert({user_id:window.currentUser.id,software_id:String(softwareId),content:content});
if(res.error){Community.toast('发表失败: '+res.error.message,'error');return;}
Community.toast('发表成功','success');
contentEl.value='';
Community.loadDiscussions(softwareId);
await Community.addPoints(3);
};

Community.getToday=function(){
var d=new Date(Date.now()+8*3600*1000);
return d.toISOString().slice(0,10);
};

Community.injectProfile=function(){
if(Community._injectingProfile)return;
Community._injectingProfile=true;
setTimeout(function(){Community._injectingProfile=false;},200);
var container=document.getElementById('profileContent');
if(!container)return;
var old=document.getElementById('communityProfileSection');
if(old)old.remove();
var points=window.userPoints||0;
var level=window.userLevel||1;
var streak=window.userStreak||0;
var today=Community.getToday();
var checkedIn=!!(window.userLastCheckin&&window.userLastCheckin===today);
var btnText=checkedIn?'✅ 已签到':'每日签到';
var btnExtra=checkedIn?'background:#0b9e5a;border-color:#0b9e5a;':'';
var section=document.createElement('div');
section.id='communityProfileSection';
section.style.cssText='margin-top:16px;';
section.innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">'+
'<div style="background:var(--bg-card);border-radius:12px;padding:16px;border:1px solid var(--border-glow);text-align:center;">'+
'<div style="font-size:1.5rem;font-weight:700;color:var(--accent-cyan);" id="communityPoints">'+points+'</div>'+
'<div style="font-size:0.75rem;color:var(--text-dim);">积分</div>'+
'<button class="btn btn-sm btn-primary" id="communityCheckinBtn" style="margin-top:8px;'+btnExtra+'" '+(checkedIn?'disabled':'')+'>'+btnText+'</button></div>'+
'<div style="background:var(--bg-card);border-radius:12px;padding:16px;border:1px solid var(--border-glow);text-align:center;">'+
'<div style="font-size:1.5rem;font-weight:700;color:var(--accent-cyan);" id="communityLevel">Lv'+level+'</div>'+
'<div style="font-size:0.75rem;color:var(--text-dim);">等级</div>'+
'<div style="font-size:0.7rem;color:var(--text-dim);margin-top:4px;">连续签到 <span id="communityStreak">'+streak+'</span> 天</div></div>'+
'</div>';
container.appendChild(section);
var btn=document.getElementById('communityCheckinBtn');
if(btn&&!checkedIn)btn.onclick=Community.doCheckin;
};

Community.refreshProfileIfVisible=function(){
var pageProfile=document.getElementById('pageProfile');
if(pageProfile&&!pageProfile.classList.contains('hidden')){
Community.injectProfile();
}
};

Community.doCheckin=async function(){
if(!window.currentUser){Community.toast('请先登录','warning');return;}
var btn=document.getElementById('communityCheckinBtn');
if(btn){btn.disabled=true;btn.textContent='签到中...';}
try{
var today=Community.getToday();
var exist=await supabaseClient.from('checkins').select('id').eq('user_id',window.currentUser.id).eq('checkin_date',today).maybeSingle();
if(exist.error){
Community.toast('查询签到失败: '+exist.error.message,'error');
if(btn){btn.disabled=false;btn.textContent='每日签到';}
return;
}
if(exist.data){
Community.toast('今天已经签到过了','warning');
window.userLastCheckin=today;
await Community.reloadPoints();
Community.injectProfile();
Community.updateAvatarLevel();
return;
}
var profileRes=await supabaseClient.from('profiles').select('points,streak,last_checkin').eq('id',window.currentUser.id).maybeSingle();
var curPoints=0,curStreak=0,lastCheckin=null;
if(profileRes.data){
curPoints=profileRes.data.points||0;
curStreak=profileRes.data.streak||0;
lastCheckin=profileRes.data.last_checkin||null;
}
var streak=curStreak+1;
if(streak>1&&lastCheckin){
var diff=(new Date(today)-new Date(lastCheckin))/86400000;
if(diff>1)streak=1;
}
var newPoints=curPoints+10;
var level=Math.floor(newPoints/100)+1;
var insertRes=await supabaseClient.from('checkins').insert({user_id:window.currentUser.id,checkin_date:today,points:10});
if(insertRes.error){
Community.toast('签到记录失败: '+insertRes.error.message,'error');
if(btn){btn.disabled=false;btn.textContent='每日签到';}
return;
}
var upsertRes=await supabaseClient.from('profiles').upsert({
id:window.currentUser.id,
points:newPoints,
level:level,
streak:streak,
last_checkin:today,
updated_at:new Date().toISOString()
},{onConflict:'id'});
if(upsertRes.error){
Community.toast('积分保存失败: '+upsertRes.error.message,'error');
if(btn){btn.disabled=false;btn.textContent='每日签到';}
return;
}
await Community.reloadPoints();
Community.injectProfile();
Community.updateAvatarLevel();
Community.toast('签到成功 +10 积分','success');
}catch(e){
Community.toast('签到异常: '+e.message,'error');
if(btn){btn.disabled=false;btn.textContent='每日签到';}
}
};

Community.addRandomButton=function(){
var hero=document.querySelector('.hero');
if(!hero||document.getElementById('communityRandomBtn'))return;
var btn=document.createElement('button');
btn.id='communityRandomBtn';
btn.className='btn btn-outline';
btn.style.cssText='margin-top:10px;';
btn.innerHTML='<i class="fas fa-dice"></i> 手气不错';
btn.onclick=function(){
var all=(window.DB&&DB.getSoftware)?DB.getSoftware():[];
if(!all.length){Community.toast('暂无软件','warning');return;}
var s=all[Math.floor(Math.random()*all.length)];
if(window.Detail)Detail.open(s);
};
var searchHints=hero.querySelector('.search-hints');
if(searchHints){searchHints.parentNode.insertBefore(btn,searchHints.nextSibling);}
else{hero.appendChild(btn);}
};

Community.addLeaderboard=function(){
if(document.getElementById('communityLeaderboard'))return;
var div=document.createElement('div');
div.id='communityLeaderboard';
div.style.cssText='position:fixed;left:16px;bottom:160px;z-index:70;font-family:inherit;';
div.innerHTML='<div id="communityLeaderboardPanel" style="display:none;position:absolute;bottom:56px;left:0;width:240px;max-height:60vh;background:var(--bg-card-solid);border:1px solid var(--border-glow);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.18);padding:12px;overflow:hidden;">'+
'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'+
'<span style="font-size:0.85rem;font-weight:700;color:var(--text-primary);">🏆 社区排行榜</span>'+
'<button id="communityLeaderboardClose" style="background:none;border:none;font-size:1.1rem;cursor:pointer;color:var(--text-dim);padding:0 4px;">&times;</button>'+
'</div>'+
'<div id="communityLeaderboardContent" style="font-size:0.78rem;color:var(--text-secondary);max-height:50vh;overflow-y:auto;">点击加载...</div>'+
'</div>'+
'<button id="communityLeaderboardToggle" style="width:48px;height:48px;border-radius:50%;background:var(--accent-gradient);color:#fff;border:none;cursor:pointer;font-size:1.3rem;box-shadow:0 4px 16px rgba(0,119,255,0.4);display:flex;align-items:center;justify-content:center;">🏆</button>';
document.body.appendChild(div);
var toggle=document.getElementById('communityLeaderboardToggle');
var panel=document.getElementById('communityLeaderboardPanel');
var closeBtn=document.getElementById('communityLeaderboardClose');
var expanded=false;
toggle.addEventListener('click',function(){
if(expanded){panel.style.display='none';}
else{panel.style.display='block';Community.loadLeaderboard();}
expanded=!expanded;
});
closeBtn.addEventListener('click',function(){
panel.style.display='none';
expanded=false;
});
};

Community.loadLeaderboard=async function(){
var el=document.getElementById('communityLeaderboardContent');
if(!el)return;
el.innerHTML='加载中...';
var res=await supabaseClient.from('profiles').select('username,points,level').order('points',{ascending:false}).limit(10);
if(res.error){el.innerHTML='<p style="color:var(--text-dim);">加载失败：'+Community.escapeHTML(res.error.message||'')+'</p>';return;}
var data=res.data||[];
if(data.length===0){el.innerHTML='<p style="color:var(--text-dim);">暂无数据</p>';return;}
var html='';
for(var i=0;i<data.length;i++){
var u=data[i];
var rankColor=i===0?'#f39c12':i===1?'#95a5a6':i===2?'#cd7f32':'var(--text-dim)';
var medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1);
html+='<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border-glow);">'+
'<span style="width:20px;text-align:center;font-weight:700;color:'+rankColor+';flex-shrink:0;">'+medal+'</span>'+
'<span style="flex:1;font-weight:500;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+Community.escapeHTML(u.username||'匿名')+'</span>'+
'<span style="font-size:0.7rem;color:var(--accent-cyan);font-weight:600;flex-shrink:0;">'+(u.points||0)+'</span>'+
'<span style="font-size:0.6rem;color:var(--text-dim);flex-shrink:0;">Lv'+(u.level||1)+'</span>'+
'</div>';
}
el.innerHTML=html;
};

Community.initEasterEggs=function(){
var logo=document.getElementById('logoHome');
if(logo&&!logo._ee){
logo._ee=true;
var count=0;
logo.addEventListener('click',function(){
count++;
if(count>=5){
count=0;
Community.toast('🎉 彩蛋触发！','success');
var root=document.documentElement;
root.style.setProperty('--accent-cyan','#ff00ff');
setTimeout(function(){root.style.setProperty('--accent-cyan','#0077ff');},3000);
}
});
}
if(!Community._konami){
Community._konami=true;
var konami=[38,38,40,40,37,39,37,39,66,65];
var pos=0;
document.addEventListener('keydown',function(e){
if(e.keyCode===konami[pos]){
pos++;
if(pos===konami.length){
pos=0;
Community.toast('🎮 Konami 彩蛋！','success');
document.body.style.transition='transform 1s';
document.body.style.transform='rotate(360deg)';
setTimeout(function(){document.body.style.transform='';document.body.style.transition='';},1000);
}
}else{pos=0;}
});
}
};

Community.initThemes=function(){
var current=localStorage.getItem('theme')||'light';
if(current==='cyber'){
document.documentElement.setAttribute('data-theme','dark');
document.documentElement.style.setProperty('--accent-cyan','#00ffcc');
document.documentElement.style.setProperty('--accent-purple','#ff00ff');
}
if(current==='purple'){
document.documentElement.setAttribute('data-theme','dark');
document.documentElement.style.setProperty('--accent-cyan','#a855f7');
document.documentElement.style.setProperty('--accent-purple','#ec4899');
}
};

Community.initPWA=function(){
if(!document.querySelector('link[rel="manifest"]')){
var manifest={
name:'乐哲软件',
short_name:'乐哲',
start_url:'./',
display:'standalone',
background_color:'#f0f4fa',
theme_color:'#0077ff',
icons:[
{src:'./icon-192.png',sizes:'192x192',type:'image/png'},
{src:'./icon-512.png',sizes:'512x512',type:'image/png'}
]
};
var blob=new Blob([JSON.stringify(manifest)],{type:'application/json'});
var link=document.createElement('link');
link.rel='manifest';
link.href=URL.createObjectURL(blob);
document.head.appendChild(link);
}
if('serviceWorker' in navigator){
navigator.serviceWorker.register('./sw.js').then(function(reg){
if(reg&&reg.update)reg.update();
}).catch(function(){});
}
};

if(document.readyState==='loading'){
document.addEventListener('DOMContentLoaded',Community.init);
}else{
Community.init();
}
})();
