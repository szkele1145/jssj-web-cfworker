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

async function loadDonors() {
  const container = document.getElementById('donorList');
  try {
    const resp = await fetchApi('/api/donors');
    const data = await resp.json();
    if (!data.success || !data.donors || data.donors.length === 0) {
      container.innerHTML = '<div class="empty-state"><i class="far fa-heart" aria-hidden="true"></i><div>还没有捐赠记录，感谢每一位支持者</div></div>';
      return;
    }
    container.innerHTML = data.donors.map(d => `<span class="donor">${esc(d.name)}</span>`).join('');
  } catch (e) {
    console.error('[捐赠] 加载失败:', e && e.message ? e.message : e);
    container.innerHTML = '<div class="empty-state"><i class="fas fa-cloud-exclamation" aria-hidden="true"></i>' +
      '<div>加载失败，请检查网络后重试</div>' +
      '<button class="btn btn-sm" type="button" style="margin-top:1rem;" onclick="loadDonors()">' +
        '<i class="fas fa-redo" aria-hidden="true"></i> 重试</button></div>';
  }
}
loadDonors();
