const k={query:"Query 协议",ping:"Java Ping",bedrock:"基岩 RakNet","third-party":"第三方 API",offline:"离线静态版"},x={query:"fa-bolt",ping:"fa-satellite-dish",bedrock:"fa-mobile-screen","third-party":"fa-cloud",offline:"fa-file-arrow-down"},d=document.getElementById("mcWrap"),q=3e4;let g=0,w=!1,h=0;function l(s){return String(s??"").replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}function A(){return window.__JSSJ_API_BASE__??""}function E(){return new Date().toLocaleTimeString("zh-CN",{hour12:!1})}function b(s){const e=k[s]||"未知",a=x[s]||"fa-circle-question";return`<span class="mc-proto ${s==="query"?"proto-query":s==="third-party"?"proto-third":"proto-ping"}"><i class="fas ${a}" aria-hidden="true"></i>${l(e)}</span>`}function p(){return`<div class="mc-foot">
      <span><i class="fas fa-clock" aria-hidden="true"></i> 更新于 ${l(E())}</span>
      <button class="btn btn-sm" type="button" id="mcRefreshFoot"><i class="fas fa-redo" aria-hidden="true"></i> 刷新</button>
    </div>`}function m(){document.getElementById("mcRefreshFoot")?.addEventListener("click",()=>f(!0))}function O(s){d.innerHTML=`<div class="mc-card">
      <div class="loading-inline" role="status" aria-live="polite">
        <span class="spinner" aria-hidden="true"></span>
        <span class="loading-text">${s?"正在刷新服务器状态…":"正在获取服务器状态…"}</span>
      </div>
      ${p()}
    </div>`,m()}function M(s){d.innerHTML=`<div class="mc-card">
      <div class="mc-state state-error">
        <span class="mc-state-icon"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i></span>
        <span class="mc-state-text"><b>${l(s||"无法获取数据")}</b>
          <span class="small muted">可以点「刷新」，或稍后再来</span>
        </span>
      </div>
      ${p()}
    </div>`,m()}function B(s){const e=String(s?.server?.host||"jssj.cc.cd"),a=s?.server?.port??25081,t=String(s?.server?.srv||"jssj.cc.cd"),i=String(s?.motd?.clean?.[0]||s?.motd?.html?.[0]||"离线静态版：不查询实时状态");d.innerHTML=`<div class="mc-card">
      <div class="mc-head">
        <span class="mc-live"><span class="dot" aria-hidden="true">●</span><span class="mc-live-text">离线静态版</span></span>
        <span class="mc-online"><i class="fas fa-plug" aria-hidden="true"></i> 不查询实时状态</span>
      </div>
      <div class="mc-meta">${b(s?.proto||"offline")}</div>
      <div class="mc-body">
        <div class="mc-motd"><div>${l(i)}</div></div>
        <div class="mc-pgrid">
          <div class="mc-psec">
            <div class="mc-plabel"><span class="mc-plabel-badge pl-java">地址</span></div>
            <div class="mc-plist"><span class="mc-player">${l(t)}</span></div>
          </div>
          <div class="mc-psec">
            <div class="mc-plabel"><span class="mc-plabel-badge pl-bedrock">端口</span></div>
            <div class="mc-plist"><span class="mc-player">${l(String(a))}</span></div>
          </div>
        </div>
        <div class="small muted">SRV 解析到 ${l(e)}。要看实时在线人数请打开带后端的线上站点。</div>
      </div>
      ${p()}
    </div>`,m()}function _(s){d.innerHTML=`<div class="mc-card">
      <div class="mc-state state-off">
        <span class="mc-state-icon"><i class="fas fa-plug-circle-xmark" aria-hidden="true"></i></span>
        <span class="mc-state-text">
          <b class="mc-live-off">已关闭</b>
          <span class="small muted">当前无法连接到 MC 服务器</span>
          ${b(s)}
        </span>
      </div>
      ${p()}
    </div>`,m()}function P(s){const e=s.players||{},a=Array.isArray(e.java)?e.java:[],t=Array.isArray(e.bedrock)?e.bedrock:[],i=typeof e.bots=="number"?e.bots:0,n=s.queryActive===!0,r=e.online??0,o=(u,j,$,S)=>`
      <div class="mc-psec">
        <div class="mc-plabel"><span class="mc-plabel-badge ${j}">${u}</span>${S}</div>
        ${$.length?`<div class="mc-plist">${$.map(L=>`<span class="mc-player">${l(L)}</span>`).join("")}</div>`:""}
      </div>`,v=a.length===0&&t.length===0&&i===0?'<div class="mc-players-empty">暂无玩家在线</div>':`<div class="mc-pgrid">
          ${o("Java","pl-java",a,`${a.length} 人`)}
          ${o("BE","pl-bedrock",t,`${t.length} 人`)}
          <div class="mc-psec">
            <div class="mc-plabel"><span class="mc-plabel-badge pl-bot">Bot</span>${i} 个</div>
            <div class="small muted">${n?"精确值":"估算值（名单可能被截断）"}</div>
          </div>
        </div>`,c=s.motd?.html?.length?s.motd.html:s.motd?.clean||[],T=c.length?`<div class="mc-motd">${c.map(u=>`<div>${l(u)}</div>`).join("")}</div>`:'<div class="mc-motd mc-motd-empty">无 MOTD</div>';d.innerHTML=`<div class="mc-card">
      <div class="mc-head">
        <span class="mc-live"><span class="dot" aria-hidden="true">●</span><span class="mc-live-text">在线</span></span>
        <span class="mc-online"><i class="fas fa-users" aria-hidden="true"></i>${r}${e.max?" / "+e.max:""} 人在线</span>
      </div>
      <div class="mc-meta">${b(s.proto)}${n?'<span class="mc-proto proto-query">名单精确</span>':""}</div>
      <div class="mc-body">${v}${T}</div>
      ${p()}
    </div>`,m()}async function R(){const s=new AbortController,e=setTimeout(()=>s.abort(),8e3);try{const t=await(await fetch("https://api.mcsrvstat.us/3/jssj.cc.cd",{signal:s.signal})).json();if(!t)return null;const i=(t.players?.list||[]).map(c=>String(c?.name??c)),n=i.filter(c=>c.startsWith(".")).map(c=>c.slice(1)),r=i.filter(c=>!c.startsWith(".")),o=t.players?.online??0,y=Math.max(0,Math.max(o,r.length+n.length)-r.length-n.length),v=(t.motd?.clean||[]).length?t.motd.clean:String(t.motd?.raw||"").split(`
`).filter(Boolean);return{success:!0,online:t.online!==!1,proto:"third-party",queryActive:!1,players:{online:o,max:t.players?.max??0,java:r,bedrock:n,bots:y},motd:{html:v,clean:v}}}catch{return null}finally{clearTimeout(e)}}async function f(s=!1){clearTimeout(g),(s||!w)&&O(s);const e=++h;let a=null,t="";try{a=await(await fetch(A()+"/api/mc-status")).json(),(!a||a.success===!1||!a.players)&&(t=a?.error||"无法获取数据",a=null)}catch(n){t=n instanceof Error?n.message:"网络错误"}const i=a?.offline===!0||a?.proto==="offline";if(!a&&!i){const n=await R();n&&(a=n)}e===h&&(a?i?B(a):a.online===!1?_(a.proto):P(a):M(t),w=!0,!i&&e===h&&(g=window.setTimeout(()=>f(!1),q)))}document.getElementById("mcRefreshTop")?.addEventListener("click",()=>f(!0));f(!1);window.addEventListener("pagehide",()=>clearTimeout(g));
