
/*
  SwipeTree Lab (rc1h) — iPad-friendly long‑press + double‑tap fallback
  - Injects CSS (center image, disable iOS callout/drag, touch-action none)
  - Uses config.js (SWIPETREE_IMG_BASE/FALLBACK) to load images
  - Netlify labels GET/POST
  - Long-press 450ms with jitter tolerance + double-tap within 300ms
  - Also supports dblclick on desktop
*/
(function () {
  const JITTER_PX = 12, HOLD_MS = 450, RETRY_MS = 120, RETRY_MAX = 20;
  const DOUBLE_TAP_MS = 300;
  const LABELS_ENDPOINT = "/.netlify/functions/labels";

  // ---------- Inject CSS ----------
  (function injectCSS(){
    const id = "labForceAnchorCSS";
    if (document.getElementById(id)) return;
    const css = `#anchor{position:fixed!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;max-width:min(96vw,96vh)!important;max-height:min(96vh,96vw)!important;width:auto!important;height:auto!important;z-index:2147483647!important;display:block!important;visibility:visible!important;opacity:1!important;-webkit-touch-callout:none!important;-webkit-user-select:none!important;user-select:none!important;touch-action:none!important;pointer-events:auto!important;object-fit:contain!important}body{background:#000}`;
    const s = document.createElement("style"); s.id = id; s.textContent = css; document.head.appendChild(s);
  })();

  // ---------- URL helpers ----------
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

  // ---------- DOM helpers ----------
  function ensureAnchorEl() {
    let el = document.getElementById("anchor");
    if (!el) { el = document.createElement("img"); el.id="anchor"; el.alt="anchor"; document.body.appendChild(el); }
    el.setAttribute("draggable","false");
    el.addEventListener("dragstart", e => e.preventDefault());
    return el;
  }

  // ---------- Image candidates ----------
  function buildCandidateUrls(id) {
    const filename = `${id}.jpg`; const bases = [];
    if (window.SWIPETREE_IMG_BASE)     bases.push(String(window.SWIPETREE_IMG_BASE).replace(/\/+$/,""));
    bases.push(""); bases.push("/images");
    if (window.SWIPETREE_IMG_FALLBACK) bases.push(String(window.SWIPETREE_IMG_FALLBACK).replace(/\/+$/,""));
    const seen=new Set(), uniq=[]; for(const b of bases){const u=b.replace(/\/+$/,""); if(!seen.has(u)){seen.add(u); uniq.push(u);}}
    return uniq.map(b=>b?`${b}/${filename}`:filename);
  }
  function tryImage(el, urls, i=0){return new Promise(res=>{if(i>=urls.length){el.src="placeholder.jpg";return res(false);}const u=urls[i];el.onerror=()=>tryImage(el,urls,i+1).then(res);el.onload=()=>res(true);el.src=u;});}

  // ---------- Labels ----------
  async function getLabel(id){try{const r=await fetch(`/.netlify/functions/labels?id=${encodeURIComponent(id)}`); if(!r.ok) return null; return await r.json().catch(()=>null);}catch(_){return null;}}
  async function saveLabel(id,p){try{const r=await fetch(LABELS_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,...p})}); return r.ok;}catch(_){return false;}}
  function showLabel(el,t){ if(el) el.setAttribute("title", t||""); }

  // ---------- Edit trigger (long-press + double-tap) ----------
  function attachEditTriggers(el, getId){
    let downAt=0,sx=0,sy=0,timer=null,lastTap=0;

    const fireEdit = async () => {
      const id = getId(); if (!id) return;
      const cur = await getLabel(id);
      const name = prompt(`Edit Name for ${id}:`, (cur && cur.name) || "");
      if (name === null) return;
      const dob  = prompt(`Edit DOB for ${id}:`,  (cur && cur.dob)  || "");
      if (dob === null) return;
      const ok = await saveLabel(id,{name,dob});
      if (ok) showLabel(el, `${name}${dob?` • ${dob}`:""}`);
      else alert("Save failed. Try again.");
    };

    // Prevent default iOS behaviors that steal the gesture
    el.addEventListener("contextmenu", e => e.preventDefault());
    el.addEventListener("gesturestart", e => e.preventDefault());

    function start(x,y){
      downAt=Date.now(); sx=x; sy=y; clearTimeout(timer);
      timer=setTimeout(()=>{ fireEdit(); }, HOLD_MS);
    }
    function move(x,y){
      if(!downAt) return;
      const dx=Math.abs(x-sx), dy=Math.abs(y-sy);
      if(dx>JITTER_PX || dy>JITTER_PX){ clearTimeout(timer); }
    }
    function end(){ clearTimeout(timer); downAt=0; }

    // Pointer events
    el.addEventListener("pointerdown", e => { el.setPointerCapture?.(e.pointerId); start(e.clientX,e.clientY); });
    el.addEventListener("pointermove",  e => move(e.clientX,e.clientY));
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);

    // Touch events (iOS)
    el.addEventListener("touchstart", e => { e.preventDefault(); const t=e.changedTouches[0]; if(t) start(t.clientX,t.clientY); }, {passive:false});
    el.addEventListener("touchmove",  e => { const t=e.changedTouches[0]; if(t) move(t.clientX,t.clientY); }, {passive:true});
    el.addEventListener("touchend",   e => { e.preventDefault(); 
      const now=Date.now(); if(now-lastTap<=DOUBLE_TAP_MS){ clearTimeout(timer); fireEdit(); } lastTap=now; end();
    }, {passive:false});
    el.addEventListener("touchcancel", end);

    // Desktop friendly fallback
    el.addEventListener("dblclick", e => { e.preventDefault(); fireEdit(); });
    document.addEventListener("keydown", e => { if(e.key.toLowerCase()==="e") fireEdit(); });
  }

  // ---------- Init ----------
  async function tryInit(n=0){
    normalizeHash(); const id=getIdFromUrl();
    if(!id){ if(n<RETRY_MAX) return setTimeout(()=>tryInit(n+1), RETRY_MS); console.warn("[SwipeTree Lab] No id in URL."); return; }
    const img=ensureAnchorEl(); await tryImage(img, buildCandidateUrls(id));
    const lbl=await getLabel(id); if(lbl&&(lbl.name||lbl.dob)) showLabel(img,`${lbl.name||""}${lbl.dob?` • ${lbl.dob}`:""}`.trim());
    if(!img.__editAttached){ attachEditTriggers(img, ()=>getIdFromUrl()); img.__editAttached=true; }
  }
  addEventListener("hashchange",()=>tryInit(0));
  if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded",()=>{tryInit(0); setTimeout(()=>tryInit(1),120);}); }
  else { tryInit(0); setTimeout(()=>tryInit(1),120); }
  console.log("[SwipeTree Lab rc1h] iPad-ready: long‑press + double‑tap active.");
})();
