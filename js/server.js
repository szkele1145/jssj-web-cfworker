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


let serverRefreshTimer = null;

/* 统一加载态。
 * 原来这里**没有**加载态：点「刷新」之后界面一动不动，要等好几秒才有反应，
 * 用户完全不知道点到了没有（自动轮询 30s 一次倒是一直静默跑着）。
 * 现在统一用后台那套细转圈 + 一行说明，刷新过程可见。 */
function renderLoading(text) {
  const container = document.getElementById('serverStatusContent');
  if (!container) return;
  container.innerHTML =
    '<div class="mc-card">' +
      '<div class="loading-inline" role="status" aria-live="polite">' +
        '<span class="spinner" aria-hidden="true"></span>' +
        '<span class="loading-text">' + (text || '正在获取服务器状态…') + '</span>' +
      '</div>' +
    '</div>';
}

function showError(msg) {
  const container = document.getElementById('serverStatusContent');
  container.innerHTML = `
    <div class="mc-card">
      <div class="mc-state state-error">
        <div class="mc-state-icon"><i class="fas fa-exclamation-triangle"></i></div>
        <div class="mc-state-text">${msg}</div>
        <button class="mc-refresh" onclick="fetchServerStatus(true)"><i class="fas fa-redo"></i> 重试</button>
      </div>
    </div>`;
  scheduleRefresh();
}

function renderServerStatus(data) {
  const container = document.getElementById('serverStatusContent');
  const protoMap = {
    'query': { text: 'Query 协议', cls: 'proto-query', icon: 'fas fa-bolt' },
    'ping': { text: 'Java Ping', cls: 'proto-ping', icon: 'fas fa-satellite-dish' },
    'bedrock': { text: '基岩 RakNet', cls: 'proto-bedrock', icon: 'fas fa-mobile-alt' },
    'third-party': { text: '第三方 API', cls: 'proto-third', icon: 'fas fa-cloud' },
  };
  const p = protoMap[data.proto] || { text: data.proto || '未知', cls: 'proto-ping', icon: 'fas fa-circle-question' };
  const protoTag = `<span class="mc-proto ${p.cls}">${p.icon ? `<i class="${p.icon}"></i>` : ''}${p.text}</span>`;
  const timeStr = new Date().toLocaleTimeString('zh-CN', { hour12: false });

  if (!data.online) {
    container.innerHTML = `
      <div class="mc-card mc-card-off">
        <div class="mc-state state-off">
          <div class="mc-live"><span class="mc-live-text mc-live-off">已关闭</span></div>
          <div class="mc-state-sub">当前无法连接到 MC 服务器</div>
          <div class="mc-state-proto">${protoTag}</div>
        </div>
      </div>
      <div class="mc-foot">
        <span><i class="fas fa-sync-alt"></i> 更新于 ${timeStr}</span>
        <button class="mc-refresh" onclick="fetchServerStatus(true)"><i class="fas fa-redo"></i> 刷新</button>
      </div>`;
    scheduleRefresh();
    return;
  }

  const count = data.players?.online ?? 0;
  const maxCount = data.players?.max ?? 0;
  const javaPlayers = data.players?.java || [];
  const bedrockPlayers = data.players?.bedrock || [];
  const botCount = data.players?.bots ?? 0;

  let motdHtml = '';
  if (data.motd?.html?.length) motdHtml = data.motd.html.join('<br>');
  else if (data.motd?.clean?.length) motdHtml = data.motd.clean.join('<br>');
  else motdHtml = '<span class="mc-motd-empty">无 MOTD</span>';

  // 玩家区块
  let playerSections = '';
  if (javaPlayers.length + bedrockPlayers.length + botCount === 0) {
    playerSections = '<div class="mc-players-empty">暂无玩家在线</div>';
  } else {
    let cols = '';
    if (javaPlayers.length > 0) cols += `<div class="mc-psec"><div class="mc-plabel"><span class="mc-plabel-badge pl-java">Java</span>${javaPlayers.length} 人</div><div class="mc-plist">${javaPlayers.map(n => `<span class="mc-player">${n}</span>`).join('')}</div></div>`;
    if (bedrockPlayers.length > 0) cols += `<div class="mc-psec"><div class="mc-plabel"><span class="mc-plabel-badge pl-bedrock">BE</span>${bedrockPlayers.length} 人</div><div class="mc-plist">${bedrockPlayers.map(n => `<span class="mc-player">${n}</span>`).join('')}</div></div>`;
    if (botCount > 0) cols += `<div class="mc-psec"><div class="mc-plabel"><span class="mc-plabel-badge pl-bot">Bot</span>${botCount} 个</div></div>`;
    playerSections = cols ? `<div class="mc-pgrid">${cols}</div>` : '<div class="mc-players-empty">暂无玩家在线</div>';
  }

  // 在线率进度条已移除
  container.innerHTML = `
    <div class="mc-card">
      <div class="mc-head">
        <div class="mc-live"><span class="mc-live-text">在线</span></div>
        <div class="mc-online"><i class="fas fa-users"></i> ${count}${maxCount ? ` / ${maxCount}` : ''} 人在线</div>
      </div>
      <div class="mc-meta">
        <span>${protoTag}</span>
      </div>
      <div class="mc-body">
        ${playerSections}
        <div class="mc-motd">${motdHtml}</div>
      </div>
    </div>
    <div class="mc-foot">
      <span><i class="fas fa-sync-alt"></i> 更新于 ${timeStr}</span>
      <button class="mc-refresh" onclick="fetchServerStatus(true)"><i class="fas fa-redo"></i> 刷新</button>
    </div>`;
  scheduleRefresh();
}

