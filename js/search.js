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

let searchTimer = null;
function highlight(text, q) {
  const t = String(text || '');
  if (!q) return t;
  const esc = t.replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));
  const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
  return esc.replace(re, '<mark class="sr-hit">$1</mark>');
}

async function doSearch(q) {
  clearTimeout(searchTimer);
  const results = document.getElementById('searchResults');
  const summary = document.getElementById('searchSummary');
  q = (q || '').trim();
  if (!q) { results.innerHTML = '<div class="sr-empty">输入关键词开始搜索</div>'; summary.style.display = 'none'; return; }
  if (q.length < 2) { results.innerHTML = '<div class="sr-empty">输入至少 2 个字符</div>'; summary.style.display = 'none'; return; }
  searchTimer = setTimeout(async () => {
    try {
      const resp = await fetchApi('/api/search?q=' + encodeURIComponent(q) + '&fuzzy=' + (document.getElementById('fuzzyToggle').checked ? '1' : '0'));
      const data = await resp.json();
      if (!data.success) { results.innerHTML = '<div class="sr-empty">搜索失败</div>'; return; }
      data.posts = data.posts || []; data.stories = data.stories || []; data.bans = data.bans || []; data.votes = data.votes || []; data.downloads = data.downloads || [];
      const strip = (s) => String(s || '').replace(/<[^>]+>/g, '');
      const total = data.posts.length + data.stories.length + data.bans.length + data.votes.length + data.downloads.length;
      summary.style.display = 'block';
      summary.innerHTML = total > 0
        ? `找到 <span class="sr-count">${total}</span> 条结果（动态 ${data.posts.length} · 投票 ${data.votes.length} · 神人榜 ${data.stories.length} · 封禁 ${data.bans.length} · 下载 ${data.downloads.length}）`
        : `没有找到与「${highlight(q, '')}」相关的内容`;
      let html = '';
      if (data.posts.length) {
        html += '<div class="search-result-title">📋 动态 <span>(' + data.posts.length + ')</span></div>';
        html += data.posts.map(p => `<a class="sr-item" href="/forum#post-${p.id}"><div class="sr-title">${highlight(p.title || '未命名', q)}</div><div class="sr-meta">${p.author || '匿名'} · ${(p.date || '').slice(0,10)}</div><div class="sr-excerpt">${highlight(strip(p.excerpt || p.content), q)}</div></a>`).join('');
      }
      if (data.votes.length) {
        html += '<div class="search-result-title">📊 投票 <span>(' + data.votes.length + ')</span></div>';
        html += data.votes.map(v => `<a class="sr-item" href="/votes#vote-${v.id}"><div class="sr-title">${highlight(v.title || '未命名', q)}</div><div class="sr-meta">${v.type === 'choice' ? '[选择]' : '同意 ' + (v.yesCount || 0) + ' · 反对 ' + (v.noCount || 0)} · ${(v.date || '').slice(0,10)}</div><div class="sr-excerpt">${highlight(strip(v.description || ''), q)}</div></a>`).join('');
      }
      if (data.stories.length) {
        html += '<div class="search-result-title">👑 神人榜 <span>(' + data.stories.length + ')</span></div>';
        html += data.stories.map(s => `<a class="sr-item" href="/legends#story-${s.id}"><div class="sr-title">${highlight(s.title, q)}</div><div class="sr-meta">${(s.date || '').slice(0,10)}</div><div class="sr-excerpt">${highlight(strip(s.text || ''), q)}</div></a>`).join('');
      }
      if (data.bans.length) {
        html += '<div class="search-result-title">🚫 封挂榜 <span>(' + data.bans.length + ')</span></div>';
        html += data.bans.map(b => `<a class="sr-item" href="/bans"><div class="sr-title">${highlight(b.player, q)}</div><div class="sr-meta">${b.date || ''}</div><div class="sr-excerpt">${highlight(strip(b.reason), q)}</div></a>`).join('');
      }
      if (data.downloads.length) {
        html += '<div class="search-result-title">📥 下载中心 <span>(' + data.downloads.length + ')</span></div>';
        html += data.downloads.map(d => `<a class="sr-item" href="/download"><div class="sr-title">${highlight(d.name, q)}</div><div class="sr-meta">${d.size || ''}${d.date ? ' · ' + d.date : ''}</div><div class="sr-excerpt">${highlight(strip(d.desc), q)}</div></a>`).join('');
      }
      if (!html) html = '<div class="sr-empty">没有找到相关内容</div>';
      results.innerHTML = html;
      results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch { results.innerHTML = '<div class="sr-empty">搜索失败</div>'; }
  }, 300);
}
