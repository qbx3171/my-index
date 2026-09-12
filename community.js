(function () {
  'use strict';

  var FALLBACK_URL = 'https://qqcxtfayjxyvswblmdpw.supabase.co';
  var FALLBACK_KEY = 'sb_publishable__KOJGRcvoRGC3QiHNg7_qA_-9yGsnCW';

  function getClient() {
    if (window.supabaseClient) return window.supabaseClient;
    if (typeof supabase === 'undefined') return null;
    try {
      var url = window.SUPABASE_URL || FALLBACK_URL;
      var key = window.SUPABASE_ANON_KEY || FALLBACK_KEY;
      window.supabaseClient = supabase.createClient(url, key);
      return window.supabaseClient;
    } catch (err) {
      return null;
    }
  }

  function escHtml(input) {
    if (input === null || input === undefined) return '';
    var div = document.createElement('div');
    div.textContent = String(input);
    return div.innerHTML;
  }

  function escAttr(input) {
    if (input === null || input === undefined) return '';
    return String(input)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function injectStyles() {
    if (document.getElementById('rankingModuleStyles')) return;
    var style = document.createElement('style');
    style.id = 'rankingModuleStyles';
    style.textContent =
      '.ranking-item{display:flex;align-items:center;gap:12px;padding:10px 12px;' +
      'border-bottom:1px solid var(--border-glow);cursor:pointer;transition:background .2s}' +
      '.ranking-item:last-child{border-bottom:none}' +
      '.ranking-item:hover{background:rgba(0,119,255,0.04)}' +
      '.ranking-item .rank-num{font-size:1.1rem;font-weight:700;width:32px;' +
      'text-align:center;flex-shrink:0}' +
      '.ranking-item .rank-info{flex:1;min-width:0}' +
      '.ranking-item .rank-title{font-size:0.85rem;font-weight:600;' +
      'color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.ranking-item .rank-meta{font-size:0.65rem;color:var(--text-dim);' +
      'display:flex;gap:8px;margin-top:2px}';
    document.head.appendChild(style);
  }

  function buildRankingButton() {
    var floatBox = document.getElementById('shareFloat');
    if (!floatBox) return null;

    var wechatAnchor = null;
    var links = floatBox.querySelectorAll('a');
    for (var i = 0; i < links.length; i++) {
      var t = links[i].getAttribute('title') || '';
      var oc = links[i].getAttribute('onclick') || '';
      if (t.indexOf('微信') !== -1 || oc.indexOf('wechat') !== -1) {
        wechatAnchor = links[i];
        break;
      }
    }

    var btn = document.getElementById('rankingBtn');
    if (!btn) {
      btn = document.createElement('a');
      btn.id = 'rankingBtn';
      btn.href = '#';
      btn.title = '社区排行榜';
      btn.innerHTML = '<i class="fas fa-trophy"></i>';
    }

    if (wechatAnchor) {
      if (btn.parentNode !== floatBox || btn.nextSibling !== wechatAnchor) {
        floatBox.insertBefore(btn, wechatAnchor);
      }
    } else if (btn.parentNode !== floatBox) {
      floatBox.insertBefore(btn, floatBox.firstChild);
    }
    return btn;
  }

  function buildRankingModal() {
    var modal = document.getElementById('rankingModal');
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
          '<button class="close-btn" id="rankingModalClose" ' +
          'style="float:none;margin-left:auto;color:rgba(255,255,255,0.8);' +
          'font-size:1.5rem;background:none;border:none;cursor:pointer;">&times;</button>' +
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
    buildRankingModal().classList.add('open');
    loadRanking();
  }

  function closeRanking() {
    var modal = document.getElementById('rankingModal');
    if (modal) modal.classList.remove('open');
  }

  function loadRanking() {
    var box = document.getElementById('rankingList');
    if (!box) return;

    var client = getClient();
    if (!client) {
      box.innerHTML =
        '<p style="color:var(--text-dim);text-align:center;padding:24px;">' +
        '服务未加载，请稍后重试</p>';
      return;
    }

    box.innerHTML =
      '<p style="color:var(--text-dim);text-align:center;padding:24px;">加载中...</p>';

    client
      .from('questions')
      .select('*')
      .order('votes', { ascending: false })
      .limit(10)
      .then(function (res) {
        if (res.error) {
          box.innerHTML =
            '<p style="color:var(--text-dim);text-align:center;padding:24px;">' +
            '加载失败，请稍后重试</p>';
          return;
        }
        var list = res.data || [];
        if (list.length === 0) {
          box.innerHTML =
            '<p style="color:var(--text-dim);text-align:center;padding:24px;">' +
            '暂无排行数据</p>';
          return;
        }
        var html = '';
        for (var i = 0; i < list.length; i++) {
          var item = list[i];
          var medal = '#' + (i + 1);
          if (i === 0) medal = '🥇';
          else if (i === 1) medal = '🥈';
          else if (i === 2) medal = '🥉';
          html +=
            '<div class="ranking-item" data-id="' + escAttr(item.id) + '">' +
              '<span class="rank-num">' + medal + '</span>' +
              '<div class="rank-info">' +
                '<div class="rank-title">' + escHtml(item.title) + '</div>' +
                '<div class="rank-meta">' +
                  '<span>' + escHtml(item.category) + '</span>' +
                  '<span>👍 ' + (item.votes || 0) + '</span>' +
                  '<span>💬 ' + (item.answers_count || 0) + '</span>' +
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
        box.innerHTML =
          '<p style="color:var(--text-dim);text-align:center;padding:24px;">' +
          '网络异常，请稍后重试</p>';
      });
  }

  function handleClick(e) {
    var target = e.target;

    var rankingTrigger = target.closest ? target.closest('#rankingBtn') : null;
    if (rankingTrigger) {
      e.preventDefault();
      e.stopPropagation();
      openRanking();
      return;
    }

    var closer = target.closest
      ? target.closest('#rankingModalClose, #rankingModalCloseBtn')
      : null;
    if (closer) {
      e.preventDefault();
      e.stopPropagation();
      closeRanking();
      return;
    }

    var modal = document.getElementById('rankingModal');
    if (modal && target === modal) {
      closeRanking();
    }
  }

  function handleKey(e) {
    if (e.key !== 'Escape') return;
    var modal = document.getElementById('rankingModal');
    if (modal && modal.classList.contains('open')) {
      closeRanking();
    }
  }

  var installed = false;

  function install() {
    if (installed) return;
    installed = true;
    injectStyles();
    buildRankingButton();
    buildRankingModal();
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKey);
  }

  function boot() {
    install();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.RankingModule = {
    open: openRanking,
    close: closeRanking,
    refresh: loadRanking,
    ensureButton: buildRankingButton
  };
})();
