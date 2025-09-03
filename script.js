
/*
  SwipeTree Lab (rc1d) — long-press test & robust init
  - Accepts both #id=100000 and ?id=100000
  - Guards against null 'anchor' and retries init safely
  - Re-reads hash at load + short delay (Firefox timing)
  - Long-press (SoftEdit): 500ms hold, 12px jitter tolerance
  - Label persistence via Netlify function /.netlify/functions/labels
*/

(function () {
  const JITTER_PX = 12;
  const HOLD_MS = 500;
  const RETRY_MS = 120;      // short retry to catch hash parsing on Firefox
  const RETRY_MAX = 20;      // ~2.4s total fallback
  const LABELS_ENDPOINT = "/.netlify/functions/labels";

  // ---------- URL helpers ----------
  function getIdFromUrl() {
    // Prefer #id=... then fallback to ?id=...
    const hash = (location.hash || "").replace(/^#/, "");
    const h = new URLSearchParams(hash);
    if (h.has("id")) return h.get("id");

    const q = new URLSearchParams(location.search);
    if (q.has("id")) return q.get("id");

    return null;
  }

  function normalizeHash() {
    // If only query has id, convert to hash (don't drop cache-busting params)
    const q = new URLSearchParams(location.search);
    if (q.has("id") && !location.hash.includes("id=")) {
      const id = q.get("id");
      // Keep existing search (like ?cache=rc1d-XXXX) and add hash
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
      // Minimal styles so it shows up in Lab even if CSS is missing
      el.style.display = "block";
      el.style.maxWidth = "90vw";
      el.style.maxHeight = "90vh";
      el.style.objectFit = "contain";
      el.style.margin = "5vh auto";
      document.body.appendChild(el);
    }
    return el;
  }

  function imageUrlFor(id) {
    // Lab uses flat filenames like 100000.jpg in the same directory.
    // If your setup serves images elsewhere, set window.SWIPETREE_IMG_BASE.
    const base = (window.SWIPETREE_IMG_BASE || "").replace(/\/+$/, "");
    const filename = `${id}.jpg`;
    return base ? `${base}/${filename}` : filename;
  }

  // ---------- Labels persistence ----------
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
    // simple title overlay via dataset/title; Lab-only
    if (!el) return;
    el.setAttribute("title", text || "");
  }

  // ---------- Long-press (SoftEdit) ----------
  function attachLongPress(el, getCurrentId) {
    let downAt = 0;
    let startX = 0;
    let startY = 0;
    let held = false;
    let timer = null;

    function start(x, y) {
      downAt = Date.now();
      startX = x; startY = y; held = false;
      clearTimeout(timer);
      timer = setTimeout(async () => {
        held = true;
        const id = getCurrentId();
        if (!id) return;
        const current = await getLabel(id);
        const currentName = current && current.name ? current.name : "";
        const currentDob = current && current.dob ? current.dob : "";
        // Minimal prompt UI for Lab
        const name = prompt(`Edit Name for ${id}:`, currentName || "");
        if (name === null) return; // cancelled
        const dob = prompt(`Edit DOB for ${id}:`, currentDob || "");
        if (dob === null) return; // cancelled
        const ok = await saveLabel(id, { name, dob });
        if (ok) showLabel(el, `${name}${dob ? " • " + dob : ""}`);
        else alert("Save failed. Please try again.");
      }, HOLD_MS);
    }

    function move(x, y) {
      if (!downAt) return;
      const dx = Math.abs(x - startX);
      const dy = Math.abs(y - startY);
      if (dx > JITTER_PX || dy > JITTER_PX) {
        clearTimeout(timer);
      }
    }

    function end() {
      clearTimeout(timer);
      downAt = 0;
    }

    // Pointer events (covers mouse + touch in modern browsers)
    el.addEventListener("pointerdown", e => {
      el.setPointerCapture(e.pointerId);
      start(e.clientX, e.clientY);
    });
    el.addEventListener("pointermove", e => move(e.clientX, e.clientY));
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);

    // Fallback for older iOS/Safari if needed
    el.addEventListener("touchstart", e => {
      const t = e.changedTouches[0];
      if (t) start(t.clientX, t.clientY);
    }, { passive: true });
    el.addEventListener("touchmove", e => {
      const t = e.changedTouches[0];
      if (t) move(t.clientX, t.clientY);
    }, { passive: true });
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

    // Load image and label
    const url = imageUrlFor(id);
    anchorEl.src = url;
    anchorEl.onerror = function () {
      // Keep lab usable even if the image is missing
      this.src = "placeholder.jpg";
    };

    const lbl = await getLabel(id);
    if (lbl && (lbl.name || lbl.dob)) {
      showLabel(anchorEl, `${lbl.name || ""}${lbl.dob ? " • " + lbl.dob : ""}`.trim());
    }

    // Attach long-press once
    if (!anchorEl.__softEditAttached) {
      attachLongPress(anchorEl, () => getIdFromUrl());
      anchorEl.__softEditAttached = true;
    }
  }

  // Re-init if the hash changes (navigate within the same tab)
  window.addEventListener("hashchange", () => tryInit(0));

  // Kick off after DOM is ready, plus a short retry for Firefox
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      tryInit(0);
      setTimeout(() => tryInit(1), RETRY_MS);
    });
  } else {
    tryInit(0);
    setTimeout(() => tryInit(1), RETRY_MS);
  }

  console.log("[SwipeTree Lab rc1d] Long-press enabled; robust init active.");
})();
