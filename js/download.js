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

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function loadDownloads() {
  const container = document.getElementById('downloadContainer');
  try {
    const resp = await fetchApi('/api/downloads');
    const data = await resp.json();
    if (!data.success || !data.downloads || data.downloads.length === 0) {
      container.innerHTML = '<div class="empty-state"><i class="far fa-folder-open" aria-hidden="true"></i><div>暂无下载内容</div></div>';
      return;
    }
    container.innerHTML = '<div class="download-list">' + data.downloads.map(d => {
      const full = d.url && d.url.startsWith('/') ? API_BASE + d.url : d.url;
      const href = full + (d.filename ? (full.indexOf('?') >= 0 ? '&' : '?') + 'fn=' + encodeURIComponent(d.filename) : '');
      return '<div class="download-item">' +
        '<div class="download-icon"><i class="fas fa-file-archive"></i></div>' +
        '<div class="download-info">' +
          '<div class="download-name">' + esc(d.name) + (d.size ? '<span class="download-badge">' + esc(d.size) + '</span>' : '') + '</div>' +
          (d.desc ? '<div class="download-desc">' + esc(d.desc) + '</div>' : '') +
          '<div class="download-meta">' + esc(d.date || '') + '</div>' +
        '</div>' +
        '<a class="download-btn" href="' + esc(href) + '" target="_blank" rel="noopener"><i class="fas fa-download"></i> 下载</a>' +
      '</div>';
    }).join('') + '</div>';
  } catch (e) {
    console.error('[下载中心] 加载失败:', e && e.message ? e.message : e);
    container.innerHTML = '<div class="empty-state"><i class="fas fa-cloud-exclamation" aria-hidden="true"></i>' +
      '<div>加载失败，请检查网络后重试</div>' +
      '<button class="btn btn-sm" type="button" style="margin-top:1rem;" onclick="loadDownloads()">' +
        '<i class="fas fa-redo" aria-hidden="true"></i> 重试</button></div>';
  }
}
loadDownloads();
