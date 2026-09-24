/* API 基址：域名访问用线上 API，IP 访问自动改走当前站点的相对路径（同源反代）。
 * 逻辑见 js/theme.js 的 apiBase() —— 那边是唯一实现，别在页面里再判断一次。 */
const API_BASE = jssjApiBase();
/* 回退基址：IP 访问时也是 ''（故意不回退到域名 —— 那时域名本身就是打不开的原因） */
const SHAPI_BASE = jssjApiFallbackBase();
async function fetchApi(path, options) {
  try {
    const resp = await fetch(API_BASE + path, options);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    return resp;
  } catch (e) {
    if (API_BASE !== SHAPI_BASE) {
      const fallback = await fetch(SHAPI_BASE + path, options);
      if (!fallback.ok) throw new Error('HTTP ' + fallback.status);
      return fallback;
    }
    throw e;
  }
}

/* 标记为「拿不到真实数据」，不再伪造数字。
 * 原实现在接口失败时会用硬编码的 2024-06-28 现算一个天数顶上去，
 * 看起来像真的，实际是编的 —— 已改为显示占位符 + 悬浮说明。 */
function markUnknown(el, hint) {
  if (!el) return;
  el.textContent = '--';
  el.setAttribute('title', hint || '暂时无法获取');
  el.classList.add('is-unknown');
}

async function fetchUptime() {
  const el = document.getElementById('uptimeDays');
  try {
    const resp = await fetchApi('/api/uptime');
    const data = await resp.json();
    if (!data.success || data.days == null) throw new Error('API returned failure');
    el.textContent = data.days;
    el.removeAttribute('title');
    el.classList.remove('is-unknown');
  } catch (e) {
    markUnknown(el, '运行天数暂时取不到（接口未响应），请稍后刷新');
  }
}
fetchUptime();

async function fetchSiteStats() {
  const pv = document.getElementById('sitePv');
  try {
    const resp = await fetchApi('/api/stats/public');
    const data = await resp.json();
    if (!data.success) throw new Error('API returned failure');
    pv.textContent = data.pv || 0;
    pv.removeAttribute('title');
    pv.classList.remove('is-unknown');
  } catch (e) {
    markUnknown(pv, '访问量暂时取不到（接口未响应），请稍后刷新');
  }
}
fetchSiteStats();

/* ============================================================
 * 首页弹窗（2026-09-12 新增，内容由后台「🪧 首页弹窗」标签页编辑）
 * ------------------------------------------------------------
 * 设计要点：
 *   · **只首页显示**（本文件只在 index.html 引入），别的页面不会弹
 *   · 内容全部来自 /api/popup，后台可随时改；接口挂了就**静默不显示** ——
 *     公告弹窗不是核心功能，绝不能因为它报错而干扰首页
 *   · 三种频率：
 *       always  每次都弹（有变化时用户才需要反复看到）
 *       once    关过一次就不再弹（用 localStorage 记）
 *       session 同一次浏览会话只弹一次（用 sessionStorage）
 *     ⚠️ 关掉后写的是**配置指纹**而不是简单的 "1"：
 *        如果管理员改了内容/标题，指纹变了 → 旧记录失效 → 会重新弹给用户。
 *        否则改了公告老用户永远看不到，公告就白发了。
 *   · 内容用 textContent 赋纯文本（换行靠 CSS white-space 保留），
 *     **不走 innerHTML** —— 后台输入的内容不该被当 HTML 解析
 *   · 遮罩点击关闭、聚焦到弹窗内、锁 body 滚动
 * ============================================================ */
