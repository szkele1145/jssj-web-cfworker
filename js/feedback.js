/* ============================================================
 * 建设世界 · 问题反馈页
 * ------------------------------------------------------------
 * 关键设计（每一处都有原因）：
 * 1) **查询凭证走 localStorage 的随机 token**，不用 IP 认领。
 *    用 IP 认领的话，同一个 NAT / 同一个 WiFi 下（手机热点、宿舍网、公司网）
 *    别人能直接看到你的反馈内容和回复 —— IP 不是身份。
 * 2) **配图先在前端压缩再传**。手机截图动辄 3~8MB，后端公开接口单张限 5MB、
 *    单次请求体 30MB，直接传原图很容易整单失败（还慢）。
 *    统一压到最长边 1600px、JPEG 0.85，正常截图能压到 200~500KB。
 * 3) 提交成功后**不再清掉刚填的内容再让用户怀疑人生**，而是换成回执卡片，
 *    并把 token 摆出来，让用户知道「凭这个能查进度」。
 * ============================================================ */
/* API 基址：域名访问用线上 API，IP 访问自动改走当前站点的相对路径（同源反代）。
 * 逻辑见 js/theme.js 的 apiBase() —— 那边是唯一实现，别在页面里再判断一次。 */
const API_BASE = jssjApiBase();
/* 回退基址：IP 访问时也是 ''（故意不回退到域名 —— 那时域名本身就是打不开的原因） */
const SHAPI_BASE = jssjApiFallbackBase();

async function fetchApi(path, options) {
  try {
    const resp = await fetch(API_BASE + path, options);
    if (!resp.ok) {
      // 429（提交太频繁）和 400（校验失败）后端都带了可读的 error 文案，
      // 不能像原来那样一律抛 "HTTP 429"，用户根本不知道发生了什么
      let msg = 'HTTP ' + resp.status;
      try {
        const d = await resp.clone().json();
        if (d && d.error) msg = d.error;
      } catch (e) {}
      const err = new Error(msg);
      err.status = resp.status;
      throw err;
    }
    return resp;
  } catch (e) {
    // 只有网络层失败才回退到 shapi；业务错误（4xx/5xx）不该换个域名重试
    if (!e.status && API_BASE !== SHAPI_BASE) {
      const fallback = await fetch(SHAPI_BASE + path, options);
      if (!fallback.ok) {
        let msg = 'HTTP ' + fallback.status;
        try { const d = await fallback.clone().json(); if (d && d.error) msg = d.error; } catch (e2) {}
        const err2 = new Error(msg);
        err2.status = fallback.status;
        throw err2;
      }
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

/* ---------- 分类与状态（中文标签只能在前端映射 ——
   后端返回的是 bug/suggest/… 这种稳定标识，不该把中文塞进数据库） ---------- */
const CATS = {
  bug:     { icon: 'fas fa-bug',           label: '功能异常' },
  suggest: { icon: 'fas fa-lightbulb',     label: '建议' },
  abuse:   { icon: 'fas fa-user-shield',   label: '举报违规' },
  other:   { icon: 'fas fa-ellipsis-h',    label: '其他' },
};
const STATUSES = {
  pending: { icon: 'fas fa-hourglass-half', label: '待处理' },
  doing:   { icon: 'fas fa-spinner',        label: '处理中' },
  done:    { icon: 'fas fa-circle-check',   label: '已处理' },
};

function catOf(k) { return CATS[k] || CATS.other; }
function statusOf(k) { return STATUSES[k] || STATUSES.pending; }

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso).slice(0, 16).replace('T', ' ');
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

/* ---------- 查询凭证 ---------- */
const TOKEN_KEY = 'fb_token';

function readToken() {
  try {
    let v = localStorage.getItem(TOKEN_KEY);
    // 早期版本可能存过别的东西，形状不对就换新的，避免一直查出空结果
    if (!v || !/^[A-Za-z0-9_-]{8,64}$/.test(v)) {
      v = 'fb' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8);
      localStorage.setItem(TOKEN_KEY, v);
    }
    return v;
  } catch (e) {
    // 隐私模式禁 localStorage 时给个一次性 token：这次能提交，但刷新后查不到
    return 'fb' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }
}

const TOKEN = readToken();

/* ---------- 配图：选择 / 预览 / 压缩 ---------- */
const MAX_IMAGES = 3;
const MAX_FILE_MB = 5;
let pickedFiles = [];      // File[]

const imgInput = document.getElementById('fbImages');
const thumbsBox = document.getElementById('fbThumbs');
const imgNote = document.getElementById('fbImgNote');

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('文件读取失败'));
    r.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('图片无法解码'));
    im.src = src;
  });
}

