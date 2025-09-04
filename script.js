// Lab Patch r1 — Labels device-independent (prefill + save) and no corner edit button
// Assumptions:
// - There is an element with id="anchorImage" (the main person image)
// - There is an element with id="labelName" and id="labelDob" to display text under the image
// - Long-press opens an overlay with inputs #nameInput and #dobInput and buttons #saveLabelBtn and #cancelLabelBtn
// - Current person's ID is in the URL hash as #id=NNNNNN or accessible via getCurrentId()
//
// If your DOM ids differ, adjust the querySelectors below. This is a drop-in pattern for the Lab build.

(function(){
  const FN = '/.netlify/functions/labels'; // Netlify function endpoint
  const LONG_PRESS_MS = 500;
  const JITTER_PX = 12;

  // ---- utils ----
  function getCurrentId() {
    // From URL like ...#id=140000
    const m = location.hash.match(/id=([\d.]+)/);
    return m ? m[1] : '100000';
  }

  async function getLabel(id) {
    const res = await fetch(`${FN}?id=${encodeURIComponent(id)}`, { method: 'GET' });
    if (!res.ok) throw new Error('GET labels failed');
    return res.json(); // {id,name,dob}
  }

  async function setLabel(id, name, dob) {
    const res = await fetch(FN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, dob })
    });
    if (!res.ok) throw new Error('POST labels failed');
    return res.json();
  }

  function setVisibleText(name, dob) {
    const nameEl = document.querySelector('#labelName');
    const dobEl = document.querySelector('#labelDob');
    if (nameEl) nameEl.textContent = name || '';
    if (dobEl) dobEl.textContent = dob || '';
  }

  // ---- overlay wiring ----
  function openOverlayPrefilled(name, dob) {
    const overlay = document.querySelector('#editOverlay');
    const nameInput = document.querySelector('#nameInput');
    const dobInput = document.querySelector('#dobInput');
    if (!overlay || !nameInput || !dobInput) return;

    nameInput.value = name || '';
    dobInput.value = dob || '';
    overlay.style.display = 'flex';
  }

  function closeOverlay() {
    const overlay = document.querySelector('#editOverlay');
    if (overlay) overlay.style.display = 'none';
  }

  async function hydrateFromServer() {
    try {
      const id = getCurrentId();
      const data = await getLabel(id);
      setVisibleText(data.name, data.dob);
      // Keep latest in memory for prefill
      window.__labelCache = { id, name: data.name || '', dob: data.dob || '' };
    } catch (e) {
      console.warn(e);
    }
  }

  function removeCornerEditButton() {
    const btn = document.querySelector('#cornerEditButton');
    if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
  }

  // ---- long-press detection ----
  function installLongPress(el) {
    if (!el) return;
    let timer = null, startX = 0, startY = 0, moved = false;

    const start = (x, y) => {
      moved = false;
      startX = x; startY = y;
      timer = setTimeout(() => {
        const cache = window.__labelCache || {name:'', dob:''};
        openOverlayPrefilled(cache.name, cache.dob);
      }, LONG_PRESS_MS);
    };
    const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };

    el.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      start(t.clientX, t.clientY);
    }, {passive: true});
    el.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      if (Math.abs(t.clientX - startX) > JITTER_PX || Math.abs(t.clientY - startY) > JITTER_PX) {
        moved = true; cancel();
      }
    }, {passive: true});
    el.addEventListener('touchend', cancel, {passive: true});
    el.addEventListener('touchcancel', cancel, {passive: true});

    // Pointer/mouse fallback
    el.addEventListener('pointerdown', (e) => start(e.clientX, e.clientY));
    el.addEventListener('pointermove', (e) => {
      if (Math.abs(e.clientX - startX) > JITTER_PX || Math.abs(e.clientY - startY) > JITTER_PX) {
        moved = true; cancel();
      }
    });
    el.addEventListener('pointerup', cancel);
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('mouseleave', cancel);
  }

  async function wireOverlayButtons() {
    const saveBtn = document.querySelector('#saveLabelBtn');
    const cancelBtn = document.querySelector('#cancelLabelBtn');
    const nameInput = document.querySelector('#nameInput');
    const dobInput = document.querySelector('#dobInput');

    if (cancelBtn) cancelBtn.addEventListener('click', closeOverlay);

    if (saveBtn && nameInput && dobInput) {
      saveBtn.addEventListener('click', async () => {
        try {
          const id = getCurrentId();
          const name = nameInput.value.trim();
          const dob  = dobInput.value.trim();
          await setLabel(id, name, dob);
          // Update UI and cache
          setVisibleText(name, dob);
          window.__labelCache = { id, name, dob };
          closeOverlay();
        } catch (e) {
          alert('Saving failed. Please try again.');
          console.error(e);
        }
      });
    }
  }

  // ---- init ----
  window.addEventListener('DOMContentLoaded', async () => {
    removeCornerEditButton();
    const anchor = document.querySelector('#anchorImage');
    installLongPress(anchor);
    await wireOverlayButtons();
    await hydrateFromServer();
  });

})();

// --- rc1e inline (iOS no-callout) ---
// rc1e: Suppress iOS share/callout on long‑press; keep SoftEdit long‑press working
(function(){
  function suppressIOSCallouts(el){
    if (!el) return;
    // CSS-style flags via JS
    el.style.webkitTouchCallout = 'none';
    el.style.webkitUserSelect = 'none';
    el.style.userSelect = 'none';
    el.setAttribute('draggable','false');
    // Block context menu / hold-to-save
    el.addEventListener('contextmenu', (e)=> e.preventDefault());
    // Some Safari gestures
    el.addEventListener('gesturestart', (e)=> e.preventDefault());
  }
  // Wait for DOM then patch anchor
  window.addEventListener('DOMContentLoaded', () => {
    const anchor = document.querySelector('#anchorImage');
    suppressIOSCallouts(anchor);
  });
})();
