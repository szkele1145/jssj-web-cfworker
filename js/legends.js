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


let allStories = [];

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderStories(list) {
  const container = document.getElementById('storyContainer');
  if (!list || list.length === 0) {
    container.innerHTML = '<div class="card"><div class="empty-state"><i class="far fa-folder-open" aria-hidden="true"></i><div>' +
      (allStories.length > 0 ? '没有匹配的记录' : '还没有神人榜记录') + '</div></div></div>';
    return;
  }
  container.innerHTML = list.map(s => {
    let content = s.content || '';
    if (content.includes('img.remit.ee')) {
      content = content.replace(/https?:\/\/img\.remit\.ee[^\s<>"]+/g, function(u) {
        return API_BASE + '/api/img?url=' + encodeURIComponent(u);
      });
    }
    if (content.includes('/api/img')) {
      content = content.replace(/(src=["'])\/api\/img/g, '$1' + API_BASE + '/api/img');
    }

    /* ⚠️ 旧格式（后端拼出来的 content）里的 <img> 带内联样式：
     *   style='width:100%;height:auto;display:block;margin:0.6rem 0;border-radius:10px;'
     * 内联样式优先级高于样式表，所以 css 里写的 max-height 对它们**完全无效**
     * —— 真实数据里一张超长截图就能把整张卡撑到几千像素高（用户反馈的就是这个）。
     * 必须在这里把内联样式摘掉，改由 css 统一管尺寸。
     * 原来的正则 `/(<img[^>]*>(?:\s*(?:<br\s*\/?>)?\s*<img[^>]*>)*)/gi` 想一次抓连续的
     * 多个 img，但属性值里带引号时 `[^>]*>` 会越过标签边界，结果**一张图都匹配不到**
     * （所以线上 6 张图从来没有被包进 gallery）。改成逐个处理，只吃 <br> 分隔。 */
    const inlineStyle = /\sstyle=(["'])[^"']*\1/gi;
    content = content.replace(/<img\b[^>]*>/gi, m => {
      let tag = m.replace(inlineStyle, '');
      if (!/\bloading=/i.test(tag)) tag = tag.replace(/^<img\b/i, '<img loading="lazy"');
      return tag;
    });

    if (!content.includes('story-gallery')) {
      // 只把「连续/以 <br> 分隔的图片串」收进画廊；单张的交给 .story-content > img 处理
      content = content.replace(/(?:<img\b[^>]*>(?:\s*(?:<br\s*\/?>)\s*<img\b[^>]*>)+|<img\b[^>]*>)/gi, function (m) {
        const n = (m.match(/<img\b/gi) || []).length;
        return '<div class="story-gallery' + (n === 1 ? ' is-single' : ' is-many') + '">'
          + m.replace(/<br\s*\/?>/gi, '') + '</div>';
      });
    } else {
      // 已经带 gallery 的（新格式：后端按 images 数组拼好的）补上单图/多图类名
      content = content.replace(/<div class="story-gallery"/gi, function () {
        return '<div class="story-gallery is-many"';
      });
    }

    return '<div class="story-card" id="story-' + esc(s.id) + '"><div class="story-title">' + esc(s.title) + '</div><div class="story-meta">' + esc((s.date || '').split('T')[0]) + '</div><div class="story-content">' + content + '</div></div>';
  }).join('');
}

async function loadStories() {
  const container = document.getElementById('storyContainer');
  try {
    const resp = await fetchApi('/api/stories');
    const data = await resp.json();
    if (!data.success || !data.stories || data.stories.length === 0) {
      container.innerHTML = '<div class="card"><div class="empty-state"><i class="far fa-folder-open" aria-hidden="true"></i><div>还没有神人榜记录</div></div></div>';
      return;
    }
    allStories = data.stories.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    renderStories(allStories);
    // 深链接：从搜索结果带 #story-id 跳转时，滚动到对应条目并高亮
    if (location.hash && location.hash.startsWith('#story-')) {
      setTimeout(() => {
        const el = document.getElementById(location.hash.slice(1));
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          el.style.outline = '2px solid rgba(90,176,224,.55)';
          el.style.outlineOffset = '2px';
          setTimeout(() => { el.style.outline = 'none'; }, 3000);
        }
      }, 150);
    }
  } catch (e) {
    // 打日志带原因：只显示「加载失败」时，排查根本不知道是网络、CORS 还是接口 500
    console.error('[神人榜] 加载失败:', e && e.message ? e.message : e);
    container.innerHTML = '<div class="card"><div class="empty-state"><i class="fas fa-cloud-exclamation" aria-hidden="true"></i>' +
      '<div>加载失败，请检查网络后重试</div>' +
      '<button class="btn btn-sm" type="button" style="margin-top:1rem;" onclick="loadStories()">' +
        '<i class="fas fa-redo" aria-hidden="true"></i> 重试</button></div></div>';
  }
}

loadStories();
