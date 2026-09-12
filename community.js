(function(){
var Community={};
window.Community=Community;
Community.currentSoft=null;

Community.escapeHTML=function(str){
  if(str===null||str===undefined)return '';
  var d=document.createElement('div');
  d.textContent=String(str);
  return d.innerHTML;
};

Community.init=function(){
  if(typeof supabaseClient==='undefined'||!supabaseClient){setTimeout(Community.init,500);return;}
  Community.hijackDetailOpen();
  Community.hijackGoProfile();
  Community.hijackFavoriteToggle();
  Community.hijackViewHistory();
  Community.addNotificationBell();
  Community.addRandomButton();
  Community.addLeaderboard();
  Community.initEasterEggs();
  Community.initThemes();
  Community.initPWA();
  Community.bindAuthListener();
};

Community.bindAuthListener=function(){
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
  }catch(e){}
  setTimeout(function(){
    if(window.currentUser){Community.onLogin();}
  },1800);
};

Community.onLogin=async function(){
  Community.refreshProfileIfVisible();
  await Community.ensureProfile();
  await Promise.all([
    Community.syncFavorites(),
    Community.syncHistory(),
    Community.loadPoints(),
    Community.loadNotifications()
  ]);
  Community.updateAvatarLevel();
  Community.refreshProfileIfVisible();
};

// ... 其他保持

Community.hijackGoProfile=function(){
  if(!window.App||App._communityHijacked)return;
  App._communityHijacked=true;
  var orig=App.goProfile;
  App.goProfile=function(){
    orig.call(App);
    Community.injectProfile();
    setTimeout(function(){Community.reloadPoints().then(Community.injectProfile);},80);
  };
};

Community.injectProfile=function(){
  var container=document.getElementById('profileContent');
  if(!container)return;
  var old=document.getElementById('communityProfileSection');
  if(old)old.remove();
  var points=window.userPoints||0;
  var level=window.userLevel||1;
  var streak=window.userStreak||0;
  var today=new Date(Date.now()+8*3600*1000).toISOString().slice(0,10);
  var checkedIn=window.userLastCheckin===today;
  var btnText=checkedIn?'✅ 已签到':'每日签到';
  var btnDisabled=checkedIn?'disabled':'';
  var section=document.createElement('div');
  section.id='communityProfileSection';
  section.style.cssText='margin-top:16px;';
  section.innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">'+
    '<div style="background:var(--bg-card);border-radius:12px;padding:16px;border:1px solid var(--border-glow);text-align:center;">'+
    '<div style="font-size:1.5rem;font-weight:700;color:var(--accent-cyan);" id="communityPoints">'+points+'</div>'+
    '<div style="font-size:0.75rem;color:var(--text-dim);">积分</div>'+
    '<button class="btn btn-sm btn-primary" id="communityCheckinBtn" style="margin-top:8px;" '+btnDisabled+'>'+btnText+'</button></div>'+
    '<div style="background:var(--bg-card);border-radius:12px;padding:16px;border:1px solid var(--border-glow);text-align:center;">'+
    '<div style="font-size:1.5rem;font-weight:700;color:var(--accent-cyan);" id="communityLevel">Lv'+level+'</div>'+
    '<div style="font-size:0.75rem;color:var(--text-dim);">等级</div>'+
    '<div style="font-size:0.7rem;color:var(--text-dim);margin-top:4px;">连续签到 <span id="communityStreak">'+streak+'</span> 天</div></div>'+
    '</div>';
  container.appendChild(section);
  var btn=document.getElementById('communityCheckinBtn');
  if(btn&&!checkedIn)btn.onclick=Community.doCheckin;
};

Community.doCheckin=async function(){
  if(!window.currentUser){
    Community.requireLogin();
    return;
  }
  // ... 同前
};

Community.requireLogin=function(){
  if(typeof toast==='function')toast('请先登录','warning');
  var lm=document.getElementById('loginModal');
  if(lm)lm.classList.add('open');
};

// 排行榜改到右下角
Community.addLeaderboard=function(){
  if(document.getElementById('communityLeaderboard'))return;
  var div=document.createElement('div');
  div.id='communityLeaderboard';
  div.style.cssText='position:fixed;right:0;bottom:80px;z-index:60;display:flex;align-items:center;font-family:inherit;';
  // 面板内容同前
};
