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

async function loadBans() {
  const container = document.getElementById('banList');
  try {
    const resp = await fetchApi('/api/bans');
    const data = await resp.json();
    if (!data.success || !data.bans || data.bans.length === 0) {
      container.innerHTML = '<div class="empty-state"><i class="far fa-folder-open" aria-hidden="true"></i><div>暂无封禁记录</div></div>';
      return;
    }
    container.innerHTML = data.bans.map(b => `
      <div class="ban-row">
        <span class="player">${esc(b.player)}</span>
        <span class="reason">${esc(b.reason)}</span>
        <span class="date">${esc(b.date)}</span>
      </div>`).join('');
  } catch (e) {
    // 打日志带原因：只显示「加载失败」时排查不知道是网络还是接口 500
    console.error('[封挂榜] 加载失败:', e && e.message ? e.message : e);
    container.innerHTML = '<div class="empty-state"><i class="fas fa-cloud-exclamation" aria-hidden="true"></i>' +
      '<div>加载失败，请检查网络后重试</div>' +
      '<button class="btn btn-sm" type="button" style="margin-top:1rem;" onclick="loadBans()">' +
        '<i class="fas fa-redo" aria-hidden="true"></i> 重试</button></div>';
  }
}
loadBans();
