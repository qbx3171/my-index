/* community.js - 社区排行榜模块（独立、兼容、防冲突） */
(function () {
  'use strict';

  /* ========== 工具函数 ========== */
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

  /* ========== 样式 ========== */
  function injectStyles() {
    if ($('rankingModuleStyles')) return;
    var st = document.createElement('style');
    st.id = 'rankingModuleStyles';
    st.textContent =
      '.ranking-item{display:flex;align-items:center;gap:12px;padding:10px 12px;' +
      'border-bottom:1px solid var(--border-glow);cursor:pointer;transition:background .2s;}' +
      '.ranking-item:last-child{border-bottom:none;}' +
      '.ranking-item:hover{background:rgba(0,119,255,0.04);}' +
      '.ranking-item .rank-num{font-size:1.1rem;font-weight:700;width:32px;' +
      'text-align:center;flex-shrink:0;}' +
      '.ranking-item .rank-info{flex:1;min-width:0;}' +
      '.ranking-item .rank-title{font-size:0.85rem;font-weight:600;' +
      'color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.ranking-item .rank-meta{font-size:0.65rem;color:var(--text-dim);' +
      'display:flex;gap:8px;margin-top:2px;}';
    document.head.appendChild(st);
  }

  /* ========== 按钮位置：放到"微信"按钮上方 ========== */
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
      btn.title = '社区排行榜';
      btn.innerHTML = '<i class="fas fa-trophy"></i>';
    }

    if (wechat) {
      /* 让 btn 位于 wechat 之前（上方），用 element 判断避免文本节点干扰 */
      if (btn.nextElementSibling !== wechat || btn.parentNode !== box) {
        box.insertBefore(btn, wechat);
      }
    } else {
      if (btn.parentNode !== box) {
        box.insertBefore(btn, box.firstChild);
      }
    }
  }

  /* ========== 弹窗：若 HTML 已存在则复用，不存在才创建 ========== */
  function ensureModal() {
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
          '<h3 style="margin:0;font-size:1.2rem;font-weight:700;color:#fff;">社区排行榜</h3>' +
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

  /* ========== 打开 / 关闭 ========== */
  function openRanking() {
    ensureModal().classList.add('open');
    loadRanking();
  }

  function closeRanking() {
    var m = $('rankingModal');
    if (m) m.classList.remove('open');
  }

  /* ========== 加载数据 ========== */
  function loadRanking() {
    var box = $('rankingList');
    if (!box) return;

    var sb = getClient();
    if (!sb) {
      box.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:24px;">服务未加载，请稍后重试</p>';
      return;
    }

    box.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:24px;">加载中...</p>';

    sb.from('questions')
      .select('*')
      .order('votes', { ascending: false })
      .limit(10)
      .then(function (res) {
        if (res.error) {
          box.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:24px;">加载失败，请稍后重试</p>';
          return;
        }
        var list = res.data || [];
        if (list.length === 0) {
          box.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:24px;">暂无排行数据</p>';
          return;
        }
        var html = '';
        for (var i = 0; i < list.length; i++) {
          var it = list[i];
          var medal = '#' + (i + 1);
          if (i === 0) medal = '🥇';
          else if (i === 1) medal = '🥈';
          else if (i === 2) medal = '🥉';
          html +=
            '<div class="ranking-item" data-id="' + escA(it.id) + '">' +
              '<span class="rank-num">' + medal + '</span>' +
              '<div class="rank-info">' +
                '<div class="rank-title">' + esc(it.title) + '</div>' +
                '<div class="rank-meta">' +
                  '<span>' + esc(it.category) + '</span>' +
                  '<span>👍 ' + (it.votes || 0) + '</span>' +
                  '<span>💬 ' + (it.answers_count || 0) + '</span>' +
                '</div>' +
              '</div>' +
            '</div>';
        }
        box.innerHTML = html;

        var items = box.querySelectorAll('.ranking-item');
        for (var j = 0; j < items.length; j++) {
          items[j].addEventListener('click', function () {
            var qid = this.getAttribute('data-id');
            closeRanking();
            if (window.App && typeof window.App.goQA === 'function') {
              window.App.goQA();
            }
            setTimeout(function () {
              if (typeof window.showQuestionDetail === 'function') {
                window.showQuestionDetail(qid);
              }
            }, 400);
          });
        }
      })
      .catch(function () {
        box.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:24px;">网络异常，请稍后重试</p>';
      });
  }

  /* ========== 事件：使用捕获阶段，优先拦截 ========== */
  function onClickCapture(e) {
    var t = e.target;
    if (!t || !t.closest) return;

    /* 打开排行榜 */
    if (t.closest('#rankingBtn')) {
      e.preventDefault();
      e.stopPropagation();
      openRanking();
      return;
    }

    /* 关闭按钮 */
    if (t.closest('#rankingModalClose') || t.closest('#rankingModalCloseBtn')) {
      e.preventDefault();
      e.stopPropagation();
      closeRanking();
      return;
    }

    /* 点击空白遮罩关闭 */
    var modal = $('rankingModal');
    if (modal && modal.classList.contains('open') && t === modal) {
      closeRanking();
    }
  }

  function onKeyDown(e) {
    if (e.key !== 'Escape') return;
    var modal = $('rankingModal');
    if (modal && modal.classList.contains('open')) closeRanking();
  }

  /* ========== 启动 ========== */
  var started = false;
  function start() {
    if (started) return;
    started = true;
    try { injectStyles(); } catch (e) {}
    try { placeButton(); } catch (e) {}
    try { ensureModal(); } catch (e) {}
    document.addEventListener('click', onClickCapture, true);
    document.addEventListener('keydown', onKeyDown, false);
  }

  /* 页面加载完成后启动；若按钮由主脚本动态渲染，也再兜底重试几次 */
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

  /* 对外暴露 */
  window.RankingModule = {
    open: openRanking,
    close: closeRanking,
    refresh: loadRanking,
    place: placeButton
  };
})();
