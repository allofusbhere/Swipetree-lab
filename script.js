
/*!
 * SwipeTree Lab — Device‑Independent Labels (RC1)
 * Purpose: keep labels (name/DOB) in sync across devices via Netlify.
 * Non‑invasive: works with existing code that reads/writes localStorage['labels'].
 */
(function () {
  const ENDPOINT = '/.netlify/functions/labels';
  const LABELS_KEY = 'labels';
  const BACKUP_KEY = 'labels_backup';
  const SYNC_FLAG = '__labels_sync_inflight__';
  const POLL_INTERVAL = 30 * 1000; // refresh periodically in lab

  const log = (...a) => console.log('[SwipeTree Labels]', ...a);
  const warn = (...a) => console.warn('[SwipeTree Labels]', ...a);

  // Read/Write helpers for localStorage JSON under LABELS_KEY
  function readLocal() {
    try {
      const raw = localStorage.getItem(LABELS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      warn('Failed to parse local labels, resetting.', e);
      return {};
    }
  }
  function writeLocal(obj) {
    try {
      localStorage.setItem(LABELS_KEY, JSON.stringify(obj || {}));
      localStorage.setItem(BACKUP_KEY, JSON.stringify({ at: Date.now(), data: obj || {} }));
    } catch (e) {
      warn('Failed to write local labels.', e);
    }
  }

  // Fetch labels from Netlify
  async function fetchRemote() {
    try {
      const r = await fetch(ENDPOINT, { method: 'GET', headers: { 'accept': 'application/json' } });
      if (!r.ok) throw new Error('GET ' + ENDPOINT + ' ' + r.status);
      const data = await r.json();
      // Support either {labels:{...}} or direct {...}
      return data && (data.labels || data) || {};
    } catch (e) {
      warn('Remote fetch failed; using local cache.', e);
      return null; // signal failure
    }
  }

  // Push full labels map to Netlify
  async function pushRemote(fullMap) {
    try {
      const r = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op: 'upsert_all', labels: fullMap || {} })
      });
      if (!r.ok) throw new Error('POST ' + ENDPOINT + ' ' + r.status);
      return true;
    } catch (e) {
      warn('Remote push failed; changes remain local only.', e);
      return false;
    }
  }

  // Merge shallow objects (by id)
  function mergeLabels(base, incoming) {
    const out = { ...(base || {}) };
    for (const [id, rec] of Object.entries(incoming || {})) {
      if (!out[id]) out[id] = rec;
      else out[id] = { ...(out[id] || {}), ...(rec || {}) };
    }
    return out;
  }

  // Intercept localStorage.setItem for LABELS_KEY to mirror to Netlify
  const origSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (key, value) {
    origSetItem(key, value);
    if (key !== LABELS_KEY) return;
    try {
      const current = JSON.parse(value || '{}');
      // Debounce/microtask to avoid recursive storms if caller sets many times
      queueMicrotask(() => {
        if (window[SYNC_FLAG]) return;
        window[SYNC_FLAG] = true;
        pushRemote(current).finally(() => { window[SYNC_FLAG] = false; });
      });
    } catch (_) {
      /* ignore */
    }
  };

  // Public helper to set single label (id -> {name?, dob?}) compatible with existing apps
  window.setLabel = function (id, patch) {
    if (!id) return;
    const local = readLocal();
    local[id] = { ...(local[id] || {}), ...(patch || {}) };
    writeLocal(local); // triggers our overridden setItem & remote push
    return local[id];
  };
  window.getLabel = function (id) {
    const local = readLocal();
    return local[id] || null;
  };
  window.getAllLabels = function () {
    return readLocal();
  };

  // Initial Sync: fetch remote, merge into local, then push merged back (resolves drift)
  (async function initSync() {
    log('Initializing device‑independent labels sync…');
    const local = readLocal();
    const remote = await fetchRemote();
    if (remote) {
      const merged = mergeLabels(remote, local); // remote base, keep any local edits
      writeLocal(merged);
      await pushRemote(merged);
      log('Labels synced from Netlify; entries:', Object.keys(merged).length);
    } else {
      // remote unavailable; keep local only
      writeLocal(local);
      log('Working offline with local labels; will retry later.');
    }
  })();

  // Periodic refresh in lab so multiple devices converge without reload
  setInterval(async () => {
    const remote = await fetchRemote();
    if (remote) {
      const merged = mergeLabels(remote, readLocal());
      writeLocal(merged);
      log('Periodic refresh merged; entries:', Object.keys(merged).length);
    }
  }, POLL_INTERVAL);
})();
