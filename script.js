// SwipeTree — SoftEdit rc2 (zero-edit Netlify detection)
(() => {
  const CFG = (window.SWIPE_CONFIG || {});
  const IS_NETLIFY_HOST = /\.netlify\.app$/.test(location.hostname);
  const NETLIFY_BASE = IS_NETLIFY_HOST ? "" : (CFG.NETLIFY_BASE || "");

  const $ = sel => document.querySelector(sel);
  const stage = $('#stage'), overlayRoot = $('#overlay-root');
  const startInput = $('#startId'), startBtn = $('#startBtn'), backBtn = $('#backBtn');
  const editModal = $('#editModal'), editForm = $('#editForm');
  const editName = $('#editName'), editDOB = $('#editDOB');

  const LONG_PRESS_MS = 500, SWIPE_THRESHOLD = 40;
  const GRID_TYPES = { LEFT:"siblings", RIGHT:"spouse", UP:"parents", DOWN:"children" };

  const historyStack = [];
  let anchorId = null, longPressTimer = null, pointerDownAt = null, editingEnabled = true;

  function netlifyUrl(path){ return NETLIFY_BASE ? `${NETLIFY_BASE}${path}` : path; }

  async function saveLabel(id, data) {
    // If NETLIFY_BASE is set or we’re on Netlify, try server first
    if (NETLIFY_BASE !== "" || IS_NETLIFY_HOST) {
      try {
        const res = await fetch(netlifyUrl('/.netlify/functions/labels'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...data })
        });
        if (!res.ok) throw new Error('Netlify save failed');
        // fall-through to also update local cache for fast reads
      } catch(e){ /* ignore, fallback below */ }
    }
    const key = 'labels_v1';
    const db = JSON.parse(localStorage.getItem(key) || '{}');
    db[id] = { ...(db[id] || {}), ...data };
    localStorage.setItem(key, JSON.stringify(db));
  }

  function loadLabel(id) {
    const db = JSON.parse(localStorage.getItem('labels_v1') || '{}');
    return db[id] || { name: '', dob: '' };
  }

  function imgSrcFor(id){ return `${id}.jpg`; }

  function renderAnchor(id){
    anchorId = id;
    stage.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'anchor'; card.setAttribute('role','group');
    card.setAttribute('aria-label', `Person ${id}`); card.tabIndex = 0;

    const img = document.createElement('img');
    img.alt = `Photo ${id}`; img.src = imgSrcFor(id);
    img.onerror = () => { img.src = 'placeholder.jpg'; };

    const label = document.createElement('div'); label.className = 'label';
    const { name, dob } = loadLabel(id);
    label.innerHTML = `<div class="name">${name || id}</div><div class="dob">${dob || ''}</div>`;

    card.appendChild(img); card.appendChild(label); stage.appendChild(card);
    attachGestures(card);
  }

  function attachGestures(el){
    el.addEventListener('pointerdown', onPointerDown, { passive:false });
    el.addEventListener('pointermove', onPointerMove, { passive:false });
    el.addEventListener('pointerup', onPointerUp, { passive:false });
    el.addEventListener('pointercancel', onPointerCancel, { passive:false });
    el.addEventListener('contextmenu', e => e.preventDefault());
  }
  function clearLong(){ if(longPressTimer){ clearTimeout(longPressTimer); longPressTimer=null; } }
  function onPointerDown(e){
    if (document.body.classList.contains('grid-open')) return;
    pointerDownAt = { x:e.clientX, y:e.clientY, time:Date.now() };
    clearLong();
    longPressTimer = setTimeout(() => {
      longPressTimer=null;
      if(!pointerDownAt) return;
      const moved = Math.hypot(e.clientX-pointerDownAt.x, e.clientY-pointerDownAt.y);
      if(moved<6 && editingEnabled) openEditor(anchorId);
    }, LONG_PRESS_MS);
  }
  function onPointerMove(e){
    if(!pointerDownAt) return;
    const dx=e.clientX-pointerDownAt.x, dy=e.clientY-pointerDownAt.y;
    if(Math.abs(dx)>8 || Math.abs(dy)>8) clearLong();
  }
  function onPointerUp(e){
    const start = pointerDownAt; pointerDownAt=null;
    if(!start) return;
    if(!longPressTimer) return; // long-press fired or was canceled for movement
    clearLong();
    const dx=e.clientX-start.x, dy=e.clientY-start.y, ax=Math.abs(dx), ay=Math.abs(dy);
    if(Math.max(ax,ay) < SWIPE_THRESHOLD) return;
    const dir = ax>ay ? (dx>0?'RIGHT':'LEFT') : (dy>0?'DOWN':'UP');
    openGrid(GRID_TYPES[dir]);
  }
  function onPointerCancel(){ clearLong(); pointerDownAt=null; }

  function openEditor(id){
    const { name, dob } = loadLabel(id);
    editName.value = name || ''; editDOB.value = dob || '';
    editModal.showModal(); document.body.style.overflow='hidden';
  }
  function closeEditor(){ if(editModal.open) editModal.close(); document.body.style.overflow=''; }
  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name=(editName.value||'').trim(), dob=(editDOB.value||'').trim();
    await saveLabel(anchorId, { name, dob });
    const label = stage.querySelector('.anchor .label');
    if(label){ label.innerHTML = `<div class="name">${name||anchorId}</div><div class="dob">${dob||''}</div>`; }
    closeEditor();
  });
  document.getElementById('cancelEdit').addEventListener('click', closeEditor);
  editModal.addEventListener('close', () => { document.body.style.overflow=''; });

  function openGrid(kind){
    const ids = mockIdsFor(kind, anchorId);
    const grid = document.createElement('div'); grid.className='gridOverlay';
    grid.setAttribute('role','dialog'); grid.setAttribute('aria-label', `${kind} of ${anchorId}`);
    ids.forEach(id => {
      const item=document.createElement('div'); item.className='gridItem';
      const img=document.createElement('img'); img.alt=`${id}`; img.src=imgSrcFor(id);
      img.onerror=()=>{ img.src='placeholder.jpg'; };
      const meta=document.createElement('div'); meta.className='meta';
      const { name } = loadLabel(id);
      meta.innerHTML = `<div class="name">${name||id}</div><div class="id">${id}</div>`;
      item.appendChild(img); item.appendChild(meta);
      item.addEventListener('click', () => { historyStack.push(anchorId); renderAnchor(id); closeGrid(); });
      grid.appendChild(item);
    });
    overlayRoot.innerHTML=''; overlayRoot.appendChild(grid);
    document.body.classList.add('grid-open');
    const onKey=(e)=>{ if(e.key==='Escape'||e.key==='Backspace') closeGrid(); };
    window.addEventListener('keydown', onKey, { once:true });
  }
  function closeGrid(){ overlayRoot.innerHTML=''; document.body.classList.remove('grid-open'); }
  function mockIdsFor(kind, id){
    const base = parseInt(String(id).replace(/\D/g,''),10)||0;
    if(kind==='children') return [base+1000, base+2000, base+3000].map(String);
    if(kind==='siblings') return [base-3000, base-2000, base-1000, base+1000, base+2000].filter(x=>parseInt(x,10)>0).map(String);
    if(kind==='parents')  return [base - (base%10000) || base+10000].map(String);
    if(kind==='spouse')   return [`${id}.1`];
    return [];
  }

  backBtn.addEventListener('click', () => {
    if (document.body.classList.contains('grid-open')) return void closeGrid();
    const prev = historyStack.pop(); if(prev) renderAnchor(prev);
  });

  function bootFromHash(){ const m=location.hash.match(/id=(\d+(?:\.\d+)?)/); return m?m[1]:null; }
  startBtn.addEventListener('click', () => {
    const id=(startInput.value||'').trim();
    if(id){ historyStack.length=0; renderAnchor(id); location.hash=`#id=${id}`; }
  });
  window.addEventListener('hashchange', () => {
    const id = bootFromHash(); if(id){ historyStack.length=0; renderAnchor(id); }
  });

  const start = bootFromHash() || '100000';
  startInput.value = start; renderAnchor(start);
})();
