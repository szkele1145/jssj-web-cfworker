const S={query:"Query 协议",ping:"Java Ping",bedrock:"基岩 RakNet","third-party":"第三方 API",offline:"离线静态版"},L={query:"fa-bolt",ping:"fa-satellite-dish",bedrock:"fa-mobile-screen","third-party":"fa-cloud",offline:"fa-file-arrow-down"},r=document.getElementById("mcWrap"),k=3e4;let h=0;function c(a){return String(a??"").replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[s])}function x(){return window.__JSSJ_API_BASE__??""}function A(){return new Date().toLocaleTimeString("zh-CN",{hour12:!1})}function g(a){const s=S[a]||"未知",n=L[a]||"fa-circle-question";return`<span class="mc-proto ${a==="query"?"proto-query":a==="third-party"?"proto-third":"proto-ping"}"><i class="fas ${n}" aria-hidden="true"></i>${c(s)}</span>`}function m(){return`<div class="mc-foot">
      <span><i class="fas fa-clock" aria-hidden="true"></i> 更新于 ${c(A())}</span>
      <button class="btn btn-sm" type="button" id="mcRefreshFoot"><i class="fas fa-redo" aria-hidden="true"></i> 刷新</button>
    </div>`}function v(){document.getElementById("mcRefreshFoot")?.addEventListener("click",()=>f(!0))}function E(a){r.innerHTML=`<div class="mc-card">
      <div class="loading-inline" role="status" aria-live="polite">
        <span class="spinner" aria-hidden="true"></span>
        <span class="loading-text">${a?"正在刷新服务器状态…":"正在获取服务器状态…"}</span>
      </div>
    </div>`}function O(a){r.innerHTML=`<div class="mc-card">
      <div class="mc-state state-error">
        <span class="mc-state-icon"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i></span>
        <span class="mc-state-text"><b>${c(a||"无法获取数据")}</b>
          <span class="small muted">可以点「重试」，或稍后再来</span>
        </span>
      </div>
      ${m()}
    </div>`,v()}function q(a){const s=String(a?.server?.host||"jssj.cc.cd"),n=a?.server?.port??25081,e=String(a?.server?.srv||"jssj.cc.cd"),t=String(a?.motd?.clean?.[0]||a?.motd?.html?.[0]||"离线静态版：不查询实时状态");r.innerHTML=`<div class="mc-card">
      <div class="mc-head">
        <span class="mc-live"><span class="dot" aria-hidden="true">●</span><span class="mc-live-text">离线静态版</span></span>
        <span class="mc-online"><i class="fas fa-plug" aria-hidden="true"></i> 不查询实时状态</span>
      </div>
      <div class="mc-meta">${g(a?.proto||"offline")}</div>
      <div class="mc-body">
        <div class="mc-motd"><div>${c(t)}</div></div>
        <div class="mc-pgrid">
          <div class="mc-psec">
            <div class="mc-plabel"><span class="mc-plabel-badge pl-java">地址</span></div>
            <div class="mc-plist"><span class="mc-player">${c(e)}</span></div>
          </div>
          <div class="mc-psec">
            <div class="mc-plabel"><span class="mc-plabel-badge pl-bedrock">端口</span></div>
            <div class="mc-plist"><span class="mc-player">${c(String(n))}</span></div>
          </div>
        </div>
        <div class="small muted">SRV 解析到 ${c(s)}。要看实时在线人数请打开带后端的线上站点。</div>
      </div>
      ${m()}
    </div>`,v()}function M(a){r.innerHTML=`<div class="mc-card">
      <div class="mc-state state-off">
        <span class="mc-state-icon"><i class="fas fa-plug-circle-xmark" aria-hidden="true"></i></span>
        <span class="mc-state-text">
          <b class="mc-live-off">已关闭</b>
          <span class="small muted">当前无法连接到 MC 服务器</span>
          ${g(a)}
        </span>
      </div>
      ${m()}
    </div>`,v()}function B(a){const s=a.players||{},n=Array.isArray(s.java)?s.java:[],e=Array.isArray(s.bedrock)?s.bedrock:[],t=typeof s.bots=="number"?s.bots:0,l=a.queryActive===!0,o=s.online??0,d=(u,w,y,T)=>`
      <div class="mc-psec">
        <div class="mc-plabel"><span class="mc-plabel-badge ${w}">${u}</span>${T}</div>
        ${y.length?`<div class="mc-plist">${y.map(j=>`<span class="mc-player">${c(j)}</span>`).join("")}</div>`:""}
      </div>`,p=n.length===0&&e.length===0&&t===0?'<div class="mc-players-empty">暂无玩家在线</div>':`<div class="mc-pgrid">
          ${d("Java","pl-java",n,`${n.length} 人`)}
          ${d("BE","pl-bedrock",e,`${e.length} 人`)}
          <div class="mc-psec">
            <div class="mc-plabel"><span class="mc-plabel-badge pl-bot">Bot</span>${t} 个</div>
            <div class="small muted">${l?"精确值":"估算值（名单可能被截断）"}</div>
          </div>
        </div>`,i=a.motd?.html?.length?a.motd.html:a.motd?.clean||[],$=i.length?`<div class="mc-motd">${i.map(u=>`<div>${c(u)}</div>`).join("")}</div>`:'<div class="mc-motd mc-motd-empty">无 MOTD</div>';r.innerHTML=`<div class="mc-card">
      <div class="mc-head">
        <span class="mc-live"><span class="dot" aria-hidden="true">●</span><span class="mc-live-text">在线</span></span>
        <span class="mc-online"><i class="fas fa-users" aria-hidden="true"></i>${o}${s.max?" / "+s.max:""} 人在线</span>
      </div>
      <div class="mc-meta">${g(a.proto)}${l?'<span class="mc-proto proto-query">名单精确</span>':""}</div>
      <div class="mc-body">${p}${$}</div>
      ${m()}
    </div>`,v()}async function _(){const a=new AbortController,s=setTimeout(()=>a.abort(),8e3);try{const e=await(await fetch("https://api.mcsrvstat.us/3/jssj.cc.cd",{signal:a.signal})).json();if(!e)return null;const t=(e.players?.list||[]).map(i=>String(i?.name??i)),l=t.filter(i=>i.startsWith(".")).map(i=>i.slice(1)),o=t.filter(i=>!i.startsWith(".")),d=e.players?.online??0,b=Math.max(0,Math.max(d,o.length+l.length)-o.length-l.length),p=(e.motd?.clean||[]).length?e.motd.clean:String(e.motd?.raw||"").split(`
`).filter(Boolean);return{success:!0,online:e.online!==!1,proto:"third-party",queryActive:!1,players:{online:d,max:e.players?.max??0,java:o,bedrock:l,bots:b},motd:{html:p,clean:p}}}catch{return null}finally{clearTimeout(s)}}async function f(a=!1){clearTimeout(h),(a||!r.querySelector(".mc-card"))&&E(a);let s=null,n="";try{s=await(await fetch(x()+"/api/mc-status")).json(),(!s||s.success===!1||!s.players)&&(n=s?.error||"无法获取数据",s=null)}catch(t){n=t instanceof Error?t.message:"网络错误"}const e=s?.offline===!0||s?.proto==="offline";if(!s&&!e){const t=await _();t&&(s=t)}s?e?q(s):s.online===!1?M(s.proto):B(s):O(n),!e&&(h=window.setTimeout(()=>f(!1),k))}document.getElementById("mcRefreshTop")?.addEventListener("click",()=>f(!0));f(!1);window.addEventListener("pagehide",()=>clearTimeout(h));
