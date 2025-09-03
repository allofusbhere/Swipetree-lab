
/*
  SwipeTree Lab (rc1e) — long-press test & robust init
  Changes vs rc1d:
   - Set onerror BEFORE assigning .src to ensure placeholder fallback works on 404.
   - Multi-base image resolution: tries window.SWIPETREE_IMG_BASE (if set),
     then './', then '/images/', then GitHub jsDelivr fallback if window.SWIPETREE_IMG_FALLBACK is set.
*/

(function () {
  const JITTER_PX = 12;
  const HOLD_MS = 500;
  const RETRY_MS = 120;
  const RETRY_MAX = 20;
  const LABELS_ENDPOINT = "/.netlify/functions/labels";

  // ---------- URL helpers ----------
  function getIdFromUrl() {
    const hash = (location.hash || "").replace(/^#/, "");
    const h = new URLSearchParams(hash);
    if (h.has("id")) return h.get("id");
    const q = new URLSearchParams(location.search);
    if (q.has("id")) return q.get("id");
    return null;
  }

  function normalizeHash() {
    const q = new URLSearchParams(location.search);
    if (q.has("id") && !location.hash.includes("id=")) {
      const id = q.get("id");
      const u = new URL(location.href);
      u.hash = `id=${id}`;
      history.replaceState(null, "", u.toString());
    }
  }

  // ---------- DOM helpers ----------
  function ensureAnchorEl() {
    let el = document.getElementById("anchor");
    if (!el) {
      el = document.createElement("img");
      el.id = "anchor";
      el.alt = "anchor";
      el.style.display = "block";
      el.style.maxWidth = "90vw";
      el.style.maxHeight = "90vh";
      el.style.objectFit = "contain";
      el.style.margin = "5vh auto";
      document.body.appendChild(el);
    }
    return el;
  }

  function buildCandidateUrls(id) {
    const filename = `${id}.jpg`;
    const bases = [];

    if (window.SWIPETREE_IMG_BASE) {
      const b = String(window.SWIPETREE_IMG_BASE).replace(/\/+$/,"");
      bases.push(b);
    }
    bases.push("");          // ./
    bases.push("/images");   // optional images subdir

    // Optional explicit fallback (e.g., jsDelivr CDN) set by config.js:
    if (window.SWIPETREE_IMG_FALLBACK) {
      const f = String(window.SWIPETREE_IMG_FALLBACK).replace(/\/+$/,"");
      bases.push(f);
    }

    return bases.map(b => b ? `${b}/${filename}` : filename);
  }

  async function tryImage(el, urls, idx = 0) {
    return new Promise(resolve => {
      if (idx >= urls.length) {
        el.src = "placeholder.jpg";
        return resolve(false);
      }
      const url = urls[idx];
      el.onerror = () => {
        // try next
        tryImage(el, urls, idx + 1).then(resolve);
      };
      el.onload = () => resolve(true);
      el.src = url; // onerror already set before assigning src
    });
  }

  // ---------- Labels ----------
  async function getLabel(id) {
    try {
      const res = await fetch(`${LABELS_ENDPOINT}?id=${encodeURIComponent(id)}`, { method: "GET" });
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      return data || null;
    } catch (_) {
      return null;
    }
  }

  async function saveLabel(id, payload) {
    try {
      const res = await fetch(LABELS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...payload })
      });
      return res.ok;
    } catch (_) {
      return false;
    }
  }

  function showLabel(el, text) {
    if (!el) return;
    el.setAttribute("title", text || "");
  }

  // ---------- Long-press ----------
  function attachLongPress(el, getCurrentId) {
    let downAt = 0, startX = 0, startY = 0, timer = null;

    function start(x, y) {
      downAt = Date.now();
      startX = x; startY = y;
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const id = getCurrentId();
        if (!id) return;
        const current = await getLabel(id);
        const currentName = current && current.name ? current.name : "";
        const currentDob  = current && current.dob  ? current.dob  : "";
        const name = prompt(`Edit Name for ${id}:`, currentName || "");
        if (name === null) return;
        const dob = prompt(`Edit DOB for ${id}:`, currentDob || "");
        if (dob === null) return;
        const ok = await saveLabel(id, { name, dob });
        if (ok) showLabel(el, `${name}${dob ? " • " + dob : ""}`);
        else alert("Save failed. Please try again.");
      }, HOLD_MS);
    }
    function move(x, y) {
      if (!downAt) return;
      const dx = Math.abs(x - startX);
      const dy = Math.abs(y - startY);
      if (dx > JITTER_PX || dy > JITTER_PX) clearTimeout(timer);
    }
    function end() { clearTimeout(timer); downAt = 0; }

    el.addEventListener("pointerdown", e => { el.setPointerCapture?.(e.pointerId); start(e.clientX, e.clientY); });
    el.addEventListener("pointermove", e => move(e.clientX, e.clientY));
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);

    el.addEventListener("touchstart", e => { const t=e.changedTouches[0]; if (t) start(t.clientX,t.clientY); }, { passive: true });
    el.addEventListener("touchmove",  e => { const t=e.changedTouches[0]; if (t) move(t.clientX,t.clientY); }, { passive: true });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
  }

  // ---------- Main init ----------
  async function tryInit(attempt = 0) {
    normalizeHash();
    const id = getIdFromUrl();
    if (!id) {
      if (attempt < RETRY_MAX) return setTimeout(() => tryInit(attempt + 1), RETRY_MS);
      console.warn("[SwipeTree Lab] No id found in URL.");
      return;
    }

    const anchorEl = ensureAnchorEl();

    // Image load with fallbacks
    const urls = buildCandidateUrls(id);
    await tryImage(anchorEl, urls);

    const lbl = await getLabel(id);
    if (lbl && (lbl.name || lbl.dob)) {
      showLabel(anchorEl, `${lbl.name || ""}${lbl.dob ? " • " + lbl.dob : ""}`.trim());
    }

    if (!anchorEl.__softEditAttached) {
      attachLongPress(anchorEl, () => getIdFromUrl());
      anchorEl.__softEditAttached = true;
    }
  }

  window.addEventListener("hashchange", () => tryInit(0));

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      tryInit(0);
      setTimeout(() => tryInit(1), RETRY_MS);
    });
  } else {
    tryInit(0);
    setTimeout(() => tryInit(1), RETRY_MS);
  }

  console.log("[SwipeTree Lab rc1e] Long-press enabled; robust init with image fallbacks.");
})();