(function initHomePopup() {
  const host = document.getElementById('homePopup');
  if (!host) return;

  const SEEN_KEY = 'popupSeen';       /* 存「已关闭的那个弹窗指纹」 */
  const SESSION_KEY = 'popupShown';   /* 一次会话内是否已弹过 */

  function readStore(store, key) {
    try { return store.getItem(key); } catch (e) { return null; }
  }
  function writeStore(store, key, val) {
    try { store.setItem(key, val); } catch (e) {}
  }

  /* 配置指纹：内容/标题/按钮任一变化都会改变它 */
  function fingerprint(p) {
    const raw = [p.title, p.content, p.btnText, p.btnUrl].join('\u0001');
    let h = 5381;
    for (let i = 0; i < raw.length; i++) h = ((h * 33) ^ raw.charCodeAt(i)) >>> 0;
    return h.toString(36) + '_' + raw.length;
  }

  function build(p, fp) {
    const box = document.createElement('div');
    box.className = 'popup-modal';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', p.title || '公告');
    box.innerHTML =
      '<div class="popup-mask" data-popup-close></div>' +
      '<div class="popup-box" tabindex="-1">' +
        '<button type="button" class="popup-close" data-popup-close aria-label="关闭公告">' +
          '<i class="fas fa-times" aria-hidden="true"></i></button>' +
        (p.title ? '<h3 class="popup-title"></h3>' : '') +
        (p.content ? '<div class="popup-body"></div>' : '') +
        '<div class="popup-actions"></div>' +
      '</div>';

    /* 用 textContent 填文本，避免把后台输入当 HTML 解析 */
    if (p.title) box.querySelector('.popup-title').textContent = p.title;
    if (p.content) box.querySelector('.popup-body').textContent = p.content;

    const actions = box.querySelector('.popup-actions');
    /* 按钮：填了文字和链接才算数（只填文字没链接，点了没反应反而困惑） */
    if (p.btnText && p.btnUrl) {
      const a = document.createElement('a');
      a.className = 'btn btn-primary';
      a.textContent = p.btnText;
      a.href = p.btnUrl;
      /* 站外链接新窗口打开，站内就直接跳 */
      if (/^https?:\/\//i.test(p.btnUrl) && p.btnUrl.indexOf(location.hostname) < 0) {
        a.target = '_blank';
        a.rel = 'noopener';
      }
      actions.appendChild(a);
    }
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn btn-ghost';
    closeBtn.textContent = '我知道了';
    closeBtn.setAttribute('data-popup-close', '');
    actions.appendChild(closeBtn);

    function close() {
      box.classList.remove('is-open');
      document.body.classList.remove('has-popup-open');
      if (p.freq === 'once') writeStore(localStorage, SEEN_KEY, fp);
      if (p.freq === 'session') writeStore(sessionStorage, SESSION_KEY, fp);
      /* 等淡出动画结束再移除，避免「唰」地消失 */
      setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 220);
    }

    box.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('[data-popup-close]')) {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    });
    /* Esc 关闭。⚠️ 不要 stopPropagation —— ui.js 的灯箱也听 Esc，
     * 但同一时刻两者不会都开着（弹窗在首页顶部，灯箱要用户点图才开）。 */
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
    return box;
  }

  (async function run() {
    let p = null;
    try {
      const resp = await fetchApi('/api/popup');
      const data = await resp.json();
      if (!data.success || !data.popup) return;
      p = data.popup;
    } catch (e) {
      return;   /* 接口不通就静默不显示 —— 公告不是核心功能 */
    }
    if (!p.enabled) return;
    if (!p.title && !p.content) return;   /* 空配置不弹（后端也会拦，双保险） */

    const fp = fingerprint(p);
    if (p.freq === 'once' && readStore(localStorage, SEEN_KEY) === fp) return;
    if (p.freq === 'session' && readStore(sessionStorage, SESSION_KEY) === fp) return;

    /* 稍等再弹：让首页先把内容渲染出来，避免弹窗盖在骨架上显得突兀 */
    setTimeout(function () {
      const box = build(p, fp);
      host.appendChild(box);
      /* 下一帧再加 is-open，保证淡入动画能从 0 开始播放 */
      requestAnimationFrame(function () {
        box.classList.add('is-open');
        document.body.classList.add('has-popup-open');
        const focusTarget = box.querySelector('.popup-box');
        if (focusTarget) focusTarget.focus();
      });
    }, 350);
  })();
})();
