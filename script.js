
/*
  SwipeTree Lab (rc1g) — iOS-ready single-file drop-in
  Injects centering CSS, suppresses Safari context menu for long-press,
  robust init, image loading via config.js, Netlify labels, 500ms long-press.
*/
(function () {
  const JITTER_PX = 12, HOLD_MS = 500, RETRY_MS = 120, RETRY_MAX = 20;
  const LABELS_ENDPOINT = "/.netlify/functions/labels";

  (function injectCSS(){
    const id = "labForceAnchorCSS";
    if (document.getElementById(id)) return;
    const css = `#anchor{position:fixed!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;max-width:min(96vw,96vh)!important;max-height:min(96vh,96vw)!important;width:auto!important;height:auto!important;z-index:2147483647!important;display:block!important;visibility:visible!important;opacity:1!important;-webkit-touch-callout:none!important;-webkit-user-select:none!important;user-select:none!important;touch-action:manipulation!important}body{background:#000}`;
    const s = document.createElement("style"); s.id = id; s.textContent = css; document.head.appendChild(s);
  })();

  function getIdFromUrl() {
    const h = new URLSearchParams((location.hash||"").replace(/^#/,""));
    if (h.has("id")) return h.get("id");
    const q = new URLSearchParams(location.search);
    if (q.has("id")) return q.get("id");
    return null;
  }
  function normalizeHash() {
    const q = new URLSearchParams(location.search);
    if (q.has("id") && !location.hash.includes("id=")) {
      const u = new URL(location.href); u.hash = `id=${q.get("id")}`; history.replaceState(null,"",u.toString());
    }
  }
  function ensureAnchorEl() {
    let el = document.getElementById("anchor");
    if (!el) { el = document.createElement("img"); el.id="anchor"; el.alt="anchor"; el.style.objectFit="contain"; document.body.appendChild(el); }
    return el;
  }
  function buildCandidateUrls(id) {
    const filename = `${id}.jpg`; const bases = [];
    if (window.SWIPETREE_IMG_BASE)     bases.push(String(window.SWIPETREE_IMG_BASE).replace(/\/+$/,""));
    bases.push(""); bases.push("/images");
    if (window.SWIPETREE_IMG_FALLBACK) bases.push(String(window.SWIPETREE_IMG_FALLBACK).replace(/\/+$/,""));
    const seen=new Set(), uniq=[]; for(const b of bases){const u=b.replace(/\/+$/,""); if(!seen.has(u)){seen.add(u); uniq.push(u);}}
    return uniq.map(b=>b?`${b}/${filename}`:filename);
  }
  function tryImage(el, urls, i=0){return new Promise(res=>{if(i>=urls.length){el.src="placeholder.jpg";return res(false);}const u=urls[i];el.onerror=()=>tryImage(el,urls,i+1).then(res);el.onload=()=>res(true);el.src=u;});}

  async function getLabel(id){try{const r=await fetch(`${LABELS_ENDPOINT}?id=${encodeURIComponent(id)}`); if(!r.ok) return null; return await r.json().catch(()=>null);}catch(_){return null;}}
  async function saveLabel(id,p){try{const r=await fetch(LABELS_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,...p})}); return r.ok;}catch(_){return false;}}
  function showLabel(el,t){ if(el) el.setAttribute("title", t||""); }

  function attachLongPress(el,getId){
    let downAt=0,sx=0,sy=0,timer=null;
    el.addEventListener("contextmenu",e=>e.preventDefault());
    el.addEventListener("gesturestart",e=>e.preventDefault());
    function start(x,y){ downAt=Date.now(); sx=x; sy=y; clearTimeout(timer);
      timer=setTimeout(async()=>{ const id=getId(); if(!id) return;
        const cur=await getLabel(id); const name=prompt(`Edit Name for ${id}:`, (cur&&cur.name)||""); if(name===null) return;
        const dob =prompt(`Edit DOB for ${id}:`,  (cur&&cur.dob) ||""); if(dob===null) return;
        const ok=await saveLabel(id,{name,dob}); if(ok) showLabel(el,`${name}${dob?` • ${dob}`:""}`); else alert("Save failed. Try again.");
      },HOLD_MS);
    }
    function move(x,y){ if(!downAt) return; const dx=Math.abs(x-sx), dy=Math.abs(y-sy); if(dx>JITTER_PX||dy>JITTER_PX) clearTimeout(timer); }
    function end(){ clearTimeout(timer); downAt=0; }
    el.addEventListener("pointerdown",e=>{el.setPointerCapture?.(e.pointerId); start(e.clientX,e.clientY);});
    el.addEventListener("pointermove",e=>move(e.clientX,e.clientY));
    el.addEventListener("pointerup",end); el.addEventListener("pointercancel",end);
    el.addEventListener("touchstart",e=>{e.preventDefault();const t=e.changedTouches[0]; if(t) start(t.clientX,t.clientY);},{passive:false});
    el.addEventListener("touchmove", e=>{const t=e.changedTouches[0]; if(t) move(t.clientX,t.clientY);},{passive:true});
    el.addEventListener("touchend",  e=>{e.preventDefault(); end();},{passive:false});
    el.addEventListener("touchcancel", end);
  }

  async function tryInit(n=0){
    normalizeHash(); const id=getIdFromUrl();
    if(!id){ if(n<RETRY_MAX) return setTimeout(()=>tryInit(n+1), RETRY_MS); console.warn("[SwipeTree Lab] No id in URL."); return; }
    const img=ensureAnchorEl(); await tryImage(img, buildCandidateUrls(id));
    const lbl=await getLabel(id); if(lbl&&(lbl.name||lbl.dob)) showLabel(img,`${lbl.name||""}${lbl.dob?` • ${lbl.dob}`:""}`.trim());
    if(!img.__softEditAttached){ attachLongPress(img,()=>getIdFromUrl()); img.__softEditAttached=true; }
  }
  addEventListener("hashchange",()=>tryInit(0));
  if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded",()=>{tryInit(0); setTimeout(()=>tryInit(1),RETRY_MS);}); }
  else { tryInit(0); setTimeout(()=>tryInit(1),RETRY_MS); }
  console.log("[SwipeTree Lab rc1g] iOS-ready: centered image + long-press active.");
})();
