
/*! SwipeTree Lab — script.js (RC6 Hybrid Long‑Press)
 * - Visible anchor renderer
 * - Device‑independent labels (Netlify GET/POST)
 * - Edge friction via CSS (no JS block that could suppress long‑press)
 * - Hybrid long‑press (Pointer + Touch) with debug logs
 */
(function(){
  // ---------- Config ----------
  const NETLIFY_ENDPOINT = '/.netlify/functions/labels';
  const IMAGE_BASE = 'https://allofusbhere.github.io/family-tree-images/';
  const EXT = '.jpg';
  const LP_MS = 550;    // long‑press threshold
  const MOVE_TOL = 15;  // px tolerance

  const log = (...a)=>console.log('[SwipeTree]', ...a);
  const warn = (...a)=>console.warn('[SwipeTree]', ...a);

  // ---------- Minimal CSS injection for friction + iPad friendliness ----------
  const style = document.createElement('style');
  style.textContent = `
    html,body{height:100%;margin:0;overscroll-behavior:none;touch-action:manipulation;background:#000}
    #app{min-height:100dvh;display:flex;align-items:center;justify-content:center}
    #anchor{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;-webkit-user-drag:none;
            max-width:min(92vw,92vh);max-height:min(92vh,92vw);object-fit:contain}
    #label{color:#fff;margin-top:12px;opacity:.9;font-family:system-ui,sans-serif;text-align:center}
  `;
  document.head.appendChild(style);

  // ---------- DOM bootstrap ----------
  let app = document.getElementById('app');
  if (!app) {
    app = document.createElement('div');
    app.id = 'app';
    document.body.appendChild(app);
  }

  const wrap = document.createElement('div');
  wrap.style.textAlign = 'center';
  app.appendChild(wrap);

  const img = document.createElement('img');
  img.id = 'anchor';
  img.alt = 'anchor';
  img.draggable = false;
  wrap.appendChild(img);

  const label = document.createElement('div');
  label.id = 'label';
  wrap.appendChild(label);

  // ---------- Labels sync (Netlify + localStorage) ----------
  const LABELS_KEY = 'labels';
  const BACKUP_KEY = 'labels_backup';
  const SYNC_FLAG = '__labels_sync_inflight__';
  const POLL_MS = 30000;

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

  // ---------- Hybrid Long‑Press (Pointer + Touch) ----------
  let pressTimer = null;
  let sx = 0, sy = 0;
  let pressed = false;

  function startPress(x,y, src){
    cancelPress();
    sx=x; sy=y; pressed = true;
    log('LP start via', src);
    pressTimer = setTimeout(()=>{
      pressTimer = null;
      if (pressed) { log('LP trigger via', src); doEdit(); }
    }, LP_MS);
  }
  function movePress(x,y){
    if (!pressed) return;
    const dx = Math.abs(x - sx);
    const dy = Math.abs(y - sy);
    if (dx > MOVE_TOL || dy > MOVE_TOL) { log('LP cancel: move'); cancelPress(); }
  }
  function cancelPress(){ pressed = false; if (pressTimer){ clearTimeout(pressTimer); pressTimer=null; } }

  // Pointer path
  img.addEventListener('pointerdown', (e)=>{
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    img.setPointerCapture?.(e.pointerId);
    startPress(e.clientX, e.clientY, 'pointer');
  });
  img.addEventListener('pointermove', (e)=> movePress(e.clientX, e.clientY));
  img.addEventListener('pointerup', cancelPress);
  img.addEventListener('pointercancel', cancelPress);
  img.addEventListener('pointerleave', cancelPress);

  // Touch fallback (explicit)
  img.addEventListener('touchstart', (e)=>{
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    startPress(t.clientX, t.clientY, 'touch');
  }, {passive:true}); // passive true: don't block scrolling; CSS already disables overscroll
  img.addEventListener('touchmove', (e)=>{
    if (!pressed) return;
    const t = e.touches[0];
    movePress(t.clientX, t.clientY);
  }, {passive:true});
  img.addEventListener('touchend', cancelPress, {passive:true});
  img.addEventListener('touchcancel', cancelPress, {passive:true});

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