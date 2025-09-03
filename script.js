
/*
  SwipeTree Lab (rc1m) — iPhone/iPad fixes
  - No on-screen Edit button
  - Cache-busted GET for labels (prevents Safari stale cache)
  - LocalStorage fallback + quick caption
  - Defaults prefilled from last-known label (localStorage / caption / server)
  - Long‑press + double‑tap (desktop: dblclick / 'E')
*/
(function () {
  const JITTER_PX = 12, HOLD_MS = 450, RETRY_MS = 120, RETRY_MAX = 20;
  const DOUBLE_TAP_MS = 300;
  const LABELS_ENDPOINT = "/.netlify/functions/labels";
  const LS_KEY = (id)=>`swipetree:label:${id}`;

  // ---------- CSS ----------
  (function injectCSS(){
    const id = "labForceAnchorCSS";
    if (document.getElementById(id)) return;
    const css = `
      #anchor{position:fixed!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;max-width:min(96vw,96vh)!important;max-height:min(96vh,96vw)!important;width:auto!important;height:auto!important;z-index:2147483647!important;display:block!important;visibility:visible!important;opacity:1!important;-webkit-touch-callout:none!important;-webkit-user-select:none!important;user-select:none!important;touch-action:none!important;pointer-events:auto!important;object-fit:contain}
      body{background:#000}
      #caption{position:fixed;left:50%;transform:translateX(-50%);z-index:2147483647;pointer-events:none;
               font:600 15px/1.2 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
               color:#fff;background:rgba(0,0,0,.55);padding:.5rem .75rem;border-radius:.5rem;
               text-shadow:0 1px 2px rgba(0,0,0,.5);max-width:92vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    `.trim();
    const s = document.createElement("style"); s.id = id; s.textContent = css; document.head.appendChild(s);
  })();

  // ---------- Helpers ----------
  function normalizeHash() {
    const q = new URLSearchParams(location.search);
    if (q.has("id") && !location.hash.includes("id=")) {
      const u = new URL(location.href); u.hash = `id=${q.get("id")}`; history.replaceState(null,"",u.toString());
    }
  }
  function getId() {
    const h = new URLSearchParams((location.hash||"").replace(/^#/,""));
    return h.get("id") || null;
  }
  function ensureAnchorEl() {
    let el = document.getElementById("anchor");
    if (!el) { el = document.createElement("img"); el.id="anchor"; el.alt="anchor"; document.body.appendChild(el); }
    el.setAttribute("draggable","false");
    el.addEventListener("dragstart", e => e.preventDefault());
    return el;
  }
  function ensureCaptionEl() {
    let c = document.getElementById("caption");
    if (!c) { c = document.createElement("div"); c.id="caption"; c.style.display="none"; document.body.appendChild(c); }
    return c;
  }
  function positionCaptionBelowImage(img, cap){
    if (!img || !cap) return;
    const r = img.getBoundingClientRect();
    const top = Math.min(window.innerHeight - 48, Math.max(12, r.bottom + 12));
    cap.style.top = `${Math.round(top)}px`;
  }
  function updateCaption(img, text){
    const cap = ensureCaptionEl();
    if (text && text.trim()) {
      cap.textContent = text.trim();
      cap.style.display = "block";
      positionCaptionBelowImage(img, cap);
    } else { cap.style.display = "none"; cap.textContent = ""; }
  }
  function parseCaptionDefaults(){
    const cap = document.getElementById("caption");
    if (!cap || !cap.textContent) return {name:"",dob:""};
    const parts = cap.textContent.split("•").map(s=>s.trim());
    return {name: parts[0] || "", dob: (parts[1] || "")};
  }

  // ---------- Image URLs ----------
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
  async function getLabel(id){
    try{
      const url = `${LABELS_ENDPOINT}?id=${encodeURIComponent(id)}&_=${Date.now()}`; // bust cache
      const r = await fetch(url, {headers:{"Cache-Control":"no-cache"}});
      if(!r.ok) return null;
      return await r.json().catch(()=>null);
    }catch(_){ return null; }
  }
  async function saveLabel(id,p){
    try{
      const r=await fetch(LABELS_ENDPOINT,{
        method:"POST",
        headers:{"Content-Type":"application/json","Cache-Control":"no-cache"},
        body:JSON.stringify({id,...p})
      });
      return r.ok;
    }catch(_){return false;}
  }

  // ---------- Edit flow ----------
  function attachEditTriggers(img, getId){
    let downAt=0,sx=0,sy=0,timer=null,lastTap=0;

    const fireEdit = async () => {
      const id = getId(); if (!id) return;

      // Defaults from localStorage -> caption -> server
      let defaults = {name:"", dob:""};
      try{
        const ls = localStorage.getItem(LS_KEY(id));
        if (ls) defaults = JSON.parse(ls);
      }catch(_){}
      if (!defaults.name && !defaults.dob) defaults = parseCaptionDefaults();

      // Fetch server (latest) in background and prefer if present
      let cur = await getLabel(id);
      if (cur && (cur.name || cur.dob)) defaults = {name:cur.name||"", dob:cur.dob||""};

      const name = prompt(`Edit Name for ${id}:`, defaults.name || "");
      if (name === null) return;
      const dob  = prompt(`Edit DOB for ${id}:`,  defaults.dob  || "");
      if (dob === null) return;
      const clean = (s)=> (s||"").trim();
      const newVals = {name:clean(name), dob:clean(dob)};

      const ok = await saveLabel(id,newVals);
      if (ok) {
        try{ localStorage.setItem(LS_KEY(id), JSON.stringify(newVals)); }catch(_){}
        updateCaption(img, `${newVals.name}${newVals.dob?` • ${newVals.dob}`:""}`);
      } else {
        alert("Save failed. Try again.");
      }
    };

    img.addEventListener("contextmenu", e => e.preventDefault());
    img.addEventListener("gesturestart", e => e.preventDefault());

    function start(x,y){ downAt=Date.now(); sx=x; sy=y; clearTimeout(timer); timer=setTimeout(()=>{ fireEdit(); }, HOLD_MS); }
    function move(x,y){ if(!downAt) return; const dx=Math.abs(x-sx), dy=Math.abs(y-sy); if(dx>JITTER_PX || dy>JITTER_PX){ clearTimeout(timer); } }
    function end(){ clearTimeout(timer); downAt=0; }

    img.addEventListener("pointerdown", e => { img.setPointerCapture?.(e.pointerId); start(e.clientX,e.clientY); });
    img.addEventListener("pointermove",  e => move(e.clientX,e.clientY));
    img.addEventListener("pointerup", end);
    img.addEventListener("pointercancel", end);

    img.addEventListener("touchstart", e => { e.preventDefault(); const t=e.changedTouches[0]; if(t) start(t.clientX,t.clientY); }, {passive:false});
    img.addEventListener("touchmove",  e => { const t=e.changedTouches[0]; if(t) move(t.clientX,t.clientY); }, {passive:true});
    img.addEventListener("touchend",   e => { e.preventDefault(); 
      const now=Date.now(); if(now-lastTap<=DOUBLE_TAP_MS){ clearTimeout(timer); fireEdit(); } lastTap=now; end();
    }, {passive:false});
    img.addEventListener("touchcancel", end);

    img.addEventListener("dblclick", e => { e.preventDefault(); fireEdit(); });
    document.addEventListener("keydown", e => { if(e.key.toLowerCase()==="e") fireEdit(); });
  }

  // ---------- Init ----------
  async function tryInit(n=0){
    normalizeHash();
    const id = getId();
    if(!id){ if(n<RETRY_MAX) return setTimeout(()=>tryInit(n+1), RETRY_MS); console.warn("[SwipeTree Lab] No id in URL."); return; }

    const img=ensureAnchorEl(); await tryImage(img, buildCandidateUrls(id));

    // Quick caption from localStorage first (feels instant), then refresh from server
    try{
      const ls = localStorage.getItem(LS_KEY(id));
      if (ls) {
        const v = JSON.parse(ls);
        if (v && (v.name || v.dob)) updateCaption(img, `${v.name||""}${v.dob?` • ${v.dob}`:""}`.trim());
      }
    }catch(_){}

    const lbl=await getLabel(id);
    const text = lbl ? `${lbl.name||""}${lbl && lbl.dob ? ` • ${lbl.dob}` : ""}`.trim() : "";
    if (text) {
      updateCaption(img, text);
      try{ localStorage.setItem(LS_KEY(id), JSON.stringify({name:lbl.name||"", dob:lbl.dob||""})); }catch(_){}
    }

    if(!img.__editAttached){ attachEditTriggers(img, getId); img.__editAttached=true; }

    // Reposition on resize/rotate
    addEventListener("resize", () => positionCaptionBelowImage(img, ensureCaptionEl()));
    addEventListener("orientationchange", () => positionCaptionBelowImage(img, ensureCaptionEl()));
  }

  addEventListener("hashchange",()=>tryInit(0));
  if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded",()=>{tryInit(0); setTimeout(()=>tryInit(1),120);}); }
  else { tryInit(0); setTimeout(()=>tryInit(1),120); }

  console.log("[SwipeTree Lab rc1m] iOS cache-busted labels, localStorage defaults, no button.");
})();