function scheduleRefresh() {
  if (serverRefreshTimer) clearTimeout(serverRefreshTimer);
  // 自动轮询不传 showSpinner：静默更新，不闪加载态
  serverRefreshTimer = setTimeout(function () { fetchServerStatus(false); }, 30000);
}

async function fetchServerStatus(showSpinner) {
  // 只有首次加载和用户手动点刷新才铺加载态；30 秒一次的自动轮询静默更新，
  // 否则界面每半分钟自己闪一下，很烦
  if (showSpinner) renderLoading('正在刷新服务器状态…');
  try {
    const resp = await fetchApi('/api/mc-status');
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    if (data.success) { renderServerStatus(data); return; }
    throw new Error(data.error || 'Worker 返回失败');
  } catch (err) {
    console.warn('[服务器状态] Worker 代理失败:', err.message);
  }

  // 降级：直连 mcsrvstat.us v3+v2
    console.log('[服务器状态] 尝试直连...');
  try {
    let online = false, maxP = 0, maxOnline = 0, real = [], extra = [], motd = null;
    for (const ver of ['3', '2']) {
      try {
        const ctrl = new AbortController();
        const tm = setTimeout(() => ctrl.abort(), 8000);
        const resp = await fetch(`https://api.mcsrvstat.us/${ver}/jssj.cc.cd`, { signal: ctrl.signal });
        clearTimeout(tm);
        if (!resp.ok) { console.warn('[服务器状态] v' + ver + ' HTTP ' + resp.status); continue; }
        const d = await resp.json();
        console.log('[服务器状态] v' + ver + ' 返回:', JSON.stringify(d).slice(0, 300));
        if (d.online) online = true;
        if (d.motd && !motd) motd = d.motd;
        if (d.players) {
          maxP = Math.max(maxP, d.players.max ?? 0);
          maxOnline = Math.max(maxOnline, d.players.online ?? 0);
          const raw = d.players.list || [];
          const names = raw.length && typeof raw[0] === 'object' ? raw.map(p => p.name) : raw;
          real = [...new Set([...real, ...names])];
          const info = d.info?.clean || d.info?.raw || [];
          extra = [...new Set([...extra, ...info])];
        }
      } catch (e) { console.warn('[服务器状态] v' + ver + ' 异常:', e.message); }
    }
    const java = real.filter(n => n && !n.startsWith('.'));
    const bedrock = [...new Set([
      ...real.filter(n => n && n.startsWith('.')).map(n => n.slice(1)),
      ...extra.filter(n => n && n.startsWith('.')).map(n => n.slice(1)),
    ])];
    const totalOnline = Math.max(java.length + bedrock.length, maxOnline);
    const bots = Math.max(0, totalOnline - java.length - bedrock.length);
    console.log('[服务器状态] 直连合并结果:', JSON.stringify({ online, players: { online: totalOnline, max: maxP, java: java.length, bedrock: bedrock.length, bots } }));
    renderServerStatus({
      success: true, online,
      players: { online: totalOnline, max: maxP, java, bedrock, bots },
      motd,
    });
  } catch (e) {
    console.error('[服务器状态] 直连完全失败:', e);
    showError('无法获取数据');
  }
}

// 首次加载：铺加载态（此时 API 可能要等 8s 超时，没有转圈用户会以为页面卡死）
fetchServerStatus(true);
