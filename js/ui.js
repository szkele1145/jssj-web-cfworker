/* ============================================================
 * 建设世界 · 共享界面逻辑
 * ------------------------------------------------------------
 * 原来每个页面底部都抄了一份「侧边栏 + 主题切换」脚本（12 份），
 * 改一处要改 12 遍。这里统一收口，页面只需：
 *
 *   <link rel="stylesheet" href="css/style.css">
 *   ...
 *   <script src="js/ui.js"></script>
 *
 * 主题防闪烁由各页 <head> 里的一行内联脚本负责（必须先于渲染执行）。
 *
 * 说明：本文件不定义 API_BASE / fetchApi / esc，避免与各页自己的
 * js/home.js、js/server.js、js/forum.js 里的同名声明打架。
 * ============================================================ */
(function () {
  'use strict';

  var THEME_KEY = 'theme';
  var root = document.documentElement;

  /* ---------- 主题 ----------
   * 四套：
   *   dark   深邃（默认）
   *   light  浅色
   *   glass  液态玻璃（固定深色底 —— 亮玻璃在白底上会糊成一片）
   *   custom 自定义（2026-09-12 重做）—— 用户自选**背景色**，
   *          其余（卡面/描边/四级文字/强调色）全部由它推导，
   *          文字会按背景亮度自动切成深/浅。调色盘嵌在主题弹窗里，
   *          细节见下面「自定义背景色」一节。
   *
   * ⚠️ 颜色数学全在 js/theme.js（window.JSSJTheme）里，**不要在本文件重写一份**：
   *    页面 <head> 的防闪内联脚本、本文件的调色盘、离线验证脚本三方共用。
   */
  var THEMES = ['dark', 'light', 'glass', 'custom'];
  var THEME_LABEL = { dark: '深邃', light: '浅色', glass: '液态玻璃', custom: '自定义' };
  var THEME_ICON = { dark: 'fas fa-moon', light: 'fas fa-sun', glass: 'fas fa-droplet', custom: 'fas fa-palette' };
  var CUSTOM_DEFAULT = '#191d28';   /* 自定义主题的出厂背景色 = 深邃主题的底色 */

  /* 预设背景色：深/浅各半，都是「能直接达标」的类型（推完就有好效果）。
   * 刻意不预设中调色（如中灰）—— 那些必须走自动调整，放预设里会让人困惑。 */
  var PRESETS = [
    '#0f1116', '#191d28', '#1c2333', '#241a30',
    '#0d1f18', '#2a1a14', '#101d26', '#2b1a1c',
    '#f8fafc', '#f2f5f9', '#f7f4ee', '#eef4f0'
  ];

  /* theme.js 挂了就是资源没加载齐，退化成「三套主题」但绝不能整页报错 */
  var CT = window.JSSJTheme || null;

  function readTheme() {
    var t = null;
    try { t = localStorage.getItem(THEME_KEY); } catch (e) {}
    if (THEMES.indexOf(t) < 0) {
      // 没存过就跟随系统
      var prefersDark = !window.matchMedia || window.matchMedia('(prefers-color-scheme: dark)').matches;
      t = prefersDark ? 'dark' : 'light';
    }
    return t;
  }

  function current() {
    if (root.classList.contains('custom')) return 'custom';
    if (root.classList.contains('glass')) return 'glass';
    if (root.classList.contains('light-mode')) return 'light';
    return 'dark';
  }

  /* 当前自定义背景色：没存过就用出厂色（= 深邃主题的底色） */
  function customBg() {
    if (!CT) return CUSTOM_DEFAULT;
    return CT.savedBg() || CUSTOM_DEFAULT;
  }

  /* 把一整套变量应用到 <html> 的内联 style 上。
   *
   * ⚠️ 和上一版（只调强调色、覆盖 7 个变量）本质不同：
   *    现在是**由用户选的背景色反推整套 ~19 个变量** ——
   *    页面底、三级卡面、三级描边、四级文字、强调色系列全部重算，
   *    所以文字会自动按背景亮度切深/浅（浅底配深字，深底配浅字）。
   *    推导规则与校准过程见 js/theme.js 顶部注释。 */
  function applyCustomVars(bgHex) {
    if (!CT) return;
    var vars = CT.derive(bgHex);
    if (vars) CT.applyVars(vars);
  }

  function applyTheme(theme, persist) {
    if (THEMES.indexOf(theme) < 0) theme = 'dark';
    var light = theme === 'light';

    root.classList.toggle('glass', theme === 'glass');
    root.classList.toggle('light-mode', light);
    root.classList.toggle('custom', theme === 'custom');

    // 自定义变量覆盖：只有自定义主题挂内联变量，其余主题必须摘掉，
    // 否则内联变量的优先级会一直压过另外三套主题的 --bg/--accent
    if (theme === 'custom') applyCustomVars(customBg());
    else if (CT) CT.clearVars();

    if (persist) {
      try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
    }

    var icon = document.getElementById('themeIcon');
    if (icon) icon.className = THEME_ICON[theme];

    Array.prototype.forEach.call(document.querySelectorAll('.theme-option'), function (btn) {
      btn.setAttribute('aria-selected', String(btn.getAttribute('data-theme') === theme));
    });

    var btn = document.getElementById('themeToggle');
    if (btn) {
      var label = THEME_LABEL[theme];
      btn.setAttribute('title', '主题：' + label);
      btn.setAttribute('aria-label', '切换主题（当前：' + label + '）');
    }

    // 移动端浏览器地址栏配色 + 表单控件配色跟随主题
    var meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (meta) {
      /* ⚠️ 自定义主题的底色由用户决定，必须用**推导出来的真实背景色**，
       *    不能像其他主题那样写死。原来这里默认落到 '#191d28'，
       *    用户选了浅色底时地址栏会是深色，很突兀。 */
      meta.setAttribute('content',
        theme === 'custom' ? customBg()
          : light ? '#f8fafc'
            : theme === 'glass' ? '#0a0d14' : '#191d28');
    }
    /* ⚠️ 这里不能无条件写 'dark'：自定义主题可能是**亮底**。
     *    CT.applyVars() 已经按推导出的模式设好了 colorScheme，
     *    这里再写一次会把浅色主题的表单控件、滚动条染成深色。
     *    所以自定义主题交给 theme.js 决定。 */
    if (theme !== 'custom') root.style.colorScheme = light ? 'light' : 'dark';
  }

  /* ---------- 主题弹窗 ---------- */
  var popover, popBtn, lastPopFocus;
  var OPTION_KEYS = ['dark', 'light', 'glass', 'custom'];   /* 四行都从种子点恢复 */

  /* ⚠️ 预设色定义在文件上方（CUSTOM_DEFAULT 附近），**不要在这里再定义一份** ——
   *    会出现两个 var PRESETS，后者覆盖前者，改一处不生效。 */

  var HEX_RE = /^#[0-9a-fA-F]{6}$/;

  /* 自定义色的「未保存预览」状态。
   * 声明放在这里而不是调色盘那一节：closePop() 会用到它，
   * 而 var 提升只提升声明不提升赋值 —— 放后面会出现「弹窗关一次就先报错」。
   *
   * previewAccentHex = 当前预览中的色（null 表示没有预览、与已保存值一致）。
   * 关弹窗时靠「它 vs 已保存色」判断要不要还原，见 closePop。
   */
  var previewDirty = false;
  var previewAccentHex = null;

  function isPopOpen() { return !!popover && popover.classList.contains('open'); }

  function openPop() {
    if (!popover) return;
    lastPopFocus = document.activeElement;
    popover.classList.add('open');
    popover.setAttribute('aria-hidden', 'false');
    if (popBtn) popBtn.setAttribute('aria-expanded', 'true');
    syncCustomPanel();
    /* 焦点给「当前选中那一项」，方便键盘用户直接接着操作。
     * 注意别聚焦颜色输入框：它一聚焦就会把 hex 文字整段选中，
     * 观感像出了 bug（这个坑记在 .ai-context.md）。 */
    var first = popover.querySelector('.theme-option[aria-selected="true"]') || popover.querySelector('.theme-option');
    if (first) first.focus();
  }

  /* keepPreview=true 表示「这次关闭**不要**丢弃预览色」。
   * ⚠️ 保存流程必须传 true：保存时 closePop 紧跟在 previewAccent 之后执行，
   *    不传的话它会把刚调好的颜色又还原成旧的已保存值 ——
   *    表现为「点自动调整后 hex 变了、页面颜色却没变」。
   *    这个 bug 是端到端验证里靠 applyVars 调用栈抓出来的，别再改回去。 */
  function closePop(refocus, keepPreview) {
    if (!popover) return;
    /* 关弹窗 = 放弃未保存的预览色，回到已保存的值。
     * 不这么做的话，用户拖完色盘直接点旁边关掉，
     * 页面上留着预览色、但下次进来自定义又变了回去，前后不一致。
     *
     * ⚠️ 「有没有未保存改动」用**和已保存色比对**来判断，
     *    不要用 previewDirty 这个状态位：它会在多轮操作之间残留成 true，
     *    于是「只是开了提醒弹窗、什么都没改」也会触发还原，
     *    把别处（如自动调整）刚设好的颜色覆盖掉。
     *    这个 bug 同样是在端到端验证里抓出来的。 */
    if (!keepPreview && current() === 'custom' && CT) {
      var now = CT.parseHex(previewAccentHex || customBg());
      var saved = CT.parseHex(customBg());
      var changed = now && saved && (
        now[0] !== saved[0] || now[1] !== saved[1] || now[2] !== saved[2]
      );
      if (changed) applyCustomVars(customBg());
    }
    previewDirty = false;
    previewAccentHex = null;
    popover.classList.remove('open');
    popover.setAttribute('aria-hidden', 'true');
    if (popBtn) popBtn.setAttribute('aria-expanded', 'false');
    if (refocus !== false && lastPopFocus && lastPopFocus.focus) lastPopFocus.focus();
  }

  function buildPopover() {
    popover = document.getElementById('themePopover');
    popBtn = document.getElementById('themeToggle');
    if (!popBtn || popover) return;

    var wrap = popBtn.parentNode;
    if (wrap && !wrap.classList.contains('theme-picker')) wrap.classList.add('theme-picker');

    popover = document.createElement('div');
    popover.id = 'themePopover';
    popover.className = 'popover';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', '选择界面主题');
    popover.setAttribute('aria-hidden', 'true');

    var presetHtml = PRESETS.map(function (c) {
      return '<button type="button" class="cp-preset" data-color="' + c + '" ' +
             'style="background-color:' + c + '" title="' + c + '" ' +
             'aria-label="使用预设色 ' + c + '"></button>';
    }).join('');

    /* 四套主题。自定义那行带一个色块预览当前色，点一下展开调色盘。
     *
     * 为什么把调色盘**嵌在弹窗内**（而不是再开一层弹窗）：
     *   真 <input type="color"> 永远走浏览器自己的模态取色框，没法内嵌；
     *   所以自己用 <input type="range"> 拼（就是下面那三条），
     *   好处是能嵌进页面、手机端也能拖、还能实时预览。
     */
    popover.innerHTML =
      '<div class="popover-title">界面主题</div>' +
      '<button type="button" class="theme-option" data-theme="dark" role="option" aria-selected="false">' +
        '<i class="fas fa-moon"></i><span class="theme-name">深邃</span><i class="fas fa-check theme-check"></i></button>' +
      '<button type="button" class="theme-option" data-theme="light" role="option" aria-selected="false">' +
        '<i class="fas fa-sun"></i><span class="theme-name">浅色</span><i class="fas fa-check theme-check"></i></button>' +
      '<div class="popover-divider"></div>' +
      '<button type="button" class="theme-option" data-theme="glass" role="option" aria-selected="false">' +
        '<i class="fas fa-droplet"></i><span class="theme-name">液态玻璃</span><i class="fas fa-check theme-check"></i></button>' +
      '<div class="popover-divider"></div>' +
      '<button type="button" class="theme-option" data-theme="custom" role="option" aria-selected="false">' +
        '<i class="fas fa-palette"></i><span class="theme-name">自定义</span>' +
        '<span class="cp-current" id="cpCurrentChip" aria-hidden="true"></span>' +
        '<i class="fas fa-chevron-down cp-caret"></i>' +
        '<i class="fas fa-check theme-check"></i></button>' +

      '<div class="cp-panel" id="cpPanel" hidden>' +
        '<div class="cp-label">背景色</div>' +
        '<div class="cp-presets" role="group" aria-label="预设背景色">' + presetHtml + '</div>' +

        /* ---- 调色盘：左边大方平面（横轴饱和度 / 纵轴明度）+ 右边竖直色相条 ----
         * 为什么不用 <input type="color">：它永远弹浏览器自己的模态取色框，
         * **没法嵌进页面**。所以自己画一个。
         * 平面用两层 CSS 渐变叠出来（横向 白→纯色 + 纵向 透明→黑），
         * 这正是 HSV 的 S/V 平面，不用 canvas、不用 JS 画像素。 */
        '<div class="cp-picker">' +
          '<div class="cp-square-wrap">' +
            '<div class="cp-square" id="cpSquare" tabindex="0" role="slider" ' +
                 'aria-label="饱和度与明度，左右调饱和度、上下调明度" ' +
                 'aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-valuetext=""></div>' +
            '<span class="cp-knob cp-knob-square" id="cpSquareKnob" aria-hidden="true"></span>' +
          '</div>' +
          '<div class="cp-hue-strip" id="cpHueStrip" tabindex="0" role="slider" ' +
               'aria-label="色相" aria-valuemin="0" aria-valuemax="359" aria-valuenow="199" ' +
               'aria-valuetext="色相 199 度"></div>' +
        '</div>' +

        /* 键盘/窄屏备用：细滑条。桌面端用 CSS 隐藏（见 style.css 的 .cp-sliders），
         * 但元素始终在 DOM 里，键盘用户和 aria 都能用。 */
        '<div class="cp-sliders">' +
          '<div class="cp-slider">' +
            '<span class="cp-slider-name">色相</span>' +
            '<input type="range" id="cpHue" class="cp-range cp-hue" min="0" max="359" step="1" value="220" aria-label="色相">' +
          '</div>' +
          '<div class="cp-slider">' +
            '<span class="cp-slider-name">饱和度</span>' +
            '<input type="range" id="cpSat" class="cp-range cp-sat" min="0" max="100" step="1" value="24" aria-label="饱和度">' +
          '</div>' +
          '<div class="cp-slider">' +
            '<span class="cp-slider-name">明度</span>' +
            '<input type="range" id="cpVal" class="cp-range cp-val" min="0" max="100" step="1" value="15" aria-label="明度">' +
          '</div>' +
        '</div>' +

        '<div class="cp-hex-row">' +
          '<span class="cp-hex-dot" id="cpHexDot" aria-hidden="true"></span>' +
          '<input type="text" id="cpHex" class="cp-hex" value="' + CUSTOM_DEFAULT + '" ' +
                 'maxlength="7" spellcheck="false" autocomplete="off" inputmode="text" ' +
                 'aria-label="十六进制背景色，例如 #191d28">' +
          '<span class="cp-hex-alpha" aria-hidden="true">100%</span>' +
        '</div>' +

        /* ---- 实时配色预览 ----
         * 不只是一个色块：把推导出来的**整套配色**摆出来
         * （底 + 卡片 + 三级文字 + 强调色），用户才能看出「文字到底清不清楚」。
         * 这些色块的花色全部由 JS 通过行内 style 上色。 */
        '<div class="cp-preview" id="cpPreview" aria-live="polite"></div>' +
        '<div class="cp-warn" id="cpWarn" role="status"></div>' +
        '<div class="cp-actions">' +
          '<button type="button" class="btn btn-ghost cp-btn" id="cpCancel">取消</button>' +
          '<button type="button" class="btn btn-primary cp-btn" id="cpSave">保存</button>' +
        '</div>' +
      '</div>';

    popBtn.parentNode.appendChild(popover);

    popBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      isPopOpen() ? closePop() : openPop();
    });

    popover.addEventListener('click', function (e) {
      /* 「自定义」那行的箭头：只是展开/收起调色盘，不关弹窗、不改主题 */
      if (e.target.closest && e.target.closest('#cpCaretBtn')) return;

      var opt = e.target.closest ? e.target.closest('.theme-option') : null;
      if (!opt) return;
      var t = opt.getAttribute('data-theme');
      applyTheme(t, true);
      /* 切到自定义时展开调色盘，其余主题进来就收起 */
      setCustomExpanded(t === 'custom');
      if (t !== 'custom') closePop();
    });

    bindCustomPanel();

    // 点外面关闭
    document.addEventListener('click', function (e) {
      if (!isPopOpen()) return;
      if (popover.contains(e.target) || e.target === popBtn || popBtn.contains(e.target)) return;
      /* ⚠️ 对比度提醒弹窗是**嵌套**在主题弹窗之上的对话框，它挂在 body 上、
       *    不在 popover 里面。它自己会 stopPropagation（见 bindWarnModal 相关处），
       *    这里再兜一层：点提醒弹窗绝不该被当成「点了主题弹窗外面」。 */
      if (e.target.closest && e.target.closest('.cp-modal')) return;
      closePop(false);
    });
  }

  /* ============================================================
   * 自定义背景色（调色盘）
   * ============================================================ */

  var cpEls = null;          /* 面板内的元素缓存 */
  var cpExpanded = false;

  function cp() {
    if (cpEls) return cpEls;
    if (!popover) return null;
    cpEls = {
      panel:      document.getElementById('cpPanel'),
      chip:       document.getElementById('cpCurrentChip'),
      square:     document.getElementById('cpSquare'),
      squareKnob: document.getElementById('cpSquareKnob'),
      hueStrip:   document.getElementById('cpHueStrip'),
      /* 细滑条：桌面端被 CSS 隐藏，留着给键盘/窄屏用 */
      hue:        document.getElementById('cpHue'),
      sat:        document.getElementById('cpSat'),
      val:        document.getElementById('cpVal'),
      hex:        document.getElementById('cpHex'),
      hexDot:     document.getElementById('cpHexDot'),
      preview:    document.getElementById('cpPreview'),
      warn:       document.getElementById('cpWarn'),
      save:       document.getElementById('cpSave'),
      cancel:     document.getElementById('cpCancel')
    };
    return cpEls;
  }

  /* 当前 HSV —— 唯一真实来源是那三条 <input type=range>。
   * 调色盘（大方平面 + 色相条）只是它们的**另一种操作方式**：
   * 拖平面会反写滑条值，拖滑条会反刷调色盘。这样两边永远是同一个状态，
   * 不用维护两套独立的 h/s/v 变量（那是最容易出错的做法）。 */
  function currentHsv() {
    var el = cp();
    if (!el) return { h: 199, s: 0.59, v: 0.69 };
    return {
      h: Number(el.hue.value),
      s: Number(el.sat.value) / 100,
      v: Number(el.val.value) / 100
    };
  }

  /* 把 h/s/v 写回滑条（调色盘拖完之后调它） */
  function writeHsv(hsv) {
    var el = cp();
    if (!el) return;
    el.hue.value = String(Math.round(Math.max(0, Math.min(359, hsv.h))));
    el.sat.value = String(Math.round(Math.max(0, Math.min(1, hsv.s)) * 100));
    el.val.value = String(Math.round(Math.max(0, Math.min(1, hsv.v)) * 100));
  }

  function setCustomExpanded(on) {
    var el = cp();
    if (!el) return;
    cpExpanded = !!on;
    el.panel.hidden = !on;
    /* 调色盘展开时给弹窗加宽 —— 默认 250px 装不下一个够用的取色平面。
     * 手机端由 CSS 的 max-width:420px 媒体查询接管，改回贴边自适应。 */
    if (popover) popover.classList.toggle('has-picker', !!on);
    var opt = popover.querySelector('.theme-option[data-theme="custom"]');
    if (opt) opt.setAttribute('aria-expanded', String(!!on));
    if (on) syncCustomPanel();
  }

  /* 把界面上的控件同步成「已保存的背景色」 */
  function syncCustomPanel() {
    var el = cp();
    if (!el) return;
    var bg = customBg();
    var hsv = CT ? CT.rgbToHsv(CT.parseHex(bg)) : { h: 220, s: 0.24, v: 0.15 };
    /* ⚠️ 先写回滑条，再写 hex 输入框 —— 变量名是 bg（曾是 accent）。
     *    这里漏改过一次（el.hex.value = accent），导致 syncCustomPanel
     *    一进来就 ReferenceError，整条调色盘链路第一个调用就炸。 */
    writeHsv(hsv);
    el.hex.value = bg;
    /* 面板已回到「已保存色」，所以清掉预览状态 ——
     * 否则上一轮拖动的残留会让关弹窗时误判成「有未保存改动」。 */
    previewDirty = false;
    previewAccentHex = null;
    updateCustomPreview();
  }

  /* 只刷新「显示层」：调色盘底图 / 滑块位置 / 色块 / 警示文案。
   * ⚠️ 绝不在这里反写滑条值 —— 拖动过程中一旦回写输入控件，
   *    拖动会被打断（滑条类的经典坑）。 */
  function updateCustomPreview() {
    var el = cp();
    if (!el || !CT) return;
    var hex = currentHex();
    if (!hex) return;

    var hsv = currentHsv();
    var h = hsv.h, s = hsv.s, v = hsv.v;

    /* --- 色相条上的滑块：竖直，上=0°(红) 下=359° --- */
    if (el.hueStrip) {
      var huePct = (h / 359) * 100;
      el.hueStrip.style.setProperty('--cp-knob', huePct + '%');
      /* 刻度线用「顶端为零」而不是中心对齐：与鼠标取值算法完全一致，
       * 避免出现「点在线上但取到的色相偏几度」的错觉。 */
      el.hueStrip.style.backgroundPosition = '0 0, 0 ' + huePct + '%';
      el.hueStrip.setAttribute('aria-valuenow', String(Math.round(h)));
      el.hueStrip.setAttribute('aria-valuetext', '色相 ' + Math.round(h) + ' 度');
    }

    /* --- 大方平面：底图是 (h,100%,100%) 的 S/V 平面，滑块按百分比定位 --- */
    if (el.square) {
      var pure = CT.toHex(CT.hsvToRgb({ h: h, s: 1, v: 1 }));
      el.square.style.setProperty('--cp-pure', pure);
      el.square.style.backgroundImage =
        'linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, ' + pure + ')';
      el.squareKnob.style.left = (s * 100) + '%';
      el.squareKnob.style.top = ((1 - v) * 100) + '%';
      el.squareKnob.style.backgroundColor = hex;
      el.square.setAttribute('aria-valuenow', String(Math.round(s * 100)) + '/' + String(Math.round(v * 100)));
      el.square.setAttribute('aria-valuetext', '饱和度 ' + Math.round(s * 100) + '%，明度 ' + Math.round(v * 100) + '%');
    }

    /* 色块：用**实际生效**的背景色（derive 会软化饱和度，可能和滑条值不同） */
    var vars = CT.derive(hex);
    if (!vars) return;
    var shown = vars._bg || hex;

    el.hexDot.style.backgroundColor = shown;
    if (el.chip) el.chip.style.backgroundColor = shown;
    el.hex.classList.remove('is-bad');

    /* 细滑条的两端色也跟着走（窄屏才会看到它们） */
    if (el.sat && el.val) {
      el.sat.style.setProperty('--cp-a', CT.toHex(CT.hsvToRgb({ h: h, s: 0, v: v })));
      el.sat.style.setProperty('--cp-b', CT.toHex(CT.hsvToRgb({ h: h, s: 1, v: v })));
      el.val.style.setProperty('--cp-a', CT.toHex(CT.hsvToRgb({ h: h, s: s, v: 0 })));
      el.val.style.setProperty('--cp-b', CT.toHex(CT.hsvToRgb({ h: h, s: s, v: 1 })));
    }

    /* ---- 实时体检 + 整套配色预览 ----
     * 这是「选到看不清就提醒」的判定：把推导出来的四级文字 / 强调色
     * 逐个和它实际会落在的面对比，任何一项低于要求就标红。 */
    var res = CT.checkPalette(hex);
    if (res.invalid) return;
    var ok = res.ok;
    var v2 = res.vars;

    el.preview.className = 'cp-preview ' + (ok ? 'is-ok' : 'is-bad');
    el.preview.innerHTML =
      '<div class="cpv-box" style="background:' + v2['--bg'] + '">' +
        '<div class="cpv-card" style="background:' + v2['--surface-1'] + ';border-color:' + v2['--border'] + '">' +
          '<span style="color:' + v2['--text-1'] + '">正文示例</span>' +
          '<span style="color:' + v2['--text-3'] + '">次要说明</span>' +
          '<span class="cpv-accent" style="color:' + v2['--accent'] + '">强调文字</span>' +
          '<span class="cpv-btn" style="background:' + v2['--accent'] + ';color:' + v2['--accent-on'] + '">按钮</span>' +
        '</div>' +
      '</div>' +
      '<div class="cpv-meta">' +
        '<span class="cpv-mode">' + (res.vars._mode === 'light' ? '浅色底 · 深色文字' : '深色底 · 浅色文字') + '</span>' +
        '<span class="cp-ratio">最差 ' + res.ratio.toFixed(1) + ':1</span>' +
        '<span class="cp-verdict">' + (ok ? '全部达标' : '对比度不足') + '</span>' +
      '</div>';

    /* 警示文案：按失败的具体配对说话，比笼统的「对比度低」有用得多。
     * 文案里要说清「下一步怎么做」，因为不达标的颜色**仍然可以点保存**
     * （点了会弹提醒弹窗 + 自动调整），别让用户以为走到死路了。 */
    if (ok) {
      el.warn.className = 'cp-warn';
      el.warn.innerHTML = '';
    } else {
      var f = res.failed[0];
      /* 中调背景要单独解释 —— 用户选它「看起来没什么问题」，
       * 但数学上就是不可能让 4 级文字都达标，必须说清楚。 */
      var why = res.midTone
        ? '这个明度「不上不下」：卡面和背景分不出层次，文字也够不到 4.5:1。'
        : '这个颜色下「' + f.name + '」只有 ' + f.ratio.toFixed(1) + ':1，低于要求的 ' + f.min + ':1。';
      el.warn.className = 'cp-warn is-on';
      /* ⚠️ 警示里**直接带一个「自动调整」按钮**（2026-09-12 加）。
       *    之前只有「点保存 → 弹窗 → 弹窗里才有自动调整」这一条路，
       *    用户反馈「没找到自动调整按钮」—— 藏一层就等于没有。
       *    现在面板内一键可点，不达标也能立刻修好。 */
      el.warn.innerHTML = '<i class="fas fa-triangle-exclamation"></i>' +
        '<span class="cp-warn-text">' + why + '</span>' +
        '<button type="button" class="cp-warn-fix" id="cpWarnFix">' +
          '<i class="fas fa-wand-magic-sparkles"></i> 自动调整</button>';
    }

    /* ⚠️ 保存按钮**永远不禁用**（2026-09-12 修）。
     *    这里原来写的是 `el.save.disabled = !ok`，造成一个**死锁**：
     *      不达标的颜色 → 保存被禁用 → 点不了保存 → 弹不出提醒弹窗
     *      → 永远找不到「自动调整」按钮。
     *    用户实测就是「颜色有问题时直接不让点保存，也找不到自动调整按钮」。
     *    正确做法：保存始终可点；不达标时点它 → 弹提醒弹窗 → 里面给「自动调整」。
     *    实时警示仍然保留在预览区（上面那段），只是不拿它当唯一出口。
     *    **别再把这一行改回 disabled。** */
    el.save.disabled = false;
    el.save.setAttribute('aria-describedby', ok ? '' : 'cpSaveHint');
  }

  /* 从三个滑条读出当前 hex（唯一的真实来源是滑条） */
  function currentHex() {
    var el = cp();
    if (!el || !CT) return null;
    var h = Number(el.hue.value);
    var s = Number(el.sat.value) / 100;
    var v = Number(el.val.value) / 100;
    return CT.toHex(CT.hsvToRgb({ h: h, s: s, v: v }));
  }

  /* 实时预览：只写页面变量，**不落盘**。保存才落盘。 */
  function previewAccent(hex) {
    if (!CT) return;
    var vars = CT.derive(hex);
    if (!vars) return;
    CT.applyVars(vars);
    previewAccentHex = CT.normalizeHex(hex);
    previewDirty = true;
  }

  var warnModal = null, warnLastFocus = null;

  function warnOpener() {
    return cp() && cp().save ? cp().save : popBtn;
  }

  function closeWarn() {
    if (!warnModal) return;
    warnModal.classList.remove('open');
    warnModal.setAttribute('aria-hidden', 'true');
    if (warnLastFocus && warnLastFocus.focus) warnLastFocus.focus();
  }

  /* 对比度不达标时的提醒弹窗 + 「自动调整」。
   *
   * 为什么用真弹窗而不是面板里的一行红字：
   *   用户的需求是「弹窗提醒」，而且保存按钮此时是禁用的 ——
   *   不给一个显式的出口，用户会卡在「怎么都存不了」的状态里。 */
  function openWarn(hex) {
    var el = cp();
    if (!CT || !el) return;
    var res = CT.checkPalette(hex);
    var fixed = CT.fitBackground(hex);
    var fixedRes = fixed ? CT.checkPalette(fixed) : null;

    if (!warnModal) {
      warnModal = document.createElement('div');
      warnModal.className = 'cp-modal';
      warnModal.setAttribute('role', 'dialog');
      warnModal.setAttribute('aria-modal', 'true');
      warnModal.setAttribute('aria-labelledby', 'cpModalTitle');
      warnModal.setAttribute('aria-hidden', 'true');
      warnModal.innerHTML =
        '<div class="cp-modal-mask" data-cp-close></div>' +
        '<div class="cp-modal-box">' +
          '<div class="cp-modal-icon"><i class="fas fa-triangle-exclamation"></i></div>' +
          '<h3 class="cp-modal-title" id="cpModalTitle">这个颜色对比度偏低</h3>' +
          '<p class="cp-modal-body" id="cpModalBody"></p>' +
          '<div class="cp-modal-actions">' +
            '<button type="button" class="btn btn-ghost cp-btn" data-cp-close>改用其他颜色</button>' +
            '<button type="button" class="btn btn-primary cp-btn" id="cpAutoFix">' +
              '<i class="fas fa-wand-magic-sparkles"></i> 自动调整</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(warnModal);

      warnModal.addEventListener('click', function (e) {
        /* ⚠️ 必须吞掉事件：提醒弹窗挂在 body 上、不在主题弹窗里，
         *    不 stopPropagation 的话这个 click 会冒泡到
         *    「点主题弹窗外面就关闭」的 document 监听器上，
         *    把整个主题弹窗关掉（连带触发「放弃未保存预览」的还原），
         *    表现为「点了自动调整，颜色却弹回旧值」。
         *    这个 bug 是靠给 applyVars 插桩看调用栈才抓到的。 */
        e.stopPropagation();

        if (e.target.closest && e.target.closest('[data-cp-close]')) { closeWarn(); return; }
        if (e.target.closest && e.target.closest('#cpAutoFix')) {
          /* 与面板内的小按钮走同一个实现，别在这里再抄一份 */
          applyAutoFix();
          closeWarn();
        }
      });

      document.addEventListener('keydown', function (e) {
        if (!warnModal || !warnModal.classList.contains('open')) return;
        if (e.key === 'Escape') { e.preventDefault(); closeWarn(); return; }
        if (e.key !== 'Tab') return;
        var f = warnModal.querySelectorAll('button:not([disabled])');
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      });
    }

    /* 文案按实际失败原因分开说 —— 中调背景和「某个具体配对比度不足」
     * 是两种完全不同的情况，混成一句话用户不知道该怎么办。 */
    var body;
    if (res.midTone) {
      body =
        '你选的 <b style="color:' + hex + '">' + hex + '</b> 明度「不上不下」：' +
        '卡面和背景分不出层次，四级文字也无法同时达到 4.5:1 —— 这是 WCAG 公式的硬约束，' +
        '不是参数没调好。<br><br>' +
        '「自动调整」会把它推到可用的一端（更暗或更亮），' +
        '<b>色相和饱和度都保持不变</b>' +
        (fixed ? '（建议 <b style="color:' + fixed + '">' + fixed + '</b>）' : '') + '。';
    } else {
      body =
        '你选的 <b style="color:' + hex + '">' + hex + '</b> 下，「' + res.worst.name +
        '」只有 <b>' + res.worst.ratio.toFixed(1) + ':1</b>，低于要求的 ' + res.worst.min +
        ':1，对应的小字会看不清（页面文字是按背景色自适应推导的）。<br><br>' +
        '「自动调整」会在<b>保持色相不变</b>的前提下调整明度' +
        (fixed ? '（建议 <b style="color:' + fixed + '">' + fixed + '</b>，' +
          (fixedRes ? fixedRes.ratio.toFixed(1) : '?') + ':1）' : '') + '。';
    }
    document.getElementById('cpModalBody').innerHTML = body;

    warnLastFocus = warnOpener();
    warnModal.classList.add('open');
    warnModal.setAttribute('aria-hidden', 'false');
    var autoBtn = document.getElementById('cpAutoFix');
    if (autoBtn) autoBtn.focus();
  }

  /* ---------- 「自动调整」的公共实现 ----------
   * 面板内的小按钮和提醒弹窗里的按钮**共用这一个函数**，
   * 避免两处各写一份（写两份必然有一天只改了一处）。
   *
   * 语义：当前 hex → fitBackground() → 写回滑条/输入框 → 刷新显示 → 实时预览。
   * 只动明度，**色相和饱和度保持不变**（用户的颜色还是那个颜色）。 */
  function applyAutoFix() {
    var el = cp();
    if (!el || !CT) return null;
    var now = currentHex();
    if (!now) return null;
    var better = CT.fitBackground(now);
    if (!better) return null;
    syncSlidersFromHex(better);
    el.hex.value = better;
    updateCustomPreview();
    previewAccent(better);
    return better;
  }

  /* 把 hex 反填到 h/s/v 控件（调色盘的底图与滑块由 updateCustomPreview 刷新） */
  function syncSlidersFromHex(hex) {
    if (!CT) return;
    var hsv = CT.rgbToHsv(CT.parseHex(hex));
    if (!hsv) return;
    writeHsv(hsv);
  }

  /* 从控件重新推出 hex，同步输入框与预览，并实时预览到页面上 */
  function onSlidersChanged(writeHexInput) {
    var el = cp();
    if (!el) return;
    var hex = currentHex();
    if (!hex) return;
    if (writeHexInput !== false) el.hex.value = hex;
    updateCustomPreview();
    previewAccent(hex);
  }

  /* ---------- 调色盘：大方平面 + 竖直色相条 ----------
   * 用 Pointer Events 一套代码覆盖鼠标 / 触摸 / 手写笔。
   *
   * ⚠️ 为什么不用 setPointerCapture 来保证「跟手」：
   *    实测（Edge headless）对**合成** PointerEvent 调 setPointerCapture 后
   *    hasPointerCapture() 返回 false —— 合成事件不是「活跃指针」，捕获建立不起来。
   *    如果像最初那样把 pointermove 的判定写成
   *    `if (!node.hasPointerCapture(id)) return;`，那么一旦捕获失败拖动就**彻底失效**，
   *    而且失败是静默的（看起来就是「拖了没反应」）。
   *    所以改成：pointerdown 置一个 dragging 标志，move/up 挂在 **document** 上 ——
   *    拖出元素边界、甚至拖出弹窗，都照样跟手；setPointerCapture 只在可用时
   *    作为「防止鼠标跑到别的元素上触发 hover」的锦上添花。
   */
  function bindPickerSurface(node, onMove) {
    if (!node) return;

    function applyFromEvent(e) {
      var r = node.getBoundingClientRect();
      if (!r.width || !r.height) return;
      onMove(
        Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
        Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))
      );
    }

    var dragging = false;
    var activeId = null;

    function onDown(e) {
      /* 只响应主键（鼠标左键）；触摸/笔都是 isPrimary */
      if (e.button != null && e.button !== 0) return;
      e.preventDefault();          /* 阻止拖动时选中文字 / 触发页面滚动 */
      e.stopPropagation();         /* 别冒泡到「点弹窗外面就关闭」 */
      dragging = true;
      activeId = e.pointerId;
      if (node.setPointerCapture) { try { node.setPointerCapture(e.pointerId); } catch (err) {} }
      applyFromEvent(e);
    }

    function onMoveDoc(e) {
      if (!dragging) return;
      /* 有多个指针（多指触摸）时只跟最开始那一个 */
      if (activeId != null && e.pointerId != null && e.pointerId !== activeId) return;
      e.preventDefault();
      applyFromEvent(e);
    }

    function onUp(e) {
      if (!dragging) return;
      if (activeId != null && e.pointerId != null && e.pointerId !== activeId) return;
      dragging = false;
      activeId = null;
      if (node.releasePointerCapture) { try { node.releasePointerCapture(e.pointerId); } catch (err) {} }
    }

    node.addEventListener('pointerdown', onDown);
    /* 挂在 document：手指/鼠标拖出调色盘也继续跟手 */
    document.addEventListener('pointermove', onMoveDoc, { passive: false });
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  }

  /* 键盘也能调：方向键微调，Shift 加速。
   * 色相条单独处理（一维），平面处理 sat/val（二维）。 */
  function bindPickerKeys() {
    var el = cp();
    if (!el || !el.square) return;

    var STEP = 2, BIG = 10;

    el.hueStrip.addEventListener('keydown', function (e) {
      var d = 0;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') d = 1;
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') d = -1;
      else return;
      e.preventDefault();
      var hsv = currentHsv();
      hsv.h = (hsv.h + d * (e.shiftKey ? BIG : STEP) + 360) % 360;
      writeHsv(hsv);
      onSlidersChanged(true);
    });

    el.square.addEventListener('keydown', function (e) {
      var hsv = currentHsv();
      var big = e.shiftKey ? BIG : STEP;
      var moved = true;
      if (e.key === 'ArrowLeft') hsv.s = Math.max(0, hsv.s - big / 100);
      else if (e.key === 'ArrowRight') hsv.s = Math.min(1, hsv.s + big / 100);
      else if (e.key === 'ArrowUp') hsv.v = Math.min(1, hsv.v + big / 100);
      else if (e.key === 'ArrowDown') hsv.v = Math.max(0, hsv.v - big / 100);
      else moved = false;
      if (!moved) return;
      e.preventDefault();
      writeHsv(hsv);
      onSlidersChanged(true);
    });
  }

  function bindCustomPanel() {
    var el = cp();
    if (!el) return;

    /* --- 调色盘两个面 ---
     * 平面：clientX → 饱和度(左白右纯)，clientY → 明度(上亮下黑)
     * 色相条：clientY → 色相(上 0° 红，下 359°) */
    bindPickerSurface(el.square, function (x, y) {
      writeHsv({ h: currentHsv().h, s: x, v: 1 - y });
      onSlidersChanged(true);
    });
    bindPickerSurface(el.hueStrip, function (x, y) {
      var hsv = currentHsv();
      hsv.h = y * 359;
      writeHsv(hsv);
      onSlidersChanged(true);
    });
    bindPickerKeys();

    /* 细滑条（桌面端 CSS 隐藏、窄屏可见，键盘也一直可用） */
    ['hue', 'sat', 'val'].forEach(function (key) {
      /* input 事件：拖动过程中就实时预览（这就是「拖动即实时预览」） */
      el[key].addEventListener('input', function () { onSlidersChanged(true); });
    });

    /* hex 输入框：边打边试，但不打断输入 ——
     * 只在「已经是一个完整合法 hex」时才同步滑条与预览，
     * 否则用户打到一半（#7ac1）就被纠正，根本没法输入。 */
    el.hex.addEventListener('input', function () {
      var raw = el.hex.value.trim();
      var notBad = raw === '' || /^#?[0-9a-fA-F]{0,6}$/.test(raw);
      el.hex.classList.toggle('is-bad', !notBad && !HEX_RE.test(raw));
      if (!HEX_RE.test(raw)) return;
      var hex = CT.normalizeHex(raw);
      if (!hex) return;
      syncSlidersFromHex(hex);
      updateCustomPreview();
      previewAccent(hex);
    });

    /* 失焦/回车时补全或还原，避免留下半截输入 */
    function commitHex() {
      var raw = el.hex.value.trim();
      var hex = CT.normalizeHex(raw);
      if (hex) el.hex.value = hex;
      else el.hex.value = currentHex() || CUSTOM_DEFAULT;
      el.hex.classList.remove('is-bad');
      updateCustomPreview();
    }
    el.hex.addEventListener('blur', commitHex);
    el.hex.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commitHex(); }
    });

    el.panel.querySelectorAll('.cp-preset').forEach(function (b) {
      b.addEventListener('click', function () {
        var hex = b.getAttribute('data-color');
        syncSlidersFromHex(hex);
        el.hex.value = hex;
        updateCustomPreview();
        previewAccent(hex);
      });
    });

    /* 面板内警示区的「自动调整」按钮。
     * ⚠️ 用**事件委托**而不是给按钮本身绑：那段 HTML 每次 updateCustomPreview()
     *    都会重建，直接绑会立刻失效（而且失效是静默的 —— 点了没反应）。 */
    el.warn.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('#cpWarnFix')) {
        e.preventDefault();
        e.stopPropagation();     /* 别冒泡到「点弹窗外面就关闭」 */
        applyAutoFix();
      }
    });

    el.save.addEventListener('click', function () {
      var hex = currentHex();
      if (!hex) return;
      if (!CT.checkPalette(hex).ok) {
        /* 理论上按钮是禁用的，这里兜一层：真点到了就弹提醒而不是静默失败 */
        openWarn(hex);
        return;
      }
      /* 顺序很重要：
       *   1) saveBg 先落盘（含预计算变量表，供 <head> 防闪脚本查表）
       *   2) applyTheme('custom', true) 再按**已保存值**刷一遍
       *   3) closePop 必须传 keepPreview=true，否则它会把刚落盘的色又还原
       * 原来 1 和 2 顺序颠倒 + 没传 keepPreview，导致「保存后颜色弹回旧值」。 */
      CT.saveBg(hex);
      previewDirty = false;
      previewAccentHex = null;
      applyTheme('custom', true);
      closePop(true, true);
    });

    el.cancel.addEventListener('click', function () {
      /* 放弃预览，回到已保存的颜色（页面仍然停在自定义主题上） */
      applyCustomVars(customBg());
      previewDirty = false;
      previewAccentHex = null;
      syncCustomPanel();
    });
  }


  function initTheme() {
    applyTheme(readTheme(), false);
    buildPopover();
    // buildPopover 之后重刷一次：弹窗刚生成，需要同步选中态与按钮文案
    applyTheme(current(), false);

    // 跟随系统（仅在用户没手动选过时生效）
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var onScheme = function () {
        var stored = null;
        try { stored = localStorage.getItem(THEME_KEY); } catch (e) {}
        if (stored) return;
        applyTheme(mq.matches ? 'dark' : 'light', null, false);
      };
      if (mq.addEventListener) mq.addEventListener('change', onScheme);
      else if (mq.addListener) mq.addListener(onScheme);
    }
  }

  /* ---------- 侧边栏 ---------- */
  var sidebar, backdrop, opener, lastFocus;

  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

  /* 让侧栏从顶栏底边开始（CSS 用 --nav-h 计算 top 与 height）。
   * 这样侧栏和顶栏在左上角完全不重叠，汉堡按钮永远点得到，
   * 不需要靠 z-index 去压，也不会出现「打开了关不掉」。 */
  function syncNavHeight() {
    var nav = document.querySelector('.navbar');
    if (!nav) return;
    /* 桌面端顶栏是「铺满窗口宽度」的（负外边距抵消 .app 内边距），
     * 要用 滚动条宽度 把左内边距减掉，视觉上才和页面内容对齐；
     * 否则抽屉打开、滚动条消失时顶栏会横向跳一下。 */
    var sbw = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    root.style.setProperty('--sbw', sbw + 'px');
    var h = Math.round(nav.getBoundingClientRect().bottom);
    if (h > 0) root.style.setProperty('--nav-h', h + 'px');
  }

  function focusables() {
    if (!sidebar) return [];
    return Array.prototype.filter.call(
      sidebar.querySelectorAll(FOCUSABLE),
      function (el) { return el.offsetParent !== null || el === document.activeElement; }
    );
  }

  /* 锁滚动会让滚动条消失，页面宽度多出「滚动条宽度」→ 居中内容会横向跳一下
   * （实测 about 页：.page-container 245→250、卡片宽度 940→950，看着就是「内容往里挪了一下」）。
   * 用等宽的 padding-right 补回来，打开/关闭都要对应设置与清除。 */
  function lockScroll(lock) {
    if (lock) {
      var sbw = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
      document.body.style.paddingRight = sbw ? sbw + 'px' : '';
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }
  }

  function openSidebar() {
    if (!sidebar) return;
    lastFocus = document.activeElement;
    syncNavHeight();                 // 记录顶栏高度（--nav-h）
    sidebar.classList.add('open');
    if (backdrop) backdrop.classList.add('open');
    sidebar.setAttribute('aria-hidden', 'false');
    if (opener) opener.setAttribute('aria-expanded', 'true');
    lockScroll(true);
    // 等过渡开始、元素可见后再移焦（立刻移焦会因为仍在 visibility:hidden 而失败）
    setTimeout(function () {
      if (!isOpen()) return;
      var f = focusables();
      if (f.length) f[0].focus();
    }, 60);
  }

  function closeSidebar(refocus) {
    if (!sidebar) return;
    sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
    sidebar.setAttribute('aria-hidden', 'true');
    if (opener) opener.setAttribute('aria-expanded', 'false');
    lockScroll(false);
    if (refocus !== false && lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function isOpen() { return !!sidebar && sidebar.classList.contains('open'); }

  function initSidebar() {
    sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    /* 抽屉标题「目录」旁边补一个图标。
     * 12 个页面的 HTML 里写的是 `<span>目录</span>`，纯文字、从来没有图标
     * （2026-09 抽取共享 UI 时留下的），补齐视觉。
     * 在 JS 里注入而不是改 12 个页面：以后只维护一处，页面不用动。 */
    var headSpan = sidebar.querySelector('.sidebar-header span');
    if (headSpan && !headSpan.querySelector('i')) {
      var ic = document.createElement('i');
      ic.className = 'fas fa-list-ul';
      ic.setAttribute('aria-hidden', 'true');
      headSpan.insertBefore(ic, headSpan.firstChild);
    }

    backdrop = document.getElementById('sidebarBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'sidebarBackdrop';
      backdrop.className = 'sidebar-backdrop';
      document.body.appendChild(backdrop);
    }

    opener = document.getElementById('sidebarToggle');
    sidebar.setAttribute('aria-hidden', 'true');
    if (opener) {
      opener.setAttribute('aria-expanded', 'false');
      if (!opener.getAttribute('aria-label')) opener.setAttribute('aria-label', '打开目录');
      if (!opener.getAttribute('aria-controls')) opener.setAttribute('aria-controls', 'sidebar');
    }

    if (opener) opener.addEventListener('click', function (e) { e.stopPropagation(); isOpen() ? closeSidebar() : openSidebar(); });

    var closeBtn = document.getElementById('sidebarClose');
    if (closeBtn) closeBtn.addEventListener('click', function () { closeSidebar(); });

    backdrop.addEventListener('click', function () { closeSidebar(); });

    // Esc 关闭 + Tab 焦点锁在侧栏内
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isPopOpen()) { e.preventDefault(); closePop(); return; }
      if (!isOpen()) return;
      if (e.key === 'Escape') { e.preventDefault(); closeSidebar(); return; }
      if (e.key !== 'Tab') return;
      var f = focusables();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    // 点击链接即关闭（同页锚点除外）
    sidebar.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a[href]') : null;
      if (a) closeSidebar(false);
    });

    // 视口变大到桌面尺寸时自动收起，避免残留遮罩
    if (window.matchMedia) {
      var mq = window.matchMedia('(min-width: 901px)');
      var onMq = function (ev) { if (ev.matches && isOpen()) closeSidebar(false); };
      if (mq.addEventListener) mq.addEventListener('change', onMq);
      else if (mq.addListener) mq.addListener(onMq);
    }
  }

  /* ---------- 当前页高亮 ----------
   * ⚠️ 站内链接已去 .html（/forum 而不是 /forum.html），所以这里必须把
   * 「地址栏里的当前页名」和「链接目标」都归一化后再比：
   *   - 地址栏是 /forum       → 当前页 'forum'
   *   - 地址栏是 /forum.html  → 当前页 'forum'（老书签/外部链接仍要能高亮）
   *   - 地址栏是 /            → 当前页 'index'
   * 原来直接拿 'forum.html' 和 'forum' 比，去扩展名后会**一个都高亮不上**。 */
  function pageKey(pathOrHref) {
    var s = String(pathOrHref || '').split('#')[0].split('?')[0];
    s = s.split('/').pop() || '';
    s = s.replace(/\.html?$/i, '');
    return s || 'index';
  }

  function initActiveNav() {
    if (!sidebar) return;
    var here = pageKey(location.pathname);
    Array.prototype.forEach.call(sidebar.querySelectorAll('.sidebar-menu a[href]'), function (a) {
      if (pageKey(a.getAttribute('href')) === here) {
        a.classList.add('active');
        a.setAttribute('aria-current', 'page');
      }
    });
  }

  /* ---------- 顶栏滚动状态 ---------- */
  function initNavbarScroll() {
    var nav = document.querySelector('.navbar');
    if (!nav) return;
    var ticking = false;
    function update() {
      nav.classList.toggle('is-stuck', window.scrollY > 8);
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ---------- 灯箱：点正文配图看大图 ----------
   * 全站共用。原来图片只能看缩略块里被裁过的那一块，想看全图只能右键新标签页 ——
   * 手机上连右键都没有，等于长截图永远看不全。
   * 这里统一接管：单击打开、左右切换、Esc/点背景关闭、方向键切换、手机可左右滑。
   */
  var lb, lbImg, lbPrev, lbNext, lbHint, lbList = [], lbIdx = 0, lbLastFocus = null;

  var LB_SEL = '.post-images img, .story-content img, .vote-desc img, .opt-gallery img, .fb-images img, .fb-thumb img';

  function buildLightbox() {
    if (lb) return;
    lb = document.createElement('div');
    lb.id = 'lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', '图片查看');
    lb.innerHTML =
      '<button class="lb-btn lb-close" type="button" aria-label="关闭"><i class="fas fa-times" aria-hidden="true"></i></button>' +
      '<button class="lb-btn lb-prev" type="button" aria-label="上一张"><i class="fas fa-chevron-left" aria-hidden="true"></i></button>' +
      '<img alt="">' +
      '<button class="lb-btn lb-next" type="button" aria-label="下一张"><i class="fas fa-chevron-right" aria-hidden="true"></i></button>' +
      '<div class="lb-hint"></div>';
    document.body.appendChild(lb);

    lbImg = lb.querySelector('img');
    lbPrev = lb.querySelector('.lb-prev');
    lbNext = lb.querySelector('.lb-next');
    lbHint = lb.querySelector('.lb-hint');

    lb.querySelector('.lb-close').addEventListener('click', function () { closeLightbox(); });
    lbPrev.addEventListener('click', function (e) { e.stopPropagation(); stepLightbox(-1); });
    lbNext.addEventListener('click', function (e) { e.stopPropagation(); stepLightbox(1); });
    // 点背景（不是图片本身）关闭
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLightbox(); });

    // 手机上左右滑切换
    var sx = 0, sy = 0;
    lb.addEventListener('touchstart', function (e) {
      if (!e.touches.length) return;
      sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      var t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      var dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) stepLightbox(dx < 0 ? 1 : -1);
    }, { passive: true });

    // 滚轮不要滚到背后的页面（灯箱是全屏遮罩，滚背景很出戏）
    lb.addEventListener('wheel', function (e) { e.preventDefault(); }, { passive: false });
  }

  function collectSources(img) {
    var scope = img.closest('.post-images, .story-gallery, .fb-images, .vote-desc, .opt-gallery');
    var nodes = scope ? scope.querySelectorAll('img') : [img];
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].classList.contains('img-broken')) continue;
      out.push({ el: nodes[i], src: nodes[i].currentSrc || nodes[i].src, alt: nodes[i].alt || '' });
    }
    if (!out.length) out.push({ el: img, src: img.currentSrc || img.src, alt: img.alt || '' });
    return out;
  }

  function showLightboxAt(i) {
    if (!lbList.length) return;
    lbIdx = (i + lbList.length) % lbList.length;
    var item = lbList[lbIdx];
    lbImg.src = item.src;
    lbImg.alt = item.alt || '图片';
    var multi = lbList.length > 1;
    lbPrev.style.display = multi ? '' : 'none';
    lbNext.style.display = multi ? '' : 'none';
    lbHint.textContent = multi ? (lbIdx + 1) + ' / ' + lbList.length + ' · Esc 关闭 · ← → 切换' : 'Esc 关闭';
  }

  function stepLightbox(d) { showLightboxAt(lbIdx + d); }

  function openLightbox(img) {
    buildLightbox();
    lbList = collectSources(img);
    var start = 0;
    for (var i = 0; i < lbList.length; i++) if (lbList[i].el === img) { start = i; break; }
    lbLastFocus = document.activeElement;
    lb.classList.add('open');
    document.body.classList.add('lb-open');
    showLightboxAt(start);
    var btn = lb.querySelector('.lb-close');
    if (btn) btn.focus();
  }

  function closeLightbox() {
    if (!lb) return;
    lb.classList.remove('open');
    document.body.classList.remove('lb-open');
    lbImg.removeAttribute('src');
    if (lbLastFocus && lbLastFocus.focus) lbLastFocus.focus();
  }

  function isLbOpen() { return !!lb && lb.classList.contains('open'); }

  /* ---------- 图片失效占位 ----------
   * 图片挂了（图床清理了文件 / 外链失效）原来就是一条浏览器裂图图标，
   * 在深色主题里几乎看不见，用户只会觉得「这里排版崩了」。
   * 改成显示可读的占位文字（alt 或文件名），并去掉 src 防止死循环。
   */
  function escapeText(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function handleImageError(img) {
    if (img.dataset.imgFallback === '1') return;
    img.dataset.imgFallback = '1';
    var label = img.getAttribute('alt') || '';
    if (!label) {
      try {
        var u = img.currentSrc || img.getAttribute('src') || '';
        label = decodeURIComponent(u.split('/').pop().split('?')[0]) || '图片';
      } catch (e) { label = '图片'; }
    }
    img.removeAttribute('src');
    img.removeAttribute('srcset');
    img.classList.add('img-broken');
    img.setAttribute('title', '图片加载失败：' + label);
    img.textContent = '图片加载失败 · ' + label;
  }

  /* 正文配图是各页 JS 动态插进来的，元素随时会出现，
   * 所以用捕获阶段的 error 事件统一兜底，不用 MutationObserver 反复扫。 */
  function initImages() {
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || t.tagName !== 'IMG') return;
      if (t.classList.contains('img-broken')) return;
      if (!t.matches || !t.matches(LB_SEL)) return;
      e.preventDefault();
      openLightbox(t);
    });

    document.addEventListener('error', function (e) {
      var t = e.target;
      if (t && t.tagName === 'IMG') handleImageError(t);
    }, true);

    document.addEventListener('keydown', function (e) {
      if (!isLbOpen()) return;
      if (e.key === 'Escape') { e.preventDefault(); closeLightbox(); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); stepLightbox(-1); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); stepLightbox(1); return; }
      // 焦点锁在灯箱内
      if (e.key !== 'Tab') return;
      var f = lb.querySelectorAll('button:not([style*="display: none"])');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* ---------- 页面离开时收起侧栏（避免 bfcache 残留） ---------- */
  function initPageHide() {
    window.addEventListener('pagehide', function () {
      closeSidebar(false); closePop(false); closeLightbox(); closeWarn();
    });
  }

  function init() {
    initTheme();
    initSidebar();
    initActiveNav();
    initNavbarScroll();
    initImages();
    initPageHide();
    syncNavHeight();
    // 顶栏高度会随断点/字体变化，窗口尺寸变了就重新量
    window.addEventListener('resize', syncNavHeight, { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
