
/*
  SwipeTree Lab (rc1j) — Adds visible caption under image (Name • DOB)
  - iPad-ready: long‑press + double‑tap + floating Edit button
  - Persists to Netlify function; shows caption after load/save
*/
(function () {
  const JITTER_PX = 12, HOLD_MS = 450, RETRY_MS = 120, RETRY_MAX = 20;
  const DOUBLE_TAP_MS = 300;
  const LABELS_ENDPOINT = "/.netlify/functions/labels";

  // ---------- Inject CSS ----------
  (function injectCSS(){
    const id = "labForceAnchorCSS";
    if (document.getElementById(id)) return;
    const css = `
      #anchor{position:fixed!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;max-width:min(96vw,96vh)!important;max-height:min(96vh,96vw)!important;width:auto!important;height:auto!important;z-index:2147483647!important;display:block!important;visibility:visible!important;opacity:1!important;-webkit-touch-callout:none!important;-webkit-user-select:none!important;user-select:none!important;touch-action:none!important;pointer-events:auto!important;object-fit:contain}
      body{background:#000}
      #editBtn{position:fixed;right:1rem;bottom:1rem;z-index:2147483647;font:600 16px/1 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:.75rem 1rem;border-radius:.75rem;border:0;box-shadow:0 6px 18px rgba(0,0,0,.25);background:#0ea5e9;color:#fff}
      #editBtn:active{transform:translateY(1px)}
      #caption{position:fixed;left:50%;transform:translateX(-50%);z-index:2147483647;pointer-events:none;
               font:600 15px/1.2 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
               color:#fff;background:rgba(0,0,0,.55);padding:.5rem .75rem;border-radius:.5rem;
               text-shadow:0 1px 2px rgba(0,0,0,.5);max-width:92vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    `.trim();
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
  function ensureCaptionEl() {
    let c = document.getElementById("caption");
    if (!c) { c = document.createElement("div"); c.id="caption"; c.style.display="none"; document.body.appendChild(c); }
    return c;
  }
  function ensureEditButton(onClick){
    let b = document.getElementById("editBtn");
    if (!b) {
      b = document.createElement("button");
      b.id = "editBtn"; b.type = "button"; b.textContent = "Edit";
      b.addEventListener("click", onClick);
      document.body.appendChild(b);
    }
    return b;
  }

  // Position caption 12px below image
  function positionCaptionBelowImage(img, cap){
    if (!img || !cap) return;
    const r = img.getBoundingClientRect();
    const top = Math.min(window.innerHeight - 48, Math.max(12, r.bottom + 12)); // clamp to viewport
    cap.style.top = `${Math.round(top)}px`;
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
  async function getLabel(id){try{const r=await fetch(`${LABELS_ENDPOINT}?id=${encodeURIComponent(id)}`); if(!r.ok) return null; return await r.json().catch(()=>null);}catch(_){return null;}}
  async function saveLabel(id,p){try{const r=await fetch(LABELS_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,...p})}); return r.ok;}catch(_){return false;}}

  function updateCaption(img, text){
    const cap = ensureCaptionEl();
    if (text && text.trim()) {
      cap.textContent = text.trim();
      cap.style.display = "block";
      positionCaptionBelowImage(img, cap);
    } else {
      cap.style.display = "none";
      cap.textContent = "";
    }
  }

  // ---------- Edit triggers ----------
  function attachEditTriggers(img, getId){
    let downAt=0,sx=0,sy=0,timer=null,lastTap=0;

    const fireEdit = async () => {
      const id = getId(); if (!id) return;
      const cur = await getLabel(id);
      const name = prompt(`Edit Name for ${id}:`, (cur && cur.name) || "");
      if (name === null) return;
      const dob  = prompt(`Edit DOB for ${id}:`,  (cur && cur.dob)  || "");
      if (dob === null) return;
      const ok = await saveLabel(id,{name,dob});
      if (ok) updateCaption(img, `${name}${dob?` • ${dob}`:""}`);
      else alert("Save failed. Try again.");
    };

    ensureEditButton(fireEdit);

    // Prevent default iOS behaviors that steal the gesture
    img.addEventListener("contextmenu", e => e.preventDefault());
    img.addEventListener("gesturestart", e => e.preventDefault());

    function start(x,y){ downAt=Date.now(); sx=x; sy=y; clearTimeout(timer); timer=setTimeout(()=>{ fireEdit(); }, HOLD_MS); }
    function move(x,y){ if(!downAt) return; const dx=Math.abs(x-sx), dy=Math.abs(y-sy); if(dx>JITTER_PX || dy>JITTER_PX){ clearTimeout(timer); } }
    function end(){ clearTimeout(timer); downAt=0; }

    // Pointer events
    img.addEventListener("pointerdown", e => { img.setPointerCapture?.(e.pointerId); start(e.clientX,e.clientY); });
    img.addEventListener("pointermove",  e => move(e.clientX,e.clientY));
    img.addEventListener("pointerup", end);
    img.addEventListener("pointercancel", end);

    // Touch events (iOS)
    img.addEventListener("touchstart", e => { e.preventDefault(); const t=e.changedTouches[0]; if(t) start(t.clientX,t.clientY); }, {passive:false});
    img.addEventListener("touchmove",  e => { const t=e.changedTouches[0]; if(t) move(t.clientX,t.clientY); }, {passive:true});
    img.addEventListener("touchend",   e => { e.preventDefault(); 
      const now=Date.now(); if(now-lastTap<=DOUBLE_TAP_MS){ clearTimeout(timer); fireEdit(); } lastTap=now; end();
    }, {passive:false});
    img.addEventListener("touchcancel", end);

    // Desktop friendly fallback
    img.addEventListener("dblclick", e => { e.preventDefault(); fireEdit(); });
    document.addEventListener("keydown", e => { if(e.key.toLowerCase()==="e") fireEdit(); });

    // Reposition caption on resize/rotate
    addEventListener("resize", () => positionCaptionBelowImage(img, ensureCaptionEl()));
    addEventListener("orientationchange", () => positionCaptionBelowImage(img, ensureCaptionEl()));
  }

  // ---------- Init ----------
  async function tryInit(n=0){
    normalizeHash();
    const q = new URLSearchParams(location.search);
    const h = new URLSearchParams((location.hash||"").replace(/^#/,""));
    const id = h.get("id") || q.get("id");
    if(!id){ if(n<RETRY_MAX) return setTimeout(()=>tryInit(n+1), RETRY_MS); console.warn("[SwipeTree Lab] No id in URL."); return; }

    const img=ensureAnchorEl(); await tryImage(img, buildCandidateUrls(id));
    const lbl=await getLabel(id);
    const text = lbl ? `${lbl.name||""}${lbl && lbl.dob ? ` • ${lbl.dob}` : ""}`.trim() : "";
    updateCaption(img, text);

    if(!img.__editAttached){ attachEditTriggers(img, ()=>{const hh=new URLSearchParams((location.hash||"").replace(/^#/,"")); return hh.get("id") || new URLSearchParams(location.search).get("id"); }); img.__editAttached=true; }
  }
  addEventListener("hashchange",()=>tryInit(0));
  if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded",()=>{tryInit(0); setTimeout(()=>tryInit(1),120);}); }
  else { tryInit(0); setTimeout(()=>tryInit(1),120); }
  console.log("[SwipeTree Lab rc1j] iPad-ready: caption visible + edit controls active.");
})();