/* 预览缩略图：只缩到 220px，快且省内存 */
async function makeThumb(file) {
  const raw = await fileToDataURL(file);
  let img;
  try { img = await loadImage(raw); } catch (e) { return ''; }
  const EDGE = 220;
  const scale = Math.min(1, EDGE / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
  const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  try { return canvas.toDataURL('image/jpeg', 0.75); } catch (e) { return ''; }
}

/* 压缩：最长边 1600px，JPEG 0.85。
   GIF 不动（一转就丢动画），但要求原图不超限。 */
async function compressImage(file) {
  const isGif = /gif$/i.test(file.type);
  const limit = MAX_FILE_MB * 1024 * 1024;
  if (isGif) {
    if (file.size > limit) throw new Error('GIF 无法压缩，请换一张或先手动压到 ' + MAX_FILE_MB + 'MB 以内');
    return fileToDataURL(file);
  }
  const raw = await fileToDataURL(file);
  let img;
  try { img = await loadImage(raw); } catch (e) { throw new Error('图片无法解码，请换一张'); }

  const MAX_EDGE = 1600;
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
  const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  // 透明 PNG 直接转 JPEG 会变黑底，先铺一层白底
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  let out = canvas.toDataURL('image/jpeg', 0.85);
  // 极端情况（超大图 or 全屏噪点）压完还超限，就再降一档质量
  if (out.length > limit) out = canvas.toDataURL('image/jpeg', 0.7);
  if (out.length > limit) throw new Error('图片压缩后仍超过 ' + MAX_FILE_MB + 'MB，请换一张');
  return out;
}

function renderThumbs() {
  thumbsBox.innerHTML = pickedFiles.map((f, i) => {
    const url = f._preview || '';
    return '<div class="fb-thumb">' +
      (url ? '<img src="' + esc(url) + '" alt="待上传配图 ' + (i + 1) + '">' : '') +
      '<button type="button" class="fb-thumb-del" data-i="' + i + '" aria-label="移除第 ' + (i + 1) + ' 张图"><i class="fas fa-times" aria-hidden="true"></i></button>' +
      '</div>';
  }).join('');

  const over = pickedFiles.length >= MAX_IMAGES;
  if (imgNote) {
    if (over) {
      imgNote.hidden = false;
      imgNote.textContent = '已达上限 ' + MAX_IMAGES + ' 张，想换图请先移除一张。';
    } else if (pickedFiles.length) {
      imgNote.hidden = false;
      imgNote.textContent = '已选 ' + pickedFiles.length + ' / ' + MAX_IMAGES + ' 张';
    } else {
      imgNote.hidden = true;
      imgNote.textContent = '';
    }
  }
}

async function addFiles(fileList) {
  const incoming = Array.from(fileList || []);
  const problems = [];
  for (const f of incoming) {
    if (pickedFiles.length >= MAX_IMAGES) { problems.push('最多只能传 ' + MAX_IMAGES + ' 张，多余的已忽略'); break; }
    if (!/^image\//.test(f.type)) { problems.push(f.name + '：不是图片文件'); continue; }
    if (/svg/i.test(f.type)) { problems.push(f.name + '：不支持 SVG'); continue; }
    pickedFiles.push(f);
    // 预览只做 220px 缩略图：预览不需要清晰度，用「压缩后的全尺寸图」当预览
    // 会白占几 MB 内存（手机上明显卡顿），反正提交时还会按 1600px 重压一遍
    try { f._preview = await makeThumb(f); } catch (e) { f._preview = ''; }
  }
  renderThumbs();
  if (problems.length) showResult('warn', problems.join('；'));
}

imgInput && imgInput.addEventListener('change', function () {
  addFiles(this.files);
  this.value = '';   // 清空，否则连续选同一个文件不会再触发 change
});

thumbsBox && thumbsBox.addEventListener('click', function (e) {
  const btn = e.target.closest ? e.target.closest('.fb-thumb-del') : null;
  if (!btn) return;
  const i = parseInt(btn.getAttribute('data-i'), 10);
  if (!isNaN(i)) { pickedFiles.splice(i, 1); renderThumbs(); }
});

/* ---------- 字数统计 ---------- */
const contentEl = document.getElementById('fbContent');
const countEl = document.getElementById('fbCount');
function updateCount() {
  if (!contentEl || !countEl) return;
  const n = contentEl.value.length;
  countEl.textContent = n;
  countEl.parentNode.classList.toggle('over', n > 1900);
}
contentEl && contentEl.addEventListener('input', updateCount);

/* ---------- 结果提示 ---------- */
const resultBox = document.getElementById('fbResult');

function showResult(kind, text, extraHtml) {
  if (!resultBox) return;
  resultBox.hidden = false;
  if (kind === 'ok') {
    resultBox.className = 'fb-success';
    resultBox.innerHTML = '<div class="fb-success-head"><i class="fas fa-circle-check" aria-hidden="true"></i> ' + esc(text) + '</div>' + (extraHtml || '');
  } else if (kind === 'warn') {
    resultBox.className = 'note warn';
    resultBox.innerHTML = '<i class="fas fa-triangle-exclamation" aria-hidden="true"></i><div>' + esc(text) + '</div>';
  } else {
    resultBox.className = 'note danger';
    resultBox.innerHTML = '<i class="fas fa-circle-exclamation" aria-hidden="true"></i><div>' + esc(text) + '</div>';
  }
  resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ---------- 提交 ---------- */
const form = document.getElementById('fbForm');
const submitBtn = document.getElementById('fbSubmit');

form && form.addEventListener('submit', async function (e) {
  e.preventDefault();
  const content = (contentEl.value || '').trim();
  if (content.length < 5) {
    showResult('err', '问题描述至少 5 个字，请把现象写清楚一点。');
    contentEl.focus();
    return;
  }
  const catEl = form.querySelector('input[name="fbCat"]:checked');
  const category = catEl ? catEl.value : 'other';

  submitBtn.disabled = true;
  const oldHtml = submitBtn.innerHTML;
  submitBtn.innerHTML = '<span class="spinner spinner-sm" aria-hidden="true"></span> 提交中…';

  try {
    // 配图压缩（串行，避免手机上一次开三个 canvas 卡住）
    const images = [];
    for (const f of pickedFiles) {
      images.push(f._preview || await compressImage(f));
    }

    const resp = await fetchApi('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category,
        content,
        contact: (document.getElementById('fbContact').value || '').trim(),
        page: location.pathname + location.search,
        images,
        token: TOKEN,
      }),
    });
    const data = await resp.json();
    if (!data.success) throw new Error(data.error || '提交失败');

    // 回执：明确告诉用户「已收到」+「怎么查进度」
    showResult('ok', '反馈已提交，感谢你的反馈！',
      '<div>管理组会在后台看到这条反馈，处理完会在这里给你回复。</div>' +
      '<div class="row-note">查询凭证：<b class="break-all">' + esc(data.token || TOKEN) + '</b><br>' +
      '它已存在本机浏览器里，本页下方「我的反馈」会一直显示进度。换设备或清了浏览器数据就查不到了，建议截图保存。</div>');

    // 清表单但保留凭证
    contentEl.value = '';
    document.getElementById('fbContact').value = '';
    pickedFiles = [];
    renderThumbs();
    updateCount();
    loadMine();
  } catch (err) {
    const msg = err && err.message ? err.message : '未知错误';
    showResult('err', msg.indexOf('频繁') >= 0
      ? msg
      : '提交失败：' + msg + (msg.indexOf('HTTP') === 0 ? '（服务器可能暂时不可用，稍后再试）' : ''));
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = oldHtml;
  }
});

