
/*! SwipeTree Lab — script.js (RC4 Long‑Press)
 * - Visible anchor renderer
 * - Device‑independent labels (Netlify GET/POST)
 * - Edge friction
 * - Long‑press to edit (mobile & desktop)
 */
(function(){
  // ---------- Config ----------
  const NETLIFY_ENDPOINT = '/.netlify/functions/labels';
  const IMAGE_BASE = 'https://allofusbhere.github.io/family-tree-images/';
  const EXT = '.jpg';

  // ---------- DOM bootstrap ----------
  let app = document.getElementById('app');
  if (!app) {
    app = document.createElement('div');
    app.id = 'app';
    document.body.appendChild(app);
  }
  document.documentElement.style.touchAction = 'manipulation';
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';
  app.style.minHeight = '100dvh';
  app.style.display = 'flex';
  app.style.alignItems = 'center';
  app.style.justifyContent = 'center';
  app.style.background = '#000';

  const wrap = document.createElement('div');
  wrap.style.textAlign = 'center';
  app.appendChild(wrap);

  const img = document.createElement('img');
  img.id = 'anchor';
  img.alt = 'anchor';
  img.draggable = false;
  img.style.maxWidth = 'min(92vw,92vh)';
  img.style.maxHeight = 'min(92vh,92vw)';
  img.style.objectFit = 'contain';
  img.style.userSelect = 'none';
  img.style.webkitUserDrag = 'none';
  wrap.appendChild(img);

  const label = document.createElement('div');
  label.id = 'label';
  label.style.color = '#fff';
  label.style.marginTop = '12px';
  label.style.opacity = '0.9';
  label.style.fontFamily = 'system-ui, sans-serif';
  wrap.appendChild(label);

  // ---------- Edge friction (no page bounce) ----------
  const surface = app;
  document.addEventListener('gesturestart', e => e.preventDefault(), {passive:false});
  document.addEventListener('gesturechange', e => e.preventDefault(), {passive:false});
  document.addEventListener('gestureend', e => e.preventDefault(), {passive:false});
  let active = false, touchId = null;
  surface.addEventListener('touchstart', (e)=>{
    if (e.touches.length === 1) { active = true; touchId = e.touches[0].identifier; e.preventDefault(); }
    else { active = false; }
  }, {passive:false});
  surface.addEventListener('touchmove', (e)=>{ if (active) e.preventDefault(); }, {passive:false});
  surface.addEventListener('touchend', (e)=>{
    const still = Array.from(e.touches||[]).some(t => t.identifier === touchId);
    if (!still) { active=false; touchId=null; }
  }, {passive:false});
  surface.addEventListener('touchcancel', ()=>{ active=false; touchId=null; }, {passive:false});
  surface.addEventListener('wheel', (e)=>e.preventDefault(), {passive:false});
  window.addEventListener('keydown', (e)=>{
    const keys=['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '];
    if (keys.includes(e.key)) e.preventDefault();
  }, {passive:false});

  // ---------- Labels sync (Netlify + localStorage) ----------
  const LABELS_KEY = 'labels';
  const BACKUP_KEY = 'labels_backup';
  const SYNC_FLAG = '__labels_sync_inflight__';
  const POLL_MS = 30000;

  const log = (...a)=>console.log('[SwipeTree]', ...a);
  const warn = (...a)=>console.warn('[SwipeTree]', ...a);

  function readLocal(){
    try { return JSON.parse(localStorage.getItem(LABELS_KEY) || '{}'); }
    catch(e){ warn('bad local labels', e); return {}; }
  }
  function writeLocal(map){
    try {
      localStorage.setItem(LABELS_KEY, JSON.stringify(map||{}));
      localStorage.setItem(BACKUP_KEY, JSON.stringify({at:Date.now(), data: map||{}}));
    } catch(e){ warn('write local failed', e); }
  }
  async function fetchRemote(){
    try {
      const r = await fetch(NETLIFY_ENDPOINT, {method:'GET', headers:{accept:'application/json'}});
      if (!r.ok) throw new Error('GET '+r.status);
      const data = await r.json();
      return data && (data.labels || data) || {};
    } catch(e){ warn('fetch remote failed', e); return null; }
  }
  async function pushRemote(map){
    try {
      const r = await fetch(NETLIFY_ENDPOINT, {
        method:'POST',
        headers:{'content-type':'application/json'},
        body: JSON.stringify({op:'upsert_all', labels: map||{}})
      });
      if (!r.ok) throw new Error('POST '+r.status);
      return true;
    } catch(e){ warn('push remote failed', e); return false; }
  }
  function mergeLabels(a,b){
    const out = {...(a||{})};
    for(const [id,rec] of Object.entries(b||{})){
      out[id] = {...(out[id]||{}), ...(rec||{})};
    }
    return out;
  }

  const origSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(k,v){
    origSetItem(k,v);
    if (k !== LABELS_KEY) return;
    try {
      const current = JSON.parse(v||'{}');
      queueMicrotask(()=>{
        if (window[SYNC_FLAG]) return;
        window[SYNC_FLAG] = true;
        pushRemote(current).finally(()=>{ window[SYNC_FLAG]=false; });
      });
    } catch {}
  };

  window.setLabel = function(id, patch){
    if (!id) return;
    const map = readLocal();
    map[id] = {...(map[id]||{}), ...(patch||{})};
    writeLocal(map);
    render(); // reflect immediately
  };
  window.getLabel = function(id){ return readLocal()[id] || null; };

  (async function initSync(){
    log('Labels: init sync');
    const local = readLocal();
    const remote = await fetchRemote();
    if (remote) {
      const merged = mergeLabels(remote, local);
      writeLocal(merged);
      await pushRemote(merged);
      log('Labels synced; entries:', Object.keys(merged).length);
    } else {
      writeLocal(local);
      log('Offline; using local labels');
    }
    setInterval(async()=>{
      const r = await fetchRemote();
      if (r) {
        const merged = mergeLabels(r, readLocal());
        writeLocal(merged);
        log('Periodic merge; entries:', Object.keys(merged).length);
        render();
      }
    }, POLL_MS);
  })();

  // ---------- Anchor renderer + label UI ----------
  function idFromHash(){
    const m = location.hash.match(/id=([\d.]+)/);
    return (m && m[1]) || '100000';
  }
  function imgUrl(id){ return IMAGE_BASE + id + EXT; }

  function render(){
    const id = idFromHash();
    img.src = imgUrl(id);
    img.alt = 'ID '+id;
    const rec = window.getLabel(id);
    label.textContent = rec ? `${rec.name || ''}${rec.dob ? ' ('+rec.dob+')' : ''}`.trim() : '';
  }
  window.addEventListener('hashchange', render);

  // ---------- Long‑press to edit ----------
  const LP_MS = 600;           // required press length
  const MOVE_TOL = 10;         // px tolerance before cancel
  let lpTimer = null;
  let startX=0, startY=0;
  function startLongPress(x,y, cancelFn){
    clearTimeout(lpTimer);
    startX=x; startY=y;
    lpTimer = setTimeout(()=>{ lpTimer=null; cancelFn(); }, LP_MS);
  }
  function cancelLongPress(){
    if (lpTimer){ clearTimeout(lpTimer); lpTimer=null; }
  }

  function doEdit(){
    const id = idFromHash();
    const current = window.getLabel(id) || {};
    const name = prompt('Name for '+id+'?', current.name || '');
    const dob  = prompt('DOB for '+id+'? (optional)', current.dob || '');
    if ((name && name.trim()) || (dob && dob.trim())) {
      window.setLabel(id, {name: name.trim(), dob: dob.trim()});
    }
  }

  // Mobile touch
  img.addEventListener('touchstart', (e)=>{
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    e.preventDefault(); // helps avoid iOS double‑tap zoom / highlight
    startLongPress(t.clientX, t.clientY, doEdit);
  }, {passive:false});

  img.addEventListener('touchmove', (e)=>{
    if (!lpTimer) return;
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - startX);
    const dy = Math.abs(t.clientY - startY);
    if (dx > MOVE_TOL || dy > MOVE_TOL) cancelLongPress();
  }, {passive:false});

  img.addEventListener('touchend', cancelLongPress, {passive:false});
  img.addEventListener('touchcancel', cancelLongPress, {passive:false});

  // Desktop mouse
  img.addEventListener('mousedown', (e)=>{
    if (e.button !== 0) return; // left button only
    startLongPress(e.clientX, e.clientY, doEdit);
  });
  window.addEventListener('mousemove', (e)=>{
    if (!lpTimer) return;
    const dx = Math.abs(e.clientX - startX);
    const dy = Math.abs(e.clientY - startY);
    if (dx > MOVE_TOL || dy > MOVE_TOL) cancelLongPress();
  });
  window.addEventListener('mouseup', cancelLongPress);

  // Right‑click context menu also triggers edit (useful on desktop/iPad with trackpad)
  img.addEventListener('contextmenu', (e)=>{ e.preventDefault(); doEdit(); });

  // initial draw
  render();
})();