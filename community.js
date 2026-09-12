console.log('community.js v8 loaded');

(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    if (s === null || s === undefined) return '';
    var d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }

  function escA(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function getClient() {
    if (window.supabaseClient) return window.supabaseClient;
    if (typeof window.supabase === 'undefined') return null;
    try {
      var url = window.SUPABASE_URL || 'https://qqcxtfayjxyvswblmdpw.supabase.co';
      var key = window.SUPABASE_ANON_KEY || 'sb_publishable__KOJGRcvoRGC3QiHNg7_qA_-9yGsnCW';
      window.supabaseClient = window.supabase.createClient(url, key);
      return window.supabaseClient;
    } catch (e) { return null; }
  }

  function toast(msg, type) {
    if (typeof window.toast === 'function') window.toast(msg, type);
    else alert(msg);
  }

  function todayStr() {
    var d = new Date();
    var y = d.getFullYear();
    var m = ('0' + (d.getMonth() + 1)).slice(-2);
    var day = ('0' + d.getDate()).slice(-2);
    return y + '-' + m + '-' + day;
  }

  var POINT_FIELDS = ['checkin_points', 'points', 'total_points', 'score', 'credits', 'sign_points'];
  var NAME_FIELDS = ['username', 'nickname', 'display_name', 'name'];
  var AVATAR_FIELDS = ['avatar_url', 'avatar', 'photo_url'];

  function getProfilePoints(p) {
    for (var i = 0; i < POINT_FIELDS.length; i++) {
      if (p && p[POINT_FIELDS[i]] !== undefined && p[POINT_FIELDS[i]] !== null) {
        return { field: POINT_FIELDS[i], value: p[POINT_FIELDS[i]] };
      }
    }
    return { field: POINT_FIELDS[0], value: 0 };
  }

  function getName(p) {
    for (var i = 0; i < NAME_FIELDS.length; i++) {
      if (p && p[NAME_FIELDS[i]]) return p[NAME_FIELDS[i]];
    }
    if (p && p.email) return p.email.split('@')[0];
    return '匿名用户';
  }

  function getAvatar(p) {
    for (var i = 0; i < AVATAR_FIELDS.length; i++) {
      if (p && p[AVATAR_FIELDS[i]]) return p[AVATAR_FIELDS[i]];
    }
    return '';
  }

  function injectStyles() {
    if ($('communityModuleStyles')) return;
    var st = document.createElement('style');
    st.id = 'communityModuleStyles';
    st.textContent =
      '.ranking-item{display:flex;align-items:center;gap:12px;padding:10px 12px;' +
      'border-bottom:1px solid var(--border-glow);cursor:pointer;transition:background .2s;}' +
      '.ranking-item:last-child{border-bottom:none;}' +
      '.ranking-item:hover{background:rgba(0,119,255,0.04);}' +
      '.ranking-item .rank-num{font-size:1.1rem;font-weight:700;width:32px;' +
      'text-align:center;flex-shrink:0;}' +
      '.ranking-item .rank-avatar{width:32px;height:32px;border-radius:50%;' +
      'background:var(--accent-gradient);color:#fff;display:flex;align-items:center;' +
      'justify-content:center;font-size:.75rem;font-weight:600;flex-shrink:0;overflow:hidden;}' +
      '.ranking-item .rank-avatar img{width:100%;height:100%;object-fit:cover;}' +
      '.ranking-item .rank-info{flex:1;min-width:0;}' +
      '.ranking-item .rank-title{font-size:0.85rem;font-weight:600;' +
      'color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.ranking-item .rank-meta{font-size:0.65rem;color:var(--text-dim);' +
      'display:flex;gap:8px;margin-top:2px;}' +
      '.review-star{cursor:pointer;transition:color .2s;}' +
      '.review-star.active{color:#f39c12;}' +
      '.checkin-card{margin-top:16px;padding:18px 20px;background:var(--bg-card);' +
      'border:1px solid var(--border-glow);border-radius:var(--radius-md);' +
      'display:flex;align-items:center;gap:16px;flex-wrap:wrap;}' +
      '.checkin-card .checkin-icon{width:52px;height:52px;border-radius:50%;' +
      'background:var(--accent-gradient);color:#fff;display:flex;align-items:center;' +
      'justify-content:center;font-size:1.5rem;flex-shrink:0;}' +
      '.checkin-card .checkin-info{flex:1;min-width:140px;}' +
      '.checkin-card .checkin-info .t{font-size:1rem;font-weight:700;color:var(--text-primary);}' +
      '.checkin-card .checkin-info .s{font-size:0.75rem;color:var(--text-dim);margin-top:2px;}' +
      '.checkin-card .checkin-btn{padding:10px 22px;border-radius:50px;font-weight:700;' +
      'font-size:0.85rem;background:var(--accent-gradient);color:#fff;border:none;' +
      'cursor:pointer;transition:transform .15s;}' +
      '.checkin-card .checkin-btn:hover{transform:translateY(-2px);}' +
      '.checkin-card .checkin-btn:disabled{opacity:.5;cursor:not-allowed;transform:none;}';
    document.head.appendChild(st);
  }

  /* ========== 签到 ========== */
  var checkinState = { loading: false };

  function renderCheckinCard(profile) {
    var container = $('profileContent');
    if (!container) return;

    var old = $('checkinCard');
    if (old) old.parentNode.removeChild(old);

    var pts = getProfilePoints(profile);
    var sb = getClient();

    var card = document.createElement('div');
    card.className = 'checkin-card';
    card.id = 'checkinCard';
    card.innerHTML =
      '<div class="checkin-icon"><i class="fas fa-calendar-check"></i></div>' +
      '<div class="checkin-info">' +
        '<div class="t">每日签到</div>' +
        '<div class="s">当前积分：<span id="checkinPointsVal">' + esc(pts.value) + '</span> 分</div>' +
      '</div>' +
      '<button class="checkin-btn" id="checkinBtn"><i class="fas fa-check-circle"></i> 立即签到</button>';

    container.insertBefore(card, container.firstChild);

    var btn = $('checkinBtn');
    if (btn) {
      btn.addEventListener('click', function () { doCheckin(profile); });
    }

    var today = todayStr();
    if (sb && window.currentUser) {
      sb.from('checkins')
        .select('id')
        .eq('user_id', window.currentUser.id)
        .eq('checkin_date', today)
        .maybeSingle()
        .then(function (res) {
          if (res.data) {
            var b = $('checkinBtn');
            if (b) {
              b.disabled = true;
              b.innerHTML = '<i class="fas fa-check"></i> 今日已签到';
            }
          }
        })
        .catch(function () {});
    }
  }

  function doCheckin(profile) {
    if (checkinState.loading) return;
    var sb = getClient();
    if (!sb) { toast('服务未加载', 'error'); return; }
    var user = window.currentUser;
    if (!user) { toast('请先登录', 'warning'); return; }

    checkinState.loading = true;
    var btn = $('checkinBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '签到中...'; }

    var today = todayStr();

    sb.from('checkins')
      .select('id')
      .eq('user_id', user.id)
      .eq('checkin_date', today)
      .maybeSingle()
      .then(function (res) {
        if (res.data) {
          toast('今天已经签到过啦～', 'warning');
          if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-check"></i> 今日已签到'; }
          checkinState.loading = false;
          return;
        }

        sb.from('checkins')
          .insert([{ user_id: user.id, checkin_date: today, points: 1 }])
          .then(function (insRes) {
            if (insRes.error) {
              toast('签到失败：' + insRes.error.message, 'error');
              if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check-circle"></i> 立即签到'; }
              checkinState.loading = false;
              return;
            }
            addPoints(sb, user.id, 1, profile, btn);
          })
          .catch(function () {
            toast('签到异常，请稍后重试', 'error');
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check-circle"></i> 立即签到'; }
            checkinState.loading = false;
          });
      })
      .catch(function () {
        toast('签到异常，请稍后重试', 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check-circle"></i> 立即签到'; }
        checkinState.loading = false;
      });
  }

  function addPoints(sb, userId, delta, profile, btn) {
    var pts = getProfilePoints(profile);
    var field = pts.field;
    var newVal = (pts.value || 0) + delta;

    var update = {};
    update[field] = newVal;

    sb.from('profiles')
      .update(update)
      .eq('id', userId)
      .then(function (res) {
        if (res.error) {
          toast('签到成功，但积分更新失败', 'warning');
        } else {
          toast('签到成功！+' + delta + ' 积分', 'success');
          var ptsEl = $('checkinPointsVal');
          if (ptsEl) ptsEl.textContent = newVal;
        }
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-check"></i> 今日已签到'; }
        checkinState.loading = false;
        if (window.userProfile) {
          try { window.userProfile[field] = newVal; } catch (e) {}
        }
      })
      .catch(function () {
        toast('签到成功，积分同步异常', 'warning');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-check"></i> 今日已签到'; }
        checkinState.loading = false;
      });
  }

  function observeProfile() {
    var container = $('profileContent');
    if (!container) return;
    var lastHtmlLen = 0;
    var observer = new MutationObserver(function () {
      var len = container.innerHTML.length;
      if (len !== lastHtmlLen) {
        lastHtmlLen = len;
        if (window.currentUser) {
          setTimeout(function () {
            var p = window.userProfile || null;
            if (!p) {
              var sb = getClient();
              if (sb && window.currentUser) {
                sb.from('profiles').select('*').eq('id', window.currentUser.id).maybeSingle()
                  .then(function (r) {
                    if (r.data) {
                      window.userProfile = r.data;
                      renderCheckinCard(r.data);
                    } else {
                      renderCheckinCard({});
                    }
                  })
                  .catch(function () { renderCheckinCard({}); });
              } else {
                renderCheckinCard({});
              }
            } else {
              renderCheckinCard(p);
            }
          }, 150);
        }
      }
    });
    observer.observe(container, { childList: true, subtree: true });
  }

  /* ========== 签到积分排行榜 ========== */
  function placeButton() {
    var box = $('shareFloat');
    if (!box) return;
    var wechat = null;
    var anchors = box.getElementsByTagName('a');
    for (var i = 0; i < anchors.length; i++) {
      var title = anchors[i].getAttribute('title') || '';
      var onclick = anchors[i].getAttribute('onclick') || '';
      if (title.indexOf('微信') !== -1 || onclick.indexOf('wechat') !== -1) {
        wechat = anchors[i];
        break;
      }
    }
    var btn = $('rankingBtn');
    if (!btn) {
      btn = document.createElement('a');
      btn.id = 'rankingBtn';
      btn.href = '#';
      btn.title = '签到积分榜';
      btn.innerHTML = '<i class="fas fa-trophy"></i>';
    }
    if (wechat) {
      if (btn.parentNode !== box || btn.nextElementSibling !== wechat) {
        box.insertBefore(btn, wechat);
      }
    } else if (btn.parentNode !== box) {
      box.insertBefore(btn, box.firstChild);
    }
  }

  function ensureRankingModal() {
    var modal = $('rankingModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'rankingModal';
    modal.innerHTML =
      '<div class="modal-box" style="max-width:520px;padding:0;overflow:hidden;">' +
        '<div style="background:var(--accent-gradient);padding:20px 24px;color:#fff;' +
        'display:flex;align-items:center;gap:10px;">' +
          '<i class="fas fa-trophy" style="font-size:1.4rem;"></i>' +
          '<h3 style="margin:0;font-size:1.2rem;font-weight:700;color:#fff;">签到积分榜</h3>' +
          '<button class="close-btn" id="rankingModalClose" style="float:none;' +
          'margin-left:auto;color:rgba(255,255,255,0.8);font-size:1.5rem;' +
          'background:none;border:none;cursor:pointer;">&times;</button>' +
        '</div>' +
        '<div id="rankingList" style="max-height:60vh;overflow-y:auto;' +
        'scrollbar-width:thin;scrollbar-color:rgba(0,119,255,0.2) transparent;' +
        'padding:4px 0;"></div>' +
        '<div class="form-actions" style="padding:12px 24px 16px;' +
        'border-top:1px solid var(--border-glow);">' +
          '<button class="btn btn-outline" id="rankingModalCloseBtn">关闭</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    return modal;
  }

  function openRanking() {
    ensureRankingModal().classList.add('open');
    loadRanking();
  }

  function closeRanking() {
    var m = $('rankingModal');
    if (m) m.classList.remove('open');
  }

  function loadRanking() {
    var box = $('rankingList');
    if (!box) return;
    var sb = getClient();
    if (!sb) {
      box.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:24px;">服务未加载，请稍后重试</p>';
      return;
    }
    box.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:24px;">加载中...</p>';

    var idx = 0;
    function tryNext() {
      if (idx >= POINT_FIELDS.length) {
        box.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:24px;">暂无积分数据</p>';
        return;
      }
      var field = POINT_FIELDS[idx++];
      sb.from('profiles')
        .select('*')
        .order(field, { ascending: false })
        .limit(10)
        .then(function (res) {
          if (res.error) { tryNext(); return; }
          var list = res.data || [];
          if (list.length === 0) {
            box.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:24px;">暂无签到数据，快去签到吧！</p>';
            return;
          }
          renderRankList(list, field);
        })
        .catch(function () { tryNext(); });
    }
    tryNext();
  }

  function renderRankList(list, pointField) {
    var box = $('rankingList');
    if (!box) return;
    var html = '';
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      var medal = '#' + (i + 1);
      if (i === 0) medal = '🥇';
      else if (i === 1) medal = '🥈';
      else if (i === 2) medal = '🥉';

      var displayName = getName(it);
      var avatarUrl = getAvatar(it);
      var avatarHtml = avatarUrl
        ? '<img src="' + escA(avatarUrl) + '" alt="" onerror="this.style.display=\'none\';this.parentElement.textContent=\'' + escA(displayName.charAt(0).toUpperCase()) + '\';" />'
        : esc(displayName.charAt(0).toUpperCase());
      var pointVal = it[pointField] || 0;

      html +=
        '<div class="ranking-item" data-id="' + escA(it.id || '') + '">' +
          '<span class="rank-num">' + medal + '</span>' +
          '<span class="rank-avatar">' + avatarHtml + '</span>' +
          '<div class="rank-info">' +
            '<div class="rank-title">' + esc(displayName) + '</div>' +
            '<div class="rank-meta">' +
              '<span><i class="fas fa-coins" style="color:#f39c12;"></i> ' + pointVal + ' 积分</span>' +
            '</div>' +
          '</div>' +
        '</div>';
    }
    box.innerHTML = html;
  }

  /* ========== 软件评价 ========== */
  function injectReviewButton() {
    var actions = document.querySelector('.detail-actions');
    if (!actions) return;
    if ($('softwareReviewBtn')) return;
    var btn = document.createElement('button');
    btn.className = 'btn btn-outline';
    btn.id = 'softwareReviewBtn';
    btn.innerHTML = '<i class="fas fa-star"></i> 评价';
    btn.style.marginLeft = '6px';
    btn.onclick = function () {
      var soft = window.Detail && window.Detail._currentSoft;
      if (!soft) { toast('无法获取软件信息', 'warning'); return; }
      openReviewModal(soft);
    };
    actions.appendChild(btn);
  }

  function injectReviewSection() {
    var modalBody = document.querySelector('.detail-modal .modal-body');
    if (!modalBody) return;
    if ($('detailReviews')) return;
    var section = document.createElement('div');
    section.id = 'detailReviews';
    section.style.marginTop = '14px';
    section.style.borderTop = '1px solid var(--border-glow)';
    section.style.paddingTop = '12px';
    section.innerHTML = '<h4 style="font-size:0.85rem;font-weight:600;margin-bottom:10px;">' +
      '<i class="fas fa-comments"></i> 用户评价</h4>' +
      '<div id="reviewListContainer" style="font-size:0.8rem;color:var(--text-secondary);">加载中...</div>';
    modalBody.appendChild(section);
  }

  function loadReviews(softwareId) {
    var container = $('reviewListContainer');
    if (!container) return;
    var sb = getClient();
    if (!sb) { container.innerHTML = '服务未加载'; return; }
    sb.from('software_reviews')
      .select('*')
      .eq('software_id', softwareId)
      .order('created_at', { ascending: false })
      .then(function (res) {
        if (res.error) { container.innerHTML = '暂无评价，来写第一条吧！'; return; }
        var list = res.data || [];
        if (list.length === 0) { container.innerHTML = '暂无评价，来写第一条吧！'; return; }
        var html = '';
        for (var i = 0; i < list.length; i++) {
          var r = list[i];
          var stars = '';
          for (var s = 1; s <= 5; s++) stars += s <= (r.rating || 5) ? '★' : '☆';
          html +=
            '<div style="padding:8px 0;border-bottom:1px solid var(--border-glow);">' +
              '<div style="display:flex;justify-content:space-between;margin-bottom:2px;">' +
                '<span style="font-weight:600;color:var(--text-primary);">' + esc(r.user_name || '匿名用户') + '</span>' +
                '<span style="color:#f39c12;">' + stars + '</span>' +
              '</div>' +
              '<div style="line-height:1.5;">' + esc(r.content) + '</div>' +
            '</div>';
        }
        container.innerHTML = html;
      })
      .catch(function () { container.innerHTML = '评价加载异常'; });
  }

  function ensureReviewModal() {
    var modal = $('reviewModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'reviewModal';
    modal.innerHTML =
      '<div class="modal-box" style="max-width:420px;">' +
        '<button class="close-btn" id="reviewModalClose">&times;</button>' +
        '<h3><i class="fas fa-star"></i> 评价软件</h3>' +
        '<div id="reviewStars" style="font-size:2rem;color:#ccc;margin-bottom:12px;">' +
          '<span class="review-star" data-val="1">★</span>' +
          '<span class="review-star" data-val="2">★</span>' +
          '<span class="review-star" data-val="3">★</span>' +
          '<span class="review-star" data-val="4">★</span>' +
          '<span class="review-star" data-val="5">★</span>' +
        '</div>' +
        '<div class="form-group">' +
          '<textarea id="reviewContent" rows="4" placeholder="写下你的评价..."></textarea>' +
        '</div>' +
        '<div class="form-actions">' +
          '<button class="btn btn-outline" id="reviewCancel">取消</button>' +
          '<button class="btn btn-primary" id="reviewSubmit">提交评价</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    return modal;
  }

  var currentReviewSoftware = null;

  function openReviewModal(soft) {
    currentReviewSoftware = soft;
    var modal = ensureReviewModal();
    modal.classList.add('open');
    $('reviewContent').value = '';
    var stars = modal.querySelectorAll('.review-star');
    for (var i = 0; i < stars.length; i++) stars[i].classList.remove('active');
  }

  function closeReviewModal() {
    var modal = $('reviewModal');
    if (modal) modal.classList.remove('open');
  }

  function submitReview() {
    if (!currentReviewSoftware) return;
    var sb = getClient();
    if (!sb) { toast('服务未加载', 'error'); return; }
    var user = window.currentUser;
    if (!user) {
      toast('请先登录', 'warning');
      closeReviewModal();
      if ($('loginModal')) $('loginModal').classList.add('open');
      return;
    }
    var activeStar = document.querySelector('.review-star.active');
    var rating = activeStar ? parseInt(activeStar.getAttribute('data-val')) : 5;
    var content = $('reviewContent').value.trim();
    if (!content) { toast('请填写评价内容', 'warning'); return; }
    var userName = user.email ? user.email.split('@')[0] : '匿名用户';
    sb.from('software_reviews').insert([{
      software_id: currentReviewSoftware.id,
      user_id: user.id,
      user_name: userName,
      rating: rating,
      content: content
    }]).then(function (res) {
      if (res.error) { toast('评价失败：' + res.error.message, 'error'); return; }
      toast('评价成功！', 'success');
      closeReviewModal();
      loadReviews(currentReviewSoftware.id);
    });
  }

  function bindReviewEvents() {
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t) return;
      if (t.closest('#reviewModalClose') || t.closest('#reviewCancel')) { closeReviewModal(); return; }
      if (t.closest('#reviewSubmit')) { submitReview(); return; }
      if (t.classList.contains('review-star')) {
        var val = parseInt(t.getAttribute('data-val'));
        var stars = document.querySelectorAll('.review-star');
        for (var i = 0; i < stars.length; i++) {
          if (parseInt(stars[i].getAttribute('data-val')) <= val) stars[i].classList.add('active');
          else stars[i].classList.remove('active');
        }
        return;
      }
      var modal = $('reviewModal');
      if (modal && modal.classList.contains('open') && t === modal) closeReviewModal();
    });
  }

  function observeDetailModal() {
    var overlay = $('detailOverlay');
    if (!overlay) return;
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.attributeName === 'class') {
          if (overlay.classList.contains('open')) {
            setTimeout(function () {
              injectReviewButton();
              injectReviewSection();
              var soft = window.Detail && window.Detail._currentSoft;
              if (soft) loadReviews(soft.id);
            }, 200);
          }
        }
      });
    });
    observer.observe(overlay, { attributes: true });
  }

  function onClickCapture(e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('#rankingBtn')) { e.preventDefault(); e.stopPropagation(); openRanking(); return; }
    if (t.closest('#rankingModalClose') || t.closest('#rankingModalCloseBtn')) {
      e.preventDefault(); e.stopPropagation(); closeRanking(); return;
    }
    var modal = $('rankingModal');
    if (modal && modal.classList.contains('open') && t === modal) closeRanking();
  }

  function onKeyDown(e) {
    if (e.key !== 'Escape') return;
    var rModal = $('rankingModal');
    if (rModal && rModal.classList.contains('open')) closeRanking();
    var revModal = $('reviewModal');
    if (revModal && revModal.classList.contains('open')) closeReviewModal();
  }

  var started = false;
  function start() {
    if (started) return;
    started = true;
    try { injectStyles(); } catch (e) {}
    try { placeButton(); } catch (e) {}
    try { ensureRankingModal(); } catch (e) {}
    try { ensureReviewModal(); } catch (e) {}
    try { observeDetailModal(); } catch (e) {}
    try { observeProfile(); } catch (e) {}
    try { bindReviewEvents(); } catch (e) {}
    document.addEventListener('click', onClickCapture, true);
    document.addEventListener('keydown', onKeyDown, false);
  }

  function boot() {
    start();
    setTimeout(placeButton, 300);
    setTimeout(placeButton, 1200);
    setTimeout(placeButton, 2500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.RankingModule = { open: openRanking, close: closeRanking, refresh: loadRanking, place: placeButton };
  window.ReviewModule = { open: openReviewModal, close: closeReviewModal, load: loadReviews };
  window.CheckinModule = { doCheckin: doCheckin };
})();