document.getElementById('fbReset') && document.getElementById('fbReset').addEventListener('click', function () {
  form.reset();
  pickedFiles = [];
  renderThumbs();
  updateCount();
  if (resultBox) { resultBox.hidden = true; resultBox.innerHTML = ''; }
});

/* ---------- 我的反馈 ---------- */
const mineBox = document.getElementById('fbMine');

function renderMine(items) {
  if (!mineBox) return;
  if (!items || !items.length) {
    mineBox.innerHTML =
      '<div class="empty-state">' +
        '<i class="far fa-envelope-open" aria-hidden="true"></i>' +
        '<div>这台设备还没有提交过反馈</div>' +
        '<div class="row-note">提交后，这里会显示处理进度和管理组的回复。</div>' +
      '</div>';
    return;
  }
  mineBox.innerHTML = items.map(function (it) {
    const c = catOf(it.category);
    const s = statusOf(it.status);
    const imgs = (it.images || []).length
      ? '<div class="fb-images">' + it.images.map(function (u) {
          const src = u.indexOf('http') === 0 ? u : API_BASE + u;
          return '<img src="' + esc(src) + '" alt="反馈配图" loading="lazy">';
        }).join('') + '</div>'
      : '';
    const reply = it.reply
      ? '<div class="fb-reply"><div class="fb-reply-label"><i class="fas fa-reply" aria-hidden="true"></i> 管理组回复' +
        (it.replyAt ? ' · ' + esc(fmtTime(it.replyAt)) : '') + '</div>' +
        '<div class="fb-reply-body">' + esc(it.reply) + '</div></div>'
      : '';
    return '<div class="fb-item" id="fb-' + esc(it.id) + '">' +
      '<div class="fb-item-head">' +
        '<span class="fb-status ' + esc(it.status) + '"><i class="' + s.icon + '" aria-hidden="true"></i> ' + esc(s.label) + '</span>' +
        '<span class="fb-cat-tag"><i class="' + c.icon + '" aria-hidden="true"></i> ' + esc(c.label) + '</span>' +
        '<span class="fb-cat-tag">' + esc(fmtTime(it.date)) + '</span>' +
      '</div>' +
      '<div class="fb-item-body">' + esc(it.content) + '</div>' +
      imgs + reply +
      '</div>';
  }).join('');
}

async function loadMine() {
  if (!mineBox) return;
  try {
    const resp = await fetchApi('/api/feedback/mine?token=' + encodeURIComponent(TOKEN));
    const data = await resp.json();
    renderMine(data.success ? (data.items || []) : []);
  } catch (e) {
    mineBox.innerHTML =
      '<div class="empty-state">' +
        '<i class="fas fa-cloud-exclamation" aria-hidden="true"></i>' +
        '<div>进度加载失败，请检查网络后重试</div>' +
        '<div class="row-note">' + esc(e && e.message ? e.message : '未知错误') + '</div>' +
        '<button class="btn btn-sm" type="button" onclick="loadMine()" style="margin-top:1rem;">' +
          '<i class="fas fa-redo" aria-hidden="true"></i> 重试' +
        '</button>' +
      '</div>';
  }
}

updateCount();
renderThumbs();
loadMine();
