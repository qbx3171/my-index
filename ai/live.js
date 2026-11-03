/**
 * /ai/ 板块前端实时层（2026-11-03）
 *
 * 问题：AI 工具/工具集是纯静态页，后台保存后要等 generate.mjs 重跑 + Pages 构建才可见，
 *      而「上传软件」是前端直接读库，秒级生效——两者体验不一致。
 * 做法：静态页仍由 generate.mjs 生成（给搜索引擎和分享用），本脚本在页面加载后再拉一次
 *      Supabase，与页面里的快照（window.__AI_LIVE__）比对；数据一致就什么都不做（零开销），
 *      不一致才用本地数据重绘侧栏 / 卡片列表 / 对比表，让新上传的工具立刻出现。
 * 尚未生成静态详情页的工具：卡片点开走页内浮层展示完整介绍，避免 404。
 * 注意：卡片、分区、对比表的 class 名必须与 seo/ai-section.mjs 保持一致（同一套 CSS）。
 */
(function () {
  'use strict';
  var CFG = window.__AI_LIVE__;
  if (!CFG || !CFG.api || !CFG.key) return;

  var H = { apikey: CFG.key, Authorization: 'Bearer ' + CFG.key };
  var API = CFG.api.replace(/\/$/, '') + '/rest/v1/';

  // 单次 REST 请求：同一份数据经代理传输时会随机把汉字截断成 U+FFFD（生成器侧已用「5 轮合并」治），
  // 浏览器这边同样会遇到，所以拉 3 次取「乱码最少」的一份；仍有残留就把 U+FFFD 剔除后再渲染，
  // 宁可少一个字也不要把「�」显示给用户（下次重新生成会整体修正）。
  function raw(url) {
    return fetch(url, { headers: H }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.text();
    });
  }
  function badCount(s) {
    var n = 0;
    for (var i = 0; i < s.length; i++) if (s.charCodeAt(i) === 0xfffd) n++;
    return n;
  }
  function pull(sql, tries) {
    var best = null, bestBad = Infinity, n = tries || 3;
    function attempt(i) {
      if (i >= n) return Promise.resolve(best);
      return raw(API + sql).then(function (t) {
        var b = badCount(t);
        if (b < bestBad) { best = t; bestBad = b; }
        if (bestBad === 0) return best;
        return attempt(i + 1);
      }).catch(function () { return attempt(i + 1); });
    }
    return attempt(0).then(function (t) {
      if (!t) return null;
      var dirty = bestBad > 0;
      try { return { rows: JSON.parse(dirty ? t.replace(/\uFFFD+/g, '') : t), dirty: dirty }; }
      catch (e) { return null; }
    });
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function plain(s) {
    return String(s == null ? '' : s).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }
  function slugOf(t) {
    var s = String(t.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '');
    return s || 't-' + String(t.id || '').replace(/-/g, '').slice(0, 8);
  }
  function detailUrl(t) {
    var live = CFG.tools && CFG.tools[slugOf(t)] === t.id;
    return live ? '/ai/tool/' + slugOf(t) + '.html' : '';
  }
  function badgeClass(p) {
    var s = String(p || '');
    if (s.indexOf('免费') >= 0 && s.indexOf('额度') < 0) return 'free';
    if (s.indexOf('订阅') >= 0) return 'sub';
    if (s.indexOf('买断') >= 0) return 'once';
    return 'freemium';
  }
  function cover(item, cls) {
    var logo = String(item.logo || '').trim();
    if (/^https?:\/\//i.test(logo)) {
      return '<img class="' + cls + '" src="' + esc(logo) + '" alt="' + esc(item.name) + ' 封面" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML=aiFallback(' +
        JSON.stringify(String(item.name || 'AI')).replace(/"/g, '&quot;') + ',\'' + cls + '\')">';
    }
    return window.aiFallback ? window.aiFallback(item.name, cls) : '<span class="' + cls + ' ai-cover-fb">' + esc((item.name || 'A').slice(0, 1)) + '</span>';
  }
  function card(t) {
    var href = detailUrl(t);
    var attrs = href ? ' href="' + href + '"' : ' href="#" data-ai-live="' + esc(t.id) + '"';
    return '<a class="ai-card"' + attrs + ' title="' + esc(t.summary || t.name) + '">' +
      cover(t, 'ai-cover') +
      '<span class="ai-card-main"><span class="ai-card-name">' + esc(t.name) + '</span>' +
      '<span class="ai-card-summary">' + esc(t.summary || '') + '</span></span></a>';
  }
  function pricingOf(t) { return String(t.pricing || '免费').trim(); }
  function mixOf(tools) {
    var seen = {}, out = [];
    tools.forEach(function (t) { var p = pricingOf(t); if (!seen[p]) { seen[p] = 1; out.push(p); } });
    return out;
  }
  function secLead(c, tools) {
    var mix = mixOf(tools);
    var names = tools.slice(0, 3).map(function (t) { return t.name; }).join('、') + (tools.length > 3 ? ' 等' : '');
    return c.name + '方向目前收录 ' + tools.length + ' 款：' + names + '，收费模式' +
      (mix.length === 1 ? '均为' + mix[0] : '覆盖' + mix.join(' / ')) + '，点工具名可看功能拆解与官网入口。';
  }
  function section(c, tools) {
    if (!tools.length) return '';
    var hasPage = !!(CFG.pages && CFG.pages[c.slug]);
    var shown = hasPage ? tools.slice(0, 9) : tools;
    var logo = /^https?:\/\//i.test(String(c.logo || ''))
      ? '<img class="ai-sec-logo" src="' + esc(c.logo) + '" alt="">'
      : '<span class="ai-sec-ico">' + esc(c.icon || '🧩') + '</span>';
    return '<section class="ai-sec" id="' + esc(c.slug) + '">' +
      '<div class="ai-sec-head">' + logo + '<h2>' + esc(c.name) + '</h2>' +
      '<span class="ai-sec-count">' + tools.length + ' 款</span>' +
      (hasPage ? '<a class="ai-sec-more" href="/ai/' + esc(c.slug) + '.html">查看更多 &gt;&gt;</a>' : '<span class="ai-sec-count" style="margin-left:auto">尚未生成独立页</span>') +
      '</div><p class="ai-sec-lead">' + esc(secLead(c, tools)) + '</p>' +
      '<div class="ai-cards">' + shown.map(card).join('') + '</div></section>';
  }
  function compare(col, tools) {
    if (!tools.length) return '';
    var rows = tools.map(function (t) {
      var href = detailUrl(t);
      return '<tr><td>' + (href ? '<a href="' + href + '">' + esc(t.name) + '</a>' : '<a href="#" data-ai-live="' + esc(t.id) + '">' + esc(t.name) + '</a>') +
        '</td><td>' + esc(plain(t.summary) || '—') + '</td>' +
        '<td><span class="ai-badge ' + badgeClass(t.pricing) + '">' + esc(pricingOf(t)) + '</span></td></tr>';
    }).join('');
    var mix = mixOf(tools);
    var freeish = tools.filter(function (t) { return badgeClass(t.pricing) !== 'sub'; }).length;
    var priceLine = mix.length === 1
      ? '收录的 ' + tools.length + ' 款工具收费模式均为' + mix[0] + '，试用不需要额外付费。'
      : '收费模式分 ' + mix.length + ' 种：' + mix.map(function (m) {
          return m + ' ' + tools.filter(function (t) { return pricingOf(t) === m; }).length + ' 款';
        }).join('、') + '。';
    var pickLine = tools.length > 1
      ? '款数不多但定位差别明显，按“要产出什么”挑一款就够，不必同时订阅两个：' +
        tools.map(function (t) { return plain(t.name) + '（' + (plain(t.summary) || '综合型') + '）'; }).join('；') + '。'
      : '目前只有一款可对照，建议先按免费通道把完整流程跑一遍（注册 → 输入需求 → 导出成品），确认导出格式、分辨率或字数限制够用再考虑付费。';
    var workLine = freeish
      ? '实际使用时的差别通常在导出环节：免费额度多有次数或水印限制，正式产出前先确认导出文件的格式、尺寸与商用授权说明。'
      : '均为订阅制，上手前先确认是否提供试用；团队使用还要看席位计费与素材版权归属。';
    return '<section class="ai-note ai-compare"><h2>' + esc(col.name) + '快速对比</h2>' +
      '<table><thead><tr><th>工具</th><th>定位</th><th>收费模式</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<p>' + esc(priceLine) + esc(pickLine) + '</p><p>' + esc(workLine) + '</p></section>';
  }
  function sideList(cols, active) {
    return '<a class="ai-side-brand" href="/ai/index.html"><span class="ai-side-brand-ico">🤖</span>乐哲Ai工具集</a><nav class="ai-side-menu">' +
      cols.map(function (c) {
        var ico = /^https?:\/\//i.test(String(c.logo || ''))
          ? '<img class="ai-side-logo" src="' + esc(c.logo) + '" alt="" loading="lazy">'
          : '<span class="ai-side-ico">' + esc(c.icon || '🧩') + '</span>';
        var href = CFG.pages && CFG.pages[c.slug] ? '/ai/' + esc(c.slug) + '.html' : '/ai/index.html';
        return '<a class="ai-side-item' + (c.slug === active ? ' on' : '') + '" href="' + href + '">' + ico +
          '<span class="ai-side-txt">' + esc(c.name) + '</span><span class="ai-side-arr">›</span></a>';
      }).join('') + '</nav>';
  }

  // —— 尚未生成静态页的工具：页内浮层看详情（含简介、截图、官网入口）——
  function openLive(id) {
    var t = null;
    for (var i = 0; i < state.tools.length; i++) if (state.tools[i].id === id) { t = state.tools[i]; break; }
    if (!t) return;
    var shots = String(t.screenshots || '').split(/[\n,，]/).map(function (u) { return u.trim(); })
      .filter(function (u) { return /^https?:\/\//i.test(u); }).slice(0, 6);
    var intro = String(t.intro || '').split(/\n\s*\n/).map(function (p) { return p.replace(/\s+/g, ' ').trim(); })
      .filter(Boolean).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
    var box = document.getElementById('aiLiveModal');
    if (!box) {
      box = document.createElement('div');
      box.id = 'aiLiveModal';
      box.className = 'ai-live-mask';
      box.innerHTML = '<div class="ai-live-box" role="dialog" aria-modal="true"><button class="ai-live-x" type="button" aria-label="关闭">×</button><div class="ai-live-body"></div></div>';
      document.body.appendChild(box);
      box.addEventListener('click', function (e) {
        if (e.target === box || e.target.className === 'ai-live-x') box.classList.remove('on');
      });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') box.classList.remove('on'); });
    }
    box.querySelector('.ai-live-body').innerHTML =
      '<div class="ai-detail-head">' + cover(t, 'ai-detail-cover') +
      '<div class="ai-detail-info"><div class="ai-detail-title"><h2>' + esc(t.name) + '</h2>' +
      '<span class="ai-badge ' + badgeClass(t.pricing) + '">' + esc(pricingOf(t)) + '</span></div>' +
      '<p class="ai-card-summary">' + esc(t.summary || '') + '</p>' +
      '<div class="ai-detail-actions"><a class="ai-site-btn" rel="nofollow noopener" target="_blank" href="' + esc(t.url) + '">访问官网 ↗</a></div></div></div>' +
      (intro ? '<section class="ai-detail-sec"><h3>' + esc(t.name) + ' 是什么</h3>' + intro + '</section>' : '') +
      (shots.length ? '<div class="ai-shots">' + shots.map(function (u, i) {
        return '<a class="ai-shot" href="' + esc(u) + '" target="_blank" rel="noopener"><img src="' + esc(u) + '" alt="' + esc(t.name) + ' 截图' + (i + 1) + '" loading="lazy" referrerpolicy="no-referrer"></a>';
      }).join('') + '</div>' : '') +
      '<p class="ai-live-tip">详情页正在生成（约 1 分钟），本窗口为即时预览。</p>';
    box.classList.add('on');
  }

  var state = { cols: [], tools: [], byCol: {} };

  // —— 详情页：内容改了（简介/一句话说明/收费模式）就地打补丁，不必等重新生成 ——
  function patchDetail(slug) {
    var id = CFG.tools && CFG.tools[slug];
    if (!id) return false;
    var t = null;
    for (var i = 0; i < state.tools.length; i++) if (state.tools[i].id === id) { t = state.tools[i]; break; }
    if (!t) return false;
    var sm = document.querySelector('.ai-detail-info .ai-card-summary');
    if (sm && t.summary !== undefined) sm.textContent = t.summary || '';
    var badge = document.querySelector('.ai-detail-title .ai-badge');
    if (badge) { badge.textContent = pricingOf(t); badge.className = 'ai-badge ' + badgeClass(t.pricing); }
    var intro = String(t.intro || '').split(/\n\s*\n/).map(function (p) { return p.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
    var secs = document.querySelectorAll('.ai-detail-sec');
    for (var j = 0; j < secs.length; j++) {
      var h = secs[j].querySelector('h2');
      if (h && h.textContent.indexOf('是什么') > 0) {
        secs[j].innerHTML = '<h2>' + esc(t.name) + ' 是什么</h2>' + intro.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
        return true;
      }
    }
    if (intro.length) {
      var main = document.querySelector('main');
      var sec = document.createElement('section');
      sec.className = 'ai-detail-sec';
      sec.innerHTML = '<h2>' + esc(t.name) + ' 是什么</h2>' + intro.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
      var back = main && main.querySelector('.ai-back');
      if (main) main.insertBefore(sec, back || null);
    }
    return true;
  }

  function render() {
    var path = location.pathname;
    var m = path.match(/^\/ai\/tool\/([a-z0-9-]+)\.html$/);
    if (m) { patchDetail(m[1]); return; }
    var active = (path.match(/^\/ai\/([a-z0-9-]+)\.html$/) || [])[1] || '';
    var aside = document.querySelector('.ai-side');
    if (aside) aside.innerHTML = sideList(state.cols, active === 'index' ? '' : active);

    var hub = document.getElementById('aiHubBody');
    if (hub) {
      hub.innerHTML = state.cols.map(function (c) { return section(c, state.byCol[c.slug] || []); }).join('');
    }
    var cards = document.getElementById('aiColCards');
    if (cards) {
      var col = null;
      for (var i = 0; i < state.cols.length; i++) if (state.cols[i].slug === active) col = state.cols[i];
      if (col) {
        var list = state.byCol[col.slug] || [];
        cards.innerHTML = list.length ? list.map(card).join('') : cards.innerHTML;
        var cmp = document.getElementById('aiCompare');
        if (cmp) cmp.outerHTML = compare(col, list) || '<div id="aiCompare"></div>';
        var cnt = document.querySelector('.ai-col-hero .ai-lead');
        if (cnt && !list.length) cnt.textContent = col.description || cnt.textContent;
      }
    }
    document.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('[data-ai-live]') : null;
      if (a) { e.preventDefault(); openLive(a.getAttribute('data-ai-live')); }
    });
  }

  // 指纹算法必须与 seo/ai-section.mjs 的 aiSig() 保持一致（含排序键与 djb2 算法）。
  // 万一哪天两边漂移，最坏结果只是「每次访问都重绘」，DOM 相同、用户看不出差别。
  // 指纹只认结构字段（新增/删除/排序/上下架/收费模式），与 seo/ai-section.mjs 的 aiSig() 一致。
  // 刻意不含文本字段：传输抖动会把汉字随机截成 U+FFFD，文本一旦参与指纹，两端就永远不相等。
  function sig(cols, tools) {
    function cmp(x, y, k) {
      var a = x.sort || 0, b = y.sort || 0;
      if (a !== b) return a - b;
      var xs = String(x[k]), ys = String(y[k]);
      return xs < ys ? -1 : xs > ys ? 1 : 0;
    }
    var cs = cols.slice().sort(function (a, b) { return cmp(a, b, 'id'); });
    var ts = tools.slice().sort(function (a, b) { return cmp(a, b, 'id'); });
    var s = cs.map(function (c) {
      return [c.id, c.slug, c.sort, c.is_published].join('|');
    }).join('~') + '#' + ts.map(function (t) {
      return [t.id, t.collection_id, t.sort, t.is_published, t.pricing, t.slug].join('|');
    }).join('~');
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(36) + '-' + s.length;
  }

  // 静态快照已经是当前数据：直接跳过，不发多余请求（正常浏览零成本）
  if (CFG.sig && sessionStorage.getItem('ai-live-sig') === CFG.sig) return;

  Promise.all([
    pull('ai_collections?select=*&order=sort.asc,created_at.asc'),
    pull('ai_tools?select=*&order=sort.asc,created_at.asc')
  ]).then(function (r) {
    if (!r[0] || !r[1]) return; // 三次都拉不回干净数据就保留静态页，不影响阅读
    var cols = r[0].rows.filter(function (c) { return c.is_published !== false && c.slug && c.name; })
      .sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
    var tools = r[1].rows.filter(function (t) { return t.is_published !== false && t.name && t.url; });
    state.cols = cols; state.tools = tools;
    state.byCol = {};
    cols.forEach(function (c) { state.byCol[c.slug] = []; });
    tools.forEach(function (t) {
      var c = cols.filter(function (x) { return x.id === t.collection_id; })[0];
      if (c) state.byCol[c.slug].push(t);
    });
    cols.forEach(function (c) { state.byCol[c.slug].sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); }); });

    var now = sig(cols, tools);
    window.__AI_LIVE_SIG__ = now; // 便于自检：与页面快照 CFG.sig 相等即说明静态页是最新的
    if (CFG.sig && now === CFG.sig) { sessionStorage.setItem('ai-live-sig', now); return; }
    render();
  });
})();
