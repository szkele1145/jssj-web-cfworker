// 外部 module 文件：把 ③ 变绿（被 import() 或 <script type=module src> 加载都算成功）
const el = document.getElementById('b3');
if (el) {
  el.className = 'box ok';
  el.innerHTML = '③ 外部 module 文件：<b>成功 ✅</b>';
}
export const ok = true;
