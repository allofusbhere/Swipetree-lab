(() => {
  'use strict';

  // ---- Config (Lab) ----
  const CONFIG = {
    IMAGE_BASE: 'https://raw.githubusercontent.com/allofusbhere/family-tree-images/main/', // flat folder, e.g., 100000.jpg
    LABELS_ENDPOINT: '/.netlify/functions/labels',
    LONG_PRESS_MS: 500,
    JITTER_PX: 12,
  };

  const $ = sel => document.querySelector(sel);

  const state = {
    id: null,
    pressTimer: null,
    startXY: null,
    labels: { name: '', dob: '' },
  };

  function parseHashId() {
    const hash = window.location.hash || '';
    const m = /[#&]id=([0-9.]+)/.exec(hash);
    return m ? m[1] : null;
  }

  function setStatus(msg) {
    const el = $('#status');
    if (el) el.textContent = msg || '';
  }

  function imageUrlFromId(id) {
    // Accepts "140000" or "140000.1"
    const fname = `${id}.jpg`;
    return CONFIG.IMAGE_BASE + encodeURIComponent(fname);
  }

  async function fetchLabels(id) {
    try {
      const resp = await fetch(`${CONFIG.LABELS_ENDPOINT}?id=${encodeURIComponent(id)}`, { method: 'GET' });
      if (!resp.ok) throw new Error('labels GET failed');
      const data = await resp.json();
      return { name: data?.name || '', dob: data?.dob || '' };
    } catch (e) {
      console.warn('fetchLabels error:', e);
      return { name: '', dob: '' };
    }
  }

  async function saveLabels(id, labels) {
    try {
      const resp = await fetch(CONFIG.LABELS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...labels }),
      });
      if (!resp.ok) throw new Error('labels POST failed');
      return true;
    } catch (e) {
      console.warn('saveLabels error:', e);
      return false;
    }
  }

  async function loadAnchor(id) {
    state.id = id;
    const img = $('#anchorImage');
    img.src = imageUrlFromId(id);
    img.alt = `ID ${id}`;
    setStatus(`ID ${id}`);

    // Load labels from server on each anchor load
    state.labels = await fetchLabels(id);
    renderLabels();
  }

  function renderLabels() {
    $('#nameLabel').textContent = state.labels.name || '';
    $('#dobLabel').textContent = state.labels.dob || '';
  }

  // ---- Long‑press detection ----
  function withinJitter(a, b) {
    return Math.abs(a.x - b.x) <= CONFIG.JITTER_PX && Math.abs(a.y - b.y) <= CONFIG.JITTER_PX;
  }

  function startPress(e) {
    const point = ('touches' in e && e.touches.length > 0)
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : { x: e.clientX, y: e.clientY };
    state.startXY = point;

    clearTimeout(state.pressTimer);
    state.pressTimer = setTimeout(() => {
      // Only open if we haven't moved much
      const current = state.startXY;
      if (current) openSoftEdit();
    }, CONFIG.LONG_PRESS_MS);
  }

  function movePress(e) {
    if (!state.startXY) return;
    const point = ('touches' in e && e.touches.length > 0)
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : { x: e.clientX, y: e.clientY };
    if (!withinJitter(state.startXY, point)) {
      clearTimeout(state.pressTimer);
    }
  }

  function endPress() {
    clearTimeout(state.pressTimer);
    state.startXY = null;
  }

  // ---- SoftEdit modal ----
  function openSoftEdit() {
    const dlg = $('#softEdit');
    $('#nameInput').value = state.labels.name || '';
    $('#dobInput').value = state.labels.dob || '';
    dlg.showModal();
  }

  function closeSoftEdit() {
    $('#softEdit').close();
  }

  async function onSoftEditSubmit(val) {
    if (val !== 'save') return closeSoftEdit();
    const name = $('#nameInput').value.trim();
    const dob = $('#dobInput').value.trim();
    const payload = { name, dob };
    const ok = await saveLabels(state.id, payload);
    if (ok) {
      state.labels = payload;
      renderLabels();
      setStatus('Saved');
    } else {
      setStatus('Save failed');
    }
    closeSoftEdit();
  }

  function bindUI() {
    const img = $('#anchorImage');
    // Touch/pointer/mouse long‑press
    img.addEventListener('touchstart', startPress, { passive: true });
    img.addEventListener('touchmove', movePress, { passive: true });
    img.addEventListener('touchend', endPress, { passive: true });
    img.addEventListener('touchcancel', endPress, { passive: true });

    img.addEventListener('pointerdown', startPress);
    img.addEventListener('pointermove', movePress);
    img.addEventListener('pointerup', endPress);
    img.addEventListener('pointercancel', endPress);
    img.addEventListener('pointerleave', endPress);

    img.addEventListener('mousedown', startPress);
    img.addEventListener('mousemove', movePress);
    img.addEventListener('mouseup', endPress);
    img.addEventListener('mouseleave', endPress);

    // Prevent image dragging/ghost image
    img.addEventListener('dragstart', e => e.preventDefault());

    $('#softEdit').addEventListener('close', () => {
      // no-op
    });
    $('#softEditForm').addEventListener('submit', (e) => {
      e.preventDefault();
    });
    $('#saveBtn').addEventListener('click', () => onSoftEditSubmit('save'));
    $('#cancelBtn').addEventListener('click', () => onSoftEditSubmit('cancel'));

    $('#startBtn').addEventListener('click', () => {
      const id = ($('#startId').value || '').trim();
      if (id) {
        history.replaceState({}, '', `#id=${encodeURIComponent(id)}`);
        loadAnchor(id);
      }
    });
  }

  function initFromHashOrInput() {
    const id = parseHashId();
    if (id) {
      $('#startId').value = id;
      loadAnchor(id);
    }
  }

  // ---- Boot ----
  document.addEventListener('DOMContentLoaded', () => {
    bindUI();
    initFromHashOrInput();
  });
})();