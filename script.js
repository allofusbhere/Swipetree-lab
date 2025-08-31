// SwipeTree — SoftEdit rc1
// Focus: long‑press editor that plays nicely with swipe gestures.
// Assumes existing swipe logic; here we include lightweight swipe + history so this file runs standalone.
// Integrate portions into your main app if you already have working swipe + grids.

(() => {
  const $ = sel => document.querySelector(sel);
  const stage = $('#stage');
  const overlayRoot = $('#overlay-root');
  const startInput = $('#startId');
  const startBtn = $('#startBtn');
  const backBtn = $('#backBtn');
  const editModal = $('#editModal');
  const editForm = $('#editForm');
  const editName = $('#editName');
  const editDOB = $('#editDOB');

  // ------- Config -------
  const LONG_PRESS_MS = 500;  // long‑press duration
  const SWIPE_THRESHOLD = 40; // px
  const GRID_TYPES = { LEFT:"siblings", RIGHT:"spouse", UP:"parents", DOWN:"children" };

  // History stack for Back behavior
  const historyStack = [];
  let anchorId = null;
  let longPressTimer = null;
  let pointerDownAt = null;
  let editingEnabled = true;

  // --- Label store (Netlify + localStorage fallback) ---
  async function saveLabel(id, data) {
    // Try Netlify function, fallback to localStorage
    try {
      const res = await fetch('/.netlify/functions/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...data })
      });
      if (!res.ok) throw new Error('Netlify save failed');
    } catch (e) {
      // local fallback
      const key = 'labels_v1';
      const db = JSON.parse(localStorage.getItem(key) || '{}');
      db[id] = { ...(db[id] || {}), ...data };
      localStorage.setItem(key, JSON.stringify(db));
    }
  }

  function loadLabel(id) {
    // From Netlify would be fetched server-side; here we read from localStorage
    const db = JSON.parse(localStorage.getItem('labels_v1') || '{}');
    return db[id] || { name: '', dob: '' };
  }

  // --- Minimal image src resolver ---
  function imgSrcFor(id) {
    // Keep your existing resolver. This one assumes images live next to index.html as {id}.jpg.
    return `${id}.jpg`;
  }

  // --- Render anchor ---
  function renderAnchor(id) {
    anchorId = id;
    stage.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'anchor';
    card.setAttribute('role','group');
    card.setAttribute('aria-label', `Person ${id}`);
    card.tabIndex = 0;

    const img = document.createElement('img');
    img.alt = `Photo ${id}`;
    img.src = imgSrcFor(id);
    img.onerror = () => { img.src = 'placeholder.jpg'; };

    const label = document.createElement('div');
    label.className = 'label';
    const { name, dob } = loadLabel(id);
    label.innerHTML = `<div class="name">${name || id}</div><div class="dob">${dob ? dob : ''}</div>`;

    card.appendChild(img);
    card.appendChild(label);
    stage.appendChild(card);

    // Attach gesture + long‑press to the anchor itself (the big photo)
    attachGestures(card);
  }

  // --- Gesture + long‑press handling ---
  function attachGestures(el) {
    // Use pointer events; ensure touch-action is none on .stage to prevent page scroll
    el.addEventListener('pointerdown', onPointerDown, { passive: false });
    el.addEventListener('pointermove', onPointerMove, { passive: false });
    el.addEventListener('pointerup', onPointerUp, { passive: false });
    el.addEventListener('pointercancel', onPointerCancel, { passive: false });
    el.addEventListener('contextmenu', e => e.preventDefault()); // iOS long‑press context menu
  }

  function clearLongPressTimer() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function onPointerDown(e) {
    if (document.body.classList.contains('grid-open')) return; // disable while grid open
    pointerDownAt = { x: e.clientX, y: e.clientY, time: Date.now() };
    // Schedule long‑press
    clearLongPressTimer();
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      // If finger hasn't moved much, trigger edit
      if (!pointerDownAt) return;
      const moved = Math.hypot((e.clientX - pointerDownAt.x), (e.clientY - pointerDownAt.y));
      if (moved < 6 && editingEnabled) openEditor(anchorId);
    }, LONG_PRESS_MS);
  }

  function onPointerMove(e) {
    if (!pointerDownAt) return;
    // If we move significantly, cancel long‑press to prefer swipe
    const dx = e.clientX - pointerDownAt.x;
    const dy = e.clientY - pointerDownAt.y;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      clearLongPressTimer();
    }
  }

  function onPointerUp(e) {
    // If long‑press already fired, do nothing
    const start = pointerDownAt;
    pointerDownAt = null;
    if (!start) return;

    // If we didn't long‑press, consider swipe
    if (!longPressTimer) return; // long‑press already handled OR cancelled due to movement
    clearLongPressTimer();

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const ax = Math.abs(dx), ay = Math.abs(dy);

    if (Math.max(ax, ay) < SWIPE_THRESHOLD) {
      // Tap: no-op for now
      return;
    }
    // Determine direction
    let dir = null;
    if (ax > ay) dir = dx > 0 ? 'RIGHT' : 'LEFT';
    else        dir = dy > 0 ? 'DOWN'  : 'UP';

    openGrid(GRID_TYPES[dir]);
  }

  function onPointerCancel() {
    clearLongPressTimer();
    pointerDownAt = null;
  }

  // --- SoftEdit modal ---
  function openEditor(id) {
    const { name, dob } = loadLabel(id);
    editName.value = name || '';
    editDOB.value = dob || '';
    editModal.showModal();
    // Prevent accidental backdrop scroll on iOS
    document.body.style.overflow = 'hidden';
  }

  function closeEditor() {
    if (editModal.open) editModal.close();
    document.body.style.overflow = '';
  }

  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = (editName.value || '').trim();
    const dob = (editDOB.value || '').trim();
    await saveLabel(anchorId, { name, dob });
    // Update label on anchor immediately
    const label = stage.querySelector('.anchor .label');
    if (label) {
      label.innerHTML = `<div class="name">${name || anchorId}</div><div class="dob">${dob ? dob : ''}</div>`;
    }
    closeEditor();
  });

  $('#cancelEdit').addEventListener('click', () => closeEditor());
  editModal.addEventListener('close', () => { document.body.style.overflow=''; });

  // --- Overlay grid stubs (replace with your real calculators) ---
  function openGrid(kind) {
    // In your real app, compute IDs from numeric rules.
    // Here we generate a tiny fake list just to demonstrate UI flow.
    const ids = mockIdsFor(kind, anchorId);
    const grid = document.createElement('div');
    grid.className = 'gridOverlay';
    grid.setAttribute('role','dialog');
    grid.setAttribute('aria-label', `${kind} of ${anchorId}`);

    ids.forEach(id => {
      const item = document.createElement('div');
      item.className = 'gridItem';
      const img = document.createElement('img');
      img.alt = `${id}`;
      img.src = imgSrcFor(id);
      img.onerror = () => { img.src = 'placeholder.jpg'; };
      const meta = document.createElement('div');
      meta.className = 'meta';
      const { name } = loadLabel(id);
      meta.innerHTML = `<div class="name">${name || id}</div><div class="id">${id}</div>`;
      item.appendChild(img);
      item.appendChild(meta);
      item.addEventListener('click', () => {
        // Navigate
        historyStack.push(anchorId);
        renderAnchor(id);
        closeGrid();
      });
      grid.appendChild(item);
    });

    overlayRoot.innerHTML = '';
    overlayRoot.appendChild(grid);
    document.body.classList.add('grid-open');

    // Close grid by pressing Back or Escape
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'Backspace') {
        closeGrid();
      }
    };
    window.addEventListener('keydown', onKey, { once:true });
  }

  function closeGrid() {
    overlayRoot.innerHTML = '';
    document.body.classList.remove('grid-open');
  }

  function mockIdsFor(kind, id) {
    const base = parseInt(String(id).replace(/\D/g,''), 10) || 0;
    if (kind === 'children')   return [base+1000, base+2000, base+3000].map(String);
    if (kind === 'siblings')   return [base-3000, base-2000, base-1000, base+1000, base+2000].filter(x => parseInt(x,10)>0).map(String);
    if (kind === 'parents')    return [base - (base%10000) || base+10000].map(String);
    if (kind === 'spouse')     return [`${id}.1`];
    return [];
  }

  // --- Back button ---
  backBtn.addEventListener('click', () => {
    if (document.body.classList.contains('grid-open')) {
      closeGrid();
      return;
    }
    const prev = historyStack.pop();
    if (prev) renderAnchor(prev);
  });

  // --- Boot ---
  function bootFromHash() {
    const m = location.hash.match(/id=(\d+(?:\.\d+)?)/);
    return m ? m[1] : null;
  }

  startBtn.addEventListener('click', () => {
    const id = (startInput.value || '').trim();
    if (id) {
      historyStack.length = 0;
      renderAnchor(id);
      location.hash = `#id=${id}`;
    }
  });

  window.addEventListener('hashchange', () => {
    const id = bootFromHash();
    if (id) {
      historyStack.length = 0;
      renderAnchor(id);
    }
  });

  // initial
  const start = bootFromHash() || '100000';
  startInput.value = start;
  renderAnchor(start);
})();
