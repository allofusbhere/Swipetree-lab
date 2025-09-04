
// rc1e-core+cachefix: add cache busting for Safari/iOS so labels show on all devices
(function(){
  const FN = '/.netlify/functions/labels';
  const LONG_PRESS_MS = 500;
  const JITTER_PX = 12;

  function getCurrentId() {
    const m = location.hash.match(/id=([\d.]+)/);
    return m ? m[1] : '100000';
  }

  async function getLabel(id) {
    const bust = Date.now();
    const res = await fetch(`${FN}?id=${encodeURIComponent(id)}&t=${bust}`, {
      method: 'GET',
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error('GET labels failed');
    return res.json();
  }

  async function setLabel(id, name, dob) {
    const res = await fetch(FN, {
      method: 'POST',
      cache: 'no-store',
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
    // force paint
    const box = document.querySelector('#labelsBox');
    if (box) {
      box.style.willChange = 'contents';
      requestAnimationFrame(()=>{ box.style.willChange = 'auto'; });
    }
  }

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
      window.__labelCache = { id, name: data.name || '', dob: data.dob || '' };
    } catch (e) {
      console.warn(e);
    }
  }

  function removeCornerEditButton() {
    const btn = document.querySelector('#cornerEditButton');
    if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
  }

  function suppressIOSCallouts(el){
    if (!el) return;
    el.style.webkitTouchCallout = 'none';
    el.style.webkitUserSelect = 'none';
    el.style.userSelect = 'none';
    el.setAttribute('draggable','false');
    el.addEventListener('contextmenu', (e)=> e.preventDefault());
    el.addEventListener('gesturestart', (e)=> e.preventDefault());
  }

  function installLongPress(el) {
    if (!el) return;
    let timer = null, startX = 0, startY = 0;

    const start = (x, y) => {
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
        cancel();
      }
    }, {passive: true});
    el.addEventListener('touchend', cancel, {passive: true});
    el.addEventListener('touchcancel', cancel, {passive: true});

    el.addEventListener('pointerdown', (e) => start(e.clientX, e.clientY));
    el.addEventListener('pointermove', (e) => {
      if (Math.abs(e.clientX - startX) > JITTER_PX || Math.abs(e.clientY - startY) > JITTER_PX) {
        cancel();
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

  window.addEventListener('DOMContentLoaded', async () => {
    removeCornerEditButton();
    const anchor = document.querySelector('#anchorImage');
    suppressIOSCallouts(anchor);
    installLongPress(anchor);
    await wireOverlayButtons();
    await hydrateFromServer();
  });
})();
