/* ============================================================
 * 建设世界 · 自定义主题配色数学
 * ------------------------------------------------------------
 * 纯函数库 + 防闪应用器（除 boot() / applyVars() 外无副作用）。
 *
 * ## 这一版和上一版的根本区别（2026-09-12 按用户要求重做）
 *
 * 上一版：用户调**强调色**，深色底写死，只覆盖 7 个 --accent* 变量。
 * 这一版：用户调**背景色**，其余全部由它**推导**出来，覆盖约 18 个变量：
 *   面 4 级（--bg / --surface-1/2/3）
 *   描边 4 级（--border-subtle / --border / --border-strong / --border-accent）
 *   文字 4 级（--text-1..4）
 *   强调色 7 个（--accent / -strong / -dim / -dim-2 / -on / --border-accent / --ring）
 *
 * ## 推导规则（与用户确认过）
 *   1. 整套**同色相**：卡片/描边/文字都带一点点背景色的色相，
 *      看起来才像「一套主题」而不是「彩色底 + 冷灰卡片」。
 *   2. 文字**按背景亮度切深/浅**：背景偏暗 → 用浅色文字；偏亮 → 用深色文字。
 *      四级文字的明度整体平移，并逐个保证与各级卡面都 ≥4.5:1。
 *   3. 强调色也由背景色推出（同色相、拉开明度），仍走 4.5:1 体检。
 *
 * ## 为什么全程用 HSL 而不是往白/黑插值
 *   插值到 #fff/#000 会把**饱和度一起拉掉**：实测 #3a2a10 → #9d9588 直接变灰。
 *   所以先在 HSL 里定好每个变量的 L（明度），再转回 RGB —— 色相和饱和度全程保持。
 *
 * ## ⚠️ 最脆弱的一点：对比度不是「算出来就达标」
 *   明度阶梯是**经验值**，真正的达标判定一律靠 WCAG 复算
 *   （checkPalette()）。`fitBackground()` 用「扫一遍明度、取离用户原色最近
 *   且全部达标的那个」来兜底 —— 不要试图用公式一次算对，那条路必然有反例。
 *
 * UMD：浏览器挂 window.JSSJTheme，Node 里给 tools/_verify-theme.js 用。
 * ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.JSSJTheme = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var THEME_KEY = 'theme';
  var CUSTOM_KEY = 'themeCustom';          /* 存用户选的**背景色** */
  var VARS_KEY = CUSTOM_KEY + ':vars';     /* 存算好的整套变量（供 <head> 防闪脚本查表） */

  var MIN_RATIO = 4.5;                     /* WCAG AA 正文要求 */

  /* 要覆盖的全部 CSS 变量名（顺序固定，存档串与断言都依赖它） */
  var VAR_NAMES = [
    '--bg', '--surface-1', '--surface-2', '--surface-3', '--surface-solid',
    '--border-subtle', '--border', '--border-strong', '--border-accent',
    '--text-1', '--text-2', '--text-3', '--text-4',
    '--accent', '--accent-strong', '--accent-dim', '--accent-dim-2',
    '--accent-on', '--ring'
  ];

  /* ============================================================
   * 1. 低层颜色工具
   * ============================================================ */

  function parseHex(input) {
    if (typeof input !== 'string') return null;
    var h = input.trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{3}$/.test(h)) {
      h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    }
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function toHex(rgb) {
    return '#' + rgb.map(function (c) {
      var v = Math.max(0, Math.min(255, Math.round(c)));
      return (v < 16 ? '0' : '') + v.toString(16);
    }).join('');
  }

  function normalizeHex(input) {
    var rgb = parseHex(input);
    return rgb ? toHex(rgb) : null;
  }

  function srgbChannel(c) {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  function luminance(rgb) {
    return 0.2126 * srgbChannel(rgb[0]) + 0.7152 * srgbChannel(rgb[1]) + 0.0722 * srgbChannel(rgb[2]);
  }
  function contrast(a, b) {
    var la = luminance(a), lb = luminance(b);
    var hi = Math.max(la, lb), lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }

  /* ---------- HSL ---------- */
  function rgbToHsl(rgb) {
    var r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    var h = 0;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    var l = (max + min) / 2;
    var s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    return { h: h, s: s, l: l };
  }

  function hslToRgb(hsl) {
    var h = ((hsl.h % 360) + 360) % 360;
    var s = Math.max(0, Math.min(1, hsl.s));
    var l = Math.max(0, Math.min(1, hsl.l));
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    var m = l - c / 2;
    var seg = Math.floor(h / 60) % 6;
    var rgb;
    if (seg === 0) rgb = [c, x, 0];
    else if (seg === 1) rgb = [x, c, 0];
    else if (seg === 2) rgb = [0, c, x];
    else if (seg === 3) rgb = [0, x, c];
    else if (seg === 4) rgb = [x, 0, c];
    else rgb = [c, 0, x];
    return [(rgb[0] + m) * 255, (rgb[1] + m) * 255, (rgb[2] + m) * 255];
  }

  /* HSL 便捷构造：按给定色相/饱和度造一个指定明度的色 */
  function hslHex(h, s, l) {
    return toHex(hslToRgb({ h: h, s: Math.max(0, Math.min(1, s)), l: Math.max(0, Math.min(1, l)) }));
  }

  /* ---------- HSV ----------
   * ⚠️ 为什么 HSL 和 HSV 两套都要有（别删任何一套）：
   *   · **推导**用 HSL —— 它的 L 是「明度」，调 L 能得到可预测的对比度变化。
   *   · **取色盘**用 HSV —— 标准取色盘就是一个矩形（横向饱和度、纵向明度），
   *     这正是 HSV 的几何形状；HSL 是双锥体，用它做方平面手感是错的
   *     （往上一拖会先变白再回色）。
   *   两套的转换都以 RGB 为中介，不需要直接的 HSL↔HSV 公式。
   *
   *   这个坑踩过：重写 theme.js 时只留了 HSL，把这两个删了，
   *   结果调色盘整条链路第一个调用就抛
   *   `TypeError: CT.rgbToHsv is not a function` —— 界面「完全不能用」。
   */
  function rgbToHsv(rgb) {
    if (!rgb) return null;
    var r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    var h = 0;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return { h: h, s: max === 0 ? 0 : d / max, v: max };
  }

  function hsvToRgb(hsv) {
    if (!hsv) return null;
    var h = ((hsv.h % 360) + 360) % 360;
    var s = Math.max(0, Math.min(1, hsv.s));
    var v = Math.max(0, Math.min(1, hsv.v));
    var c = v * s;
    var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    var m = v - c;
    var seg = Math.floor(h / 60) % 6;
    var rgb;
    if (seg === 0) rgb = [c, x, 0];
    else if (seg === 1) rgb = [x, c, 0];
    else if (seg === 2) rgb = [0, c, x];
    else if (seg === 3) rgb = [0, x, c];
    else if (seg === 4) rgb = [x, 0, c];
    else rgb = [c, 0, x];
    return [(rgb[0] + m) * 255, (rgb[1] + m) * 255, (rgb[2] + m) * 255];
  }
  function lOf(hex) { return rgbToHsl(parseHex(hex)).l; }
  function sOf(hex) { return rgbToHsl(parseHex(hex)).s; }
  function hOf(hex) { return rgbToHsl(parseHex(hex)).h; }

  function rgba(rgb, alpha) {
    return 'rgba(' + Math.round(rgb[0]) + ',' + Math.round(rgb[1]) + ',' + Math.round(rgb[2]) + ',' + alpha + ')';
  }
  function rgbaHex(hex, alpha) {
    return rgba(parseHex(hex), alpha);
  }

  /* ============================================================
   * API 基址选择（2026-09-12 新增）
   * ------------------------------------------------------------
   * 为什么需要：部分地区因为**域名未备案**被阻断，用户只能通过 IP 直连。
   * 那时页面里写死的 `https://api.jssj.cc.cd` 同样打不开，整站功能全废。
   *
   * 规则：
   *   · 用**域名**访问 → 照旧用线上 API 域名（主站 api / 上海入口 shapi）
   *   · 用 **IP 或非 jssj 域名**访问 → 改用**相对路径**，
   *     即请求当前站点的 `/api/...`。这要求 Nginx 在 IP 站点上
   *     把 `/api/` 与 `/uploads/`、`/downloads/` 反代到后端 3000 端口
   *     （配置见 `部署说明-IP访问.md`）。
   *
   * 为什么用相对路径而不是 `http://IP:3000`：
   *   1) **同源**，不产生跨域，后端 CORS 不用信任任意 IP
   *   2) 不会踩「HTTPS 页面请求 HTTP 接口」的混合内容拦截
   *   3) 端口/协议跟着当前页面走，IP 换了、加不加 SSL 都不用改代码
   *
   * ⚠️ 这两个函数必须放在 theme.js：它是**唯一保证在各页 <head> 里
   *    最先加载**的全局脚本（`js/home.js` 等业务脚本在它之前就已经执行了
   *    —— 实测 index.html 里 home.js 在第 82 行、ui.js 在第 84 行，
   *    所以放 ui.js 会「函数还不存在」）。本文件为此兼作前端公共 JS。
   * ============================================================ */
  /* ★ CF Worker 版注入（由 cf-worker/tools/make-front.mjs 写入，别手改本文件）：
   *   API 后端 = Cloudflare Worker（KV 存储），前端与它不同域，靠 CORS 对接。 */
  var CF_API_BASE = 'https://cfapi.jssj.cc.cd';

  var API_HOST = 'api.jssj.cc.cd';
  var SHAPI_HOST = 'shapi.jssj.cc.cd';
  var SITE_HOST = 'jssj.cc.cd';

  /* 是否用「相对路径」调 API（即当前站点自带反向代理） */
  function useRelativeApi() {
    /* CF Worker 版：只有一个后端，是否同源完全由注入的基址决定
     * （空串 = 同源相对路径；非空 = 跨域打 Worker） */
    return !CF_API_BASE;
  }

  /* API 基址前缀：域名访问时是 `https://api.jssj.cc.cd`，IP 访问时是 `''` */
  function apiBase() {
    return CF_API_BASE;
  }

  /* 备用 API 基址（主 API 网络层失败时的回退目标） */
  function apiFallbackBase() {
    /* 没有第二个后端可回退：返回同一个值即可，
     * 业务脚本里的 API_BASE !== SHAPI_BASE 判断会顺带关掉那次无用重试 */
    return CF_API_BASE;
  }

  /* 取资源的完整地址（图片 / 下载直链等）。
   * 相对基址时必须转成**以 / 开头的绝对路径**再交给浏览器，
   * 否则 `'' + 'uploads/x.png'` 会变成相对当前目录，
   * 在 `/forum` 这类无扩展名地址下会解析成 `/uploads/x.png` 之外的东西。 */
  function assetUrl(path) {
    if (typeof path !== 'string' || !path) return path;
    /* 已经是完整地址（http/https/data:）就原样返回 */
    if (/^(https?:)?\/\//i.test(path) || /^data:/i.test(path)) return path;
    var base = apiBase();
    var p = path.charAt(0) === '/' ? path : '/' + path;
    return base ? base + p : p;
  }

  /* ---------- 图片 URL 归一化（IP 访问时的关键补丁）----------
   * 问题：**图片地址是存在数据库里的**，形如
   *     "images": ["https://api.jssj.cc.cd/uploads/xxx.png"]
   *     content:  "<img src='https://api.jssj.cc.cd/uploads/xxx.png'>"
   *   域名被阻断的地区，这些图片全部裂掉（页面能开、数据能取，只有图挂了）。
   *
   * 做法：把指向**本站域名**的绝对地址改写成相对地址：
   *     IP 访问   → /uploads/xxx.png      （同源，走 IP 站点的 /uploads 反代）
   *     域名访问  → https://api.jssj.cc.cd/uploads/xxx.png（结果与原来完全一致）
   *
   * ⚠️ 边界（改这里务必先看）：
   *   · **只认同本站域名**：jssj.cc.cd / api.jssj.cc.cd / shapi.jssj.cc.cd
   *     以及它们的直接子域（sh. / www.）。
   *   · **不能用 includes 判域名** —— 那样 `jssj.cc.cd.evil.com` 也会被当成本站。
   *     所以用「域名后必须紧跟 / 或结尾」的正则。
   *   · **外链图床保持原样**（img.remit.ee / img.xwyue.com 等），不动它。 */
  var SELF_HOST_RE = /^(?:(?:sh|www)\.)?(?:jssj\.cc\.cd|api\.jssj\.cc\.cd|shapi\.jssj\.cc\.cd)$/i;

  function fixImageUrl(u) {
    if (typeof u !== 'string' || !u) return u;
    /* ★ CF Worker 版新增：根路径的资源（图床直链、图片代理）必须补成 API 全址 */
    if (CF_API_BASE && u.charAt(0) === '/' && u.charAt(1) !== '/') {
      if (/^\/(uploads|downloads|api)\//.test(u)) return CF_API_BASE + u;
    }
    /* 只处理 http/https 开头的绝对地址；相对路径、data:、blob: 原样返回 */
    var m = u.match(/^(https?:)\/\/([^\/?#]+)([\s\S]*)$/i);
    if (!m) return u;
    var host = m[2].split(':')[0];          /* 去掉端口再比域名 */
    if (!SELF_HOST_RE.test(host)) return u; /* 外链，不动 */
    var base = apiBase();
    return base ? base + m[3] : m[3];       /* 相对基址时退化成 /uploads/... */
  }

  /* 需要改写的图片属性（srcset 里是「地址 描述符」的列表，按逗号拆） */
  function fixImgElement(img) {
    if (!img || img.nodeType !== 1) return;
    if (img.tagName !== 'IMG') return;
    var src = img.getAttribute('src');
    if (src) {
      var fixed = fixImageUrl(src);
      if (fixed !== src) img.setAttribute('src', fixed);
    }
    var srcset = img.getAttribute('srcset');
    if (srcset) {
      var out = srcset.split(',').map(function (part) {
        var seg = part.trim().split(/\s+/);
        if (seg[0]) seg[0] = fixImageUrl(seg[0]);
        return seg.join(' ');
      }).join(', ');
      if (out !== srcset) img.setAttribute('srcset', out);
    }
    /* 站内链接里的图片地址（<a href=".../uploads/x.png">）也一并归一 */
    var href = img.getAttribute('data-full');
    if (href) {
      var fh = fixImageUrl(href);
      if (fh !== href) img.setAttribute('data-full', fh);
    }
  }

  /* 统一改写整棵子树里的图片。
   * ⚠️ 用 MutationObserver 而不是「在每个业务脚本里插一行」：
   *    图片是各页脚本各自渲染的（legends/forum/votes/donate/feedback…），
   *    逐个改容易漏；放在这里一处收口，业务代码零改动。 */
  function installImageFixer() {
    if (typeof document === 'undefined' || !document.body) return;
    if (window.__jssjImgFixer) return;      /* 防重复安装 */
    window.__jssjImgFixer = true;

    function scan(root) {
      if (!root) return;
      if (root.nodeType === 1 && root.tagName === 'IMG') fixImgElement(root);
      if (!root.querySelectorAll) return;
      var list = root.querySelectorAll('img');
      for (var i = 0; i < list.length; i++) fixImgElement(list[i]);
    }

    scan(document.body);
    if (typeof MutationObserver === 'function') {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var added = muts[i].addedNodes;
          for (var j = 0; j < added.length; j++) scan(added[j]);
        }
      }).observe(document.body, { childList: true, subtree: true });
    }
  }

  /* ============================================================
   * 2. 参数（明度阶梯 / 饱和度）
   * ------------------------------------------------------------
   * ⚠️ 这些是**校准出来的经验值**，改之前先跑 tools/_verify-theme.js，
   *    它会校验「推导结果全部达标」以及「与 style.css 的深邃主题一致性」。
   * ============================================================ */
  var P = {
    /* 暗色模式（背景偏暗）：面**逐级更亮**，文字用浅色 */
    dark: {
      /* 面：相对背景明度的偏移（+0.045/+0.075/+0.105）。
       * 校准依据：背景取默认色 #191d28（L=0.145）时，
       * surface-1 → L 0.190 ≈ 现有 #212733（0.200），差 0.010 几乎看不出。 */
      surfOffset: [0.050, 0.080, 0.105],
      /* text-3/text-4 的明度：卡内分区一律 4.5:1 时的最低可行值
       * （0.635→深绿/深棕/深青差 0.07~0.23；0.650→深绿还差 0.02）。 */
      texts: [0.950, 0.716, 0.656, 0.656],
      accentL: 0.720,
      accentS: 0.580,
      accentSatCap: 0.85,
      accentStrongDL: 0.12
    },
    /* 亮色模式（背景偏亮）：面**逐级更白**，文字用深色 */
    light: {
      /* 偏移刻意做小：亮背景本身已经接近白，偏移太大会顶到 #fff 而失去层次 */
      surfOffset: [0.004, 0.020, 0.040],
      texts: [0.106, 0.315, 0.390, 0.400],
      accentL: 0.260,          /* 亮底上的强调色要够深才达标（0.30 时浅绿底只有 4.47:1） */
      accentS: 0.680,
      accentSatCap: 0.88,
      accentStrongDL: -0.10
    },
    surfSatCap: 0.30,
    /* 背景饱和度上限：超过部分只保留 55%（色相不变）。
     * 高饱和背景既难达标（见 softenBg 注释）也和卡面不协调。 */
    bgSatMax: 0.50,
    bgSatKeep: 0.55,
    borderAlphaDark: 0.055,
    borderAlphaLight: 0.075,
    textSatMax: 0.10,
    /* 「不上不下的中间调」判定区间（HSL 明度）：
     * 这类背景无论走深走浅都很难同时满足「文字够清 + 面有层次」，
     * 由 fitBackground() 自动推向一端，并给用户明确提示。 */
    midL: [0.30, 0.82]
  };

  /* ============================================================
   * 对比度要求矩阵
   * ------------------------------------------------------------
   * ⚠️ 历史：这张表原来把「卡内分区(--surface-3)」放宽到 3.0，
   *    理由写的是「小字极少落上去，且现有深邃主题自己就是 3.10:1」。
   *    2026-09-12 用 tools/_verify-contrast-live.js 在真浏览器里交叉实测后，
   *    发现那个「3.10:1」其实是**漏测**（旧 contrast.js 只测页面底和卡片）——
   *    真实值是 text-4 落上去 4.37:1，而且已经修掉了。
   *    既然三套预设主题现在都能做到卡内分区也 ≥4.5，
   *    自定义主题就没理由放宽 —— **一律 4.5，不留特例**。
   *    （特例最难维护：它会让「为什么这里只要 3.0」在半年后无人能答。）
   * ============================================================ */
  var TEXT_MIN = {
    '--text-1': { bg: 4.5, s1: 4.5, s2: 4.5, s3: 4.5 },
    '--text-2': { bg: 4.5, s1: 4.5, s2: 4.5, s3: 4.5 },
    '--text-3': { bg: 4.5, s1: 4.5, s2: 4.5, s3: 4.5 },
    '--text-4': { bg: 4.5, s1: 4.5, s2: 4.5, s3: 4.5 }
  };

  /* ============================================================
   * 3. 由一个背景色推导整套变量
   * ============================================================ */

  /* 判断背景偏暗还是偏亮。
   * 用**相对亮度**而不是 HSL 的 L：人眼对绿色亮、对蓝色暗，
   * 同为 L=0.5 的纯蓝和纯绿，实际观感差很远，该用 luminance 判。
   * 阈值 0.45 是校准出来的：#808080（L=0.5）应判为亮底（用深色文字），
   * 取 0.34 会把它判成暗底，结果是浅色文字落在中灰上，怎么看都糊。 */
  function modeOf(bgHex) {
    var rgb = parseHex(bgHex);
    if (!rgb) return 'dark';
    return luminance(rgb) < 0.45 ? 'dark' : 'light';
  }

  function clamp01(x) { return Math.max(0, Math.min(1, x)); }

  /* 软化背景饱和度。
   *
   * 为什么必须做：**高饱和背景本身就是坏设计**（整屏荧光绿/血红），
   * 而且会连带毁掉可读性 —— 实测 #10603a(S=0.71) 时「--text-2 / 卡内分区」
   * 只有 3.15:1、#8c1c1c(S=0.67) 时「--text-3 / 次级面」只有 2.80:1，
   * 在参数空间里怎么调都救不回来。
   * 另外它和卡面也不协调：卡面饱和度被压到 0.30，背景却是 0.71，
   * 摆在一起像两套配色。
   *
   * 所以：超过 bgSatMax 的部分只保留 bgSatKeep 比例 —— 色相完全不变，
   * 用户挑的「还是那个绿」，只是不再荧光。
   */
  function softenBg(h, s) {
    if (s <= P.bgSatMax) return s;
    return P.bgSatMax + (s - P.bgSatMax) * P.bgSatKeep;
  }

  /**
   * 推导整套变量。
   * @param {string} bgHex 页面背景色（用户选的）
   * @returns {Object|null} 形如 { '--bg': '#191d28', ... }，输入非法返回 null
   */
  function derive(bgHex) {
    var rgb = parseHex(bgHex);
    if (!rgb) return null;

    var hsl0 = rgbToHsl(rgb);
    /* 先软化饱和度（色相不动），后续一切都基于软化后的背景色 ——
     * 否则「--bg 是荧光绿、卡面却是中性灰」这种不协调会一路带下去。 */
    var S = softenBg(hsl0.h, hsl0.s);
    var H = hsl0.h;
    var L = hsl0.l;
    var bg = hslHex(H, S, L);
    rgb = parseHex(bg);

    var mode = modeOf(bg);
    var p = P[mode];
    var isDark = mode === 'dark';

    var v = {};
    v['--bg'] = bg;
    v['--surface-solid'] = bg;

    /* ---- 面 3 级 ----
     * 保持背景色相，但压低饱和度：卡面比页面底更中性才不显脏
     * （沿用原设计的思路：底色带色相倾向，卡面接近中性）。 */
    var surfS = Math.min(S, P.surfSatCap);
    v['--surface-1'] = hslHex(H, surfS, clamp01(L + p.surfOffset[0]));
    v['--surface-2'] = hslHex(H, surfS, clamp01(L + p.surfOffset[1]));
    v['--surface-3'] = hslHex(H, surfS, clamp01(L + p.surfOffset[2]));

    /* ---- 描边 3 级 ----
     * 暗底画亮线、亮底画暗线，半透明让它在任何背景上都自然。 */
    var lineBase = isDark ? [255, 255, 255] : [0, 0, 0];
    var lineA = isDark ? P.borderAlphaDark : P.borderAlphaLight;
    v['--border-subtle'] = rgba(lineBase, +(lineA * 0.65).toFixed(3));
    v['--border'] = rgba(lineBase, +lineA.toFixed(3));
    v['--border-strong'] = rgba(lineBase, +(lineA * 2.35).toFixed(3));

    /* ---- 文字 4 级 ----
     * 与背景同色相、饱和度限得很低，明度取经验阶梯。
     * **达标与否由 checkPalette() 复算兜底**，不指望阶梯一次算对。 */
    var textS = Math.min(S, P.textSatMax);
    v['--text-1'] = hslHex(H, textS, p.texts[0]);
    v['--text-2'] = hslHex(H, textS, p.texts[1]);
    v['--text-3'] = hslHex(H, textS, p.texts[2]);
    v['--text-4'] = hslHex(H, textS, p.texts[3]);

    /* ---- 强调色 ----
     * 同色相、拉开明度差：暗底给「亮而鲜」，亮底给「深而稳」。
     * 饱和度取「背景饱和度」与下限的较大者，这样灰底也能有像样的强调色。 */
    var accS = Math.min(Math.max(S, p.accentS), p.accentSatCap);
    var accRgb = hslToRgb({ h: H, s: accS, l: p.accentL });
    var acc = toHex(accRgb);
    var strong = hslHex(H, accS, clamp01(p.accentL + p.accentStrongDL));

    v['--accent'] = acc;
    v['--accent-strong'] = strong;
    v['--accent-dim'] = rgba(accRgb, 0.12);
    v['--accent-dim-2'] = rgba(accRgb, 0.22);
    /* 实底按钮上的文字：在深/浅里挑对比度高的那个 */
    v['--accent-on'] = bestOn(acc);
    v['--border-accent'] = rgba(accRgb, 0.38);
    v['--ring'] = '0 0 0 3px ' + rgba(accRgb, 0.12);

    /* 非 CSS 变量的元信息（调用方用，不会被写进 style）。
     * ⚠️ _bg 是**实际生效**的背景色：它经过了饱和度软化与取整，
     *    可能和用户输入的不完全一样。做「最终效果」预览必须用这个值，
     *    不能拿用户输入的 hex 去猜（否则预览与真实配色会对不上）。 */
    v._bg = bg;
    v._mode = mode;
    v._softened = (bg !== toHex(parseHex(bgHex)));

    return v;
  }

  /* 在强调色实底上放什么颜色的字最清楚 */
  var ON_DARK = '#0c1a24';
  var ON_LIGHT = '#ffffff';
  function bestOn(accentHex) {
    var a = parseHex(accentHex);
    if (!a) return ON_DARK;
    return contrast(parseHex(ON_DARK), a) >= contrast(parseHex(ON_LIGHT), a) ? ON_DARK : ON_LIGHT;
  }

  /* ============================================================
   * 4. 对比度体检
   * ------------------------------------------------------------
   * 检查「所有会被读的文字」与「它实际会落在的每一种面」：
   *   四级文字 × (页面底 / 卡面1 / 卡面2 / 卡面3)
   *   + 强调色当文字用（链接、图标、数字）× 四种面
   *   + 实底按钮文字 / 强调色实底
   * 取全部配对里最差的那个作为结论 —— 只要最差达标，整体就达标。
   * ============================================================ */
  function palettePairs(v) {
    var bg = parseHex(v['--bg']);
    var s1 = parseHex(v['--surface-1']);
    var s2 = parseHex(v['--surface-2']);
    var s3 = parseHex(v['--surface-3']);
    /* 每个面的 key 对应 TEXT_MIN 里的阈值字段（bg / s1 / s2 / s3） */
    var surfaces = [
      { key: 'bg', name: '页面底', rgb: bg, hex: v['--bg'] },
      { key: 's1', name: '卡片', rgb: s1, hex: v['--surface-1'] },
      { key: 's2', name: '次级面', rgb: s2, hex: v['--surface-2'] },
      { key: 's3', name: '卡内分区', rgb: s3, hex: v['--surface-3'] }
    ];
    var out = [];
    ['--text-1', '--text-2', '--text-3', '--text-4'].forEach(function (key) {
      var mins = TEXT_MIN[key];
      surfaces.forEach(function (s) {
        var ratio = contrast(parseHex(v[key]), s.rgb);
        var min = mins[s.key];
        out.push({
          name: key + ' / ' + s.name,
          ratio: ratio, min: min, ok: ratio >= min,
          bg: s.rgb, bgHex: s.hex, fg: v[key]
        });
      });
    });
    /* 强调色当文字用（链接、图标、数字）：页面底 / 卡片 / 卡内分区，一律 4.5 */
    [surfaces[0], surfaces[1], surfaces[3]].forEach(function (s) {
      var ratio = contrast(parseHex(v['--accent']), s.rgb);
      out.push({
        name: 'accent / ' + s.name,
        ratio: ratio, min: MIN_RATIO, ok: ratio >= MIN_RATIO,
        bg: s.rgb, bgHex: s.hex, fg: v['--accent']
      });
    });
    /* 实底按钮文字 / 强调色实底 */
    var onRatio = contrast(parseHex(v['--accent-on']), parseHex(v['--accent']));
    out.push({
      name: '实底按钮文字 / accent',
      ratio: onRatio, min: MIN_RATIO, ok: onRatio >= MIN_RATIO,
      bg: parseHex(v['--accent']), bgHex: v['--accent'], fg: v['--accent-on']
    });
    return out;
  }

  /* 体检结论。
   * ⚠️ 判定必须按每项的 min 来，不能用「全局最小值 ≥ 4.5」——
   *    因为 text-4 在卡内分区上的要求本来就是 3.0（见 TEXT_MIN）。 */
  function checkPalette(bgHex) {
    var v = derive(bgHex);
    if (!v) return { ok: false, invalid: true, ratio: 0, worst: null, list: [] };
    var list = palettePairs(v);
    /* worst = 相对自身要求「最吃紧」的那一项（比值越小越紧） */
    var worst = list[0], worstSlack = list[0].ratio / list[0].min;
    for (var i = 1; i < list.length; i++) {
      var slack = list[i].ratio / list[i].min;
      if (slack < worstSlack) { worst = list[i]; worstSlack = slack; }
    }
    var failed = list.filter(function (p) { return !p.ok; });
    return {
      ok: failed.length === 0,
      invalid: false,
      ratio: worst.ratio,
      min: worst.min,
      worst: worst,
      list: list,
      failed: failed,
      vars: v,
      /** 「不上不下的中间调」：面与描边的层次最难做，额外提醒用户 */
      midTone: (function () {
        var l = lOf(bgHex);
        return l >= P.midL[0] && l <= P.midL[1];
      })()
    };
  }

  /* 兼容旧名字（UI 里叫 checkAccent 的地方）*/
  function checkAccent(hex) { return checkPalette(hex); }

  /* ============================================================
   * 5. 「自动调整」：把背景色修到全部达标
   * ------------------------------------------------------------
   * 策略：**只动明度 L，锁死色相和饱和度**（用户的颜色仍然是那个颜色）。
   * 做法不是解析求根，而是**扫一遍 L**（0~1，步长 0.01），
   * 收集所有达标值，取离原色 L 最近的那个。
   *
   * ⚠️ 为什么必须扫描而不是二分：modeOf() 会在某个亮度处从 dark 翻到 light，
   *    文字色阶随之整体翻转 —— 达标区间**不是单调的、可能有两段**。
   *    二分在这种非单调函数上会给出错误答案（这个坑很隐蔽）。
   * ============================================================ */
  function fitBackground(bgHex) {
    var rgb = parseHex(bgHex);
    if (!rgb) return null;
    if (checkPalette(bgHex).ok) return toHex(rgb);

    var hsl = rgbToHsl(rgb);
    var best = null;
    for (var i = 0; i <= 100; i++) {
      var l = i / 100;
      var cand = hslHex(hsl.h, hsl.s, l);
      if (!checkPalette(cand).ok) continue;
      var d = Math.abs(l - hsl.l);
      if (!best || d < best.d) best = { hex: cand, d: d, l: l };
    }
    if (best) return best.hex;

    /* 极端情况（理论上到不了）：退化为纯黑 / 纯白，取能达标的那个 */
    if (checkPalette('#000000').ok) return '#000000';
    if (checkPalette('#ffffff').ok) return '#ffffff';
    return null;
  }

  /* ============================================================
   * 6. 存档：预计算变量表
   * ------------------------------------------------------------
   * ⚠️ 这是「不闪色」的关键：<head> 的内联脚本**先于所有外部脚本执行**，
   *    拿不到本文件，所以它只做「查表 + 赋值」。表在这里算好存进去。
   * 格式：换行分隔的 `名:值`。用换行而不是分号/逗号，
   *    因为 CSS 变量值里会出现分号以外的各种字符（rgba 里有逗号）。
   * ============================================================ */
  /* 只取真正的 CSS 变量（-- 开头）；`_bg` / `_mode` 这类是给调用方的元信息，
   * 不能写进 style / 存档串。 */
  function cssVarsOnly(vars) {
    var out = {};
    if (!vars) return out;
    for (var k in vars) {
      if (Object.prototype.hasOwnProperty.call(vars, k) && k.indexOf('--') === 0) out[k] = vars[k];
    }
    return out;
  }

  function toVarLines(vars) {
    var css = cssVarsOnly(vars);
    var out = [];
    for (var k in css) if (Object.prototype.hasOwnProperty.call(css, k)) out.push(k + ':' + css[k]);
    return out.join('\n');
  }

  function parseVars(text) {
    var out = {};
    if (typeof text !== 'string') return out;
    text.split('\n').forEach(function (line) {
      if (!line) return;
      var i = line.indexOf(':');
      if (i <= 0) return;
      var name = line.slice(0, i).trim();
      var val = line.slice(i + 1).trim();
      if (!/^--[a-z0-9-]+$/i.test(name)) return;
      /* 值里出现引号/反引号/尖括号一律丢弃 —— 防注入
       * （localStorage 可被同源脚本污染，而这些值会被塞进内联 style） */
      if (/["'<>`]/.test(val)) return;
      out[name] = val;
    });
    return out;
  }

  function readStored(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function writeStored(key, val) { try { localStorage.setItem(key, val); } catch (e) {} }
  function removeStored(key) { try { localStorage.removeItem(key); } catch (e) {} }

  function savedBg() { return normalizeHex(readStored(CUSTOM_KEY)); }

  function saveBg(bgHex) {
    var hex = normalizeHex(bgHex);
    if (!hex) return false;
    var vars = derive(hex);
    if (!vars) return false;
    writeStored(CUSTOM_KEY, hex);
    writeStored(VARS_KEY, toVarLines(vars));
    writeStored(THEME_KEY, 'custom');
    return true;
  }

  function clearBg() {
    removeStored(CUSTOM_KEY);
    removeStored(VARS_KEY);
  }

  /* ============================================================
   * 7. DOM 应用
   * ============================================================ */

  /* 把一套变量写到 <html> 的内联 style 上（内联优先级高于任何选择器）。
   * 传 null 则**真的移除**这些变量 —— 只删 class 不删变量的话，
   * 切回深邃/浅色/玻璃时 --bg 等还是自定义值（表现为「切主题没用」）。 */
  function applyVars(vars) {
    var d = document.documentElement;
    var prevAttr = d.getAttribute('data-custom-vars');
    var css = cssVarsOnly(vars);

    if (prevAttr) {
      prevAttr.split(',').forEach(function (name) {
        if (name && !Object.prototype.hasOwnProperty.call(css, name)) {
          d.style.removeProperty(name);
        }
      });
    }

    if (!vars) {
      d.classList.remove('custom');
      d.removeAttribute('data-custom-vars');
      return;
    }

    for (var k in css) {
      if (Object.prototype.hasOwnProperty.call(css, k)) d.style.setProperty(k, String(css[k]));
    }
    d.setAttribute('data-custom-vars', Object.keys(css).join(','));
    d.classList.add('custom');
    /* 自定义主题自己决定深浅，与另外两个主题 class 互斥 ——
     * 光靠变量覆盖不行：html.light-mode / html.glass 的变量块优先级更高，
     * 必须让它们在 DOM 上就不存在。 */
    d.classList.remove('light-mode', 'glass');
    /* ⚠️ 自定义主题**可能是亮底**！配色深浅要看推导出的模式，不能写死 dark，
     *    否则浅色底配上深色表单控件/滚动条。 */
    d.style.colorScheme = modeOf(css['--bg']) === 'light' ? 'light' : 'dark';
  }

  function clearVars() { applyVars(null); }

  /* 兜底启动（ui.js 用）：
   * 主题存的是 custom 但变量表丢了（存储被清一半、或老版本残留）→ 现场重算并补存。 */
  function boot() {
    if (readStored(THEME_KEY) !== 'custom') return false;
    var bg = savedBg();
    if (!bg) return false;
    var vars = parseVars(readStored(VARS_KEY));
    /* 变量表缺失或条数不对（老版本残留、存储被清一半）→ 现场重算并补存 */
    if (Object.keys(vars).length !== VAR_NAMES.length) {
      vars = derive(bg);
      if (!vars) return false;
      writeStored(VARS_KEY, toVarLines(vars));
    }
    applyVars(vars);
    return true;
  }

  return {
    THEME_KEY: THEME_KEY,
    CUSTOM_KEY: CUSTOM_KEY,
    VARS_KEY: VARS_KEY,
    MIN_RATIO: MIN_RATIO,
    VAR_NAMES: VAR_NAMES,
    P: P,
    ON_DARK: ON_DARK,
    ON_LIGHT: ON_LIGHT,

    parseHex: parseHex,
    toHex: toHex,
    normalizeHex: normalizeHex,
    luminance: luminance,
    contrast: contrast,
    rgbToHsl: rgbToHsl,
    hslToRgb: hslToRgb,
    hslHex: hslHex,
    rgbToHsv: rgbToHsv,
    hsvToRgb: hsvToRgb,
    rgba: rgba,
    rgbaHex: rgbaHex,
    bestOn: bestOn,
    modeOf: modeOf,

    /* API 基址（IP / 非本站域名访问时自动改用相对路径，见上方说明） */
    API_HOST: API_HOST,
    SHAPI_HOST: SHAPI_HOST,
    SITE_HOST: SITE_HOST,
    useRelativeApi: useRelativeApi,
    apiBase: apiBase,
    apiFallbackBase: apiFallbackBase,
    assetUrl: assetUrl,
    fixImageUrl: fixImageUrl,
    fixImgElement: fixImgElement,
    installImageFixer: installImageFixer,

    derive: derive,
    cssVarsOnly: cssVarsOnly,
    palettePairs: palettePairs,
    checkPalette: checkPalette,
    checkAccent: checkAccent,
    fitBackground: fitBackground,

    toVarLines: toVarLines,
    parseVars: parseVars,
    savedBg: savedBg,
    saveBg: saveBg,
    clearBg: clearBg,
    applyVars: applyVars,
    clearVars: clearVars,
    boot: boot
  };
});

/* ============================================================
 * 下面这些是**给各页业务脚本用的全局快捷函数**
 * ------------------------------------------------------------
 * 为什么要额外挂到 window 上、而不只放在 JSSJTheme 里：
 *   业务脚本（js/home.js、js/forum.js、admin.html 的内联脚本…）里写的是
 *   顶层 `const API_BASE = ...`，它们在**每个页面各自加载**，
 *   且加载顺序不保证在 ui.js 之后（实测 index.html 里 home.js 在 ui.js 之前）。
 *   所以做成全局函数，谁先执行谁都能拿到。
 * ============================================================ */
if (typeof window !== 'undefined' && window.JSSJTheme) {
  /** 当前该用的 API 基址：域名访问返回 https://api.jssj.cc.cd，IP 访问返回 ''（走相对路径） */
  window.jssjApiBase = function () { return window.JSSJTheme.apiBase(); };
  /** 主 API 失败时的回退基址：IP 访问下**故意返回 ''**（域名本身就打不开，别回退过去白等超时） */
  window.jssjApiFallbackBase = function () { return window.JSSJTheme.apiFallbackBase(); };
  /** 取资源完整地址（图片/下载直链），IP 访问下自动转成以 / 开头的同源路径 */
  window.jssjAssetUrl = function (p) { return window.JSSJTheme.assetUrl(p); };
  /** 把站内图片的绝对域名地址归一成相对地址（IP 访问时必需，见函数注释） */
  window.jssjFixImageUrl = function (u) { return window.JSSJTheme.fixImageUrl(u); };

  /* 自动安装图片改写器：theme.js 在每个页面的 <head> 里最先加载，
   * 所以在这里装最稳妥（业务脚本渲染出来的图也会被 MutationObserver 覆盖到）。 */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      window.JSSJTheme.installImageFixer();
    });
  } else {
    window.JSSJTheme.installImageFixer();
  }
}
