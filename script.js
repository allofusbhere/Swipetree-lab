
/*! SwipeTree Lab — script.js (RC5 Long‑Press + Hint)
 * - Visible anchor renderer
 * - Device‑independent labels (Netlify GET/POST)
 * - Edge friction
 * - Pointer Events long‑press + on-screen hint
 */
(function(){
  // ---------- Config ----------
  const NETLIFY_ENDPOINT = '/.netlify/functions/labels';
  const IMAGE_BASE = 'https://allofusbhere.github.io/family-tree-images/';
  const EXT = '.jpg';
  const LP_MS = 600;    // long‑press threshold
  const MOVE_TOL = 10;  // px tolerance

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

  // On-screen hint
  const hint = document.createElement('div');
  hint.textContent = 'Press & hold to edit';
  hint.style.position = 'fixed';
  hint.style.bottom = '24px';
  hint.style.left = '50%';
  hint.style.transform = 'translateX(-50%)';
  hint.style.background = 'rgba(20,20,20,.85)';
  hint.style.color = '#fff';
  hint.style.padding = '8px 12px';
  hint.style.borderRadius = '999px';
  hint.style.fontFamily = 'system-ui, sans-serif';
  hint.style.fontSize = '14px';
  hint.style.opacity = '0';
  hint.style.transition = 'opacity .25s ease';
  document.body.appendChild(hint);
  function showHint(ms=1500){ hint.style.opacity = '1'; setTimeout(()=> hint.style.opacity = '0', ms); }
  // show once on load
  setTimeout(()=>showHint(), 400);

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

  // ---------- Pointer Events Long‑Press ----------
  let pressTimer = null;
  let sx = 0, sy = 0;
  let pressed = false;

  function startPress(x,y){
    cancelPress();
    sx=x; sy=y;
    pressed = true;
    pressTimer = setTimeout(()=>{
      pressTimer = null;
      if (pressed) doEdit();
    }, LP_MS);
  }
  function movePress(x,y){
    if (!pressed) return;
    const dx = Math.abs(x - sx);
    const dy = Math.abs(y - sy);
    if (dx > MOVE_TOL || dy > MOVE_TOL) cancelPress();
  }
  function cancelPress(){
    pressed = false;
    if (pressTimer){ clearTimeout(pressTimer); pressTimer = null; }
  }

  // Use Pointer Events (touch/mouse/pen unified)
  img.addEventListener('pointerdown', (e)=>{
    if (e.pointerType === 'mouse' && e.button !== 0) return; // left only
    img.setPointerCapture?.(e.pointerId);
    startPress(e.clientX, e.clientY);
  });
  img.addEventListener('pointermove', (e)=> movePress(e.clientX, e.clientY));
  img.addEventListener('pointerup', cancelPress);
  img.addEventListener('pointercancel', cancelPress);
  img.addEventListener('pointerleave', cancelPress);

  // Fallbacks
  img.addEventListener('contextmenu', (e)=>{ e.preventDefault(); doEdit(); });
  img.addEventListener('dblclick', (e)=>{ e.preventDefault(); doEdit(); });

  function doEdit(){
    cancelPress();
    const id = idFromHash();
    const current = window.getLabel(id) || {};
    const name = prompt('Name for '+id+'?', current.name || '');
    const dob  = prompt('DOB for '+id+'? (optional)', current.dob || '');
    if ((name && name.trim()) || (dob && dob.trim())) {
      window.setLabel(id, {name: name.trim(), dob: dob.trim()});
    }
  }

  // initial draw
  render();
})();