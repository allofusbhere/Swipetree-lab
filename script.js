
/*
 SwipeTree Lab — rc1f (iOS long‑press reliability + double‑tap fallback)
  - Keeps rc1d/rc1e behavior (labels + image fallbacks)
  - Disables page scrolling over the anchor to ensure long‑press fires
  - Adds double‑tap to open the editor as a backup gesture (300ms)
*/

(function () {
  const $ = (sel, root=document) => root.querySelector(sel);

  // Inject iOS-friendly CSS to prevent scroll/selection
  const style = document.createElement("style");
  style.textContent = `
    html, body { height:100%; background:#000; overscroll-behavior:none; }
    body { margin:0; -webkit-touch-callout:none; -webkit-user-select:none; user-select:none; }
    #anchorWrap, #anchor { touch-action:none; }
    dialog::backdrop { background: rgba(0,0,0,0.35); }
  `;
  document.head.appendChild(style);

  // Scaffold (if not already present)
  const host = document.getElementById("app") || document.body;
  if (!host.dataset.rc1f) {
    host.dataset.rc1f = "1";
    host.innerHTML = `
      <div id="anchorWrap" style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#000;">
        <div id="anchor" style="text-align:center;user-select:none;">
          <img id="photo" alt="" style="max-width:46vw;max-height:62vh;display:block;margin:0 auto;border-radius:8px;"/>
          <div id="label" style="color:#fff;margin-top:8px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;"></div>
        </div>
      </div>
      <dialog id="editDialog" style="border-radius:12px;border:none;padding:16px 16px 12px;">
        <form method="dialog" id="editForm" style="display:flex;flex-direction:column;gap:10px;min-width:260px;">
          <div style="font-weight:600;font-size:15px;">Edit label</div>
          <input id="nameInput" placeholder="Name" autocomplete="off" />
          <input id="dobInput" placeholder="DOB (any format)" autocomplete="off" />
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:2px;">
            <button id="cancelBtn" value="cancel">Cancel</button>
            <button id="saveBtn" value="default">Save</button>
          </div>
        </form>
      </dialog>
    `;
  }

  // Config & helpers
  const CFG = (window.SWIPE_CFG || {});
  const IMAGE_BASES = [
    CFG.IMAGE_BASE || "",
    "https://allofusbhere.github.io/family-tree-images",
    "https://cdn.jsdelivr.net/gh/allofusbhere/family-tree-images@main"
  ];

  const getIdFromHash = () => {
    const m = location.hash.match(/id=([0-9.]+)/);
    return m ? m[1] : "100000";
  };
  const labelsEndpoint = (id) => `/.netlify/functions/labels?id=${encodeURIComponent(id)}&_=${Date.now()}`;

  async function fetchLabel(id) {
    try {
      const res = await fetch(labelsEndpoint(id), { method: "GET", cache: "no-store" });
      const data = res.ok ? await res.json() : {};
      if (data && (data.name || data.dob)) return data;
      return { id };
    } catch (e) {
      try { return JSON.parse(localStorage.getItem("label:"+id)) || { id }; } catch { return { id }; }
    }
  }

  async function saveLabel(id, name, dob) {
    const payload = { id, name: (name||"").trim(), dob: (dob||"").").trim() };
    try {
      const res = await fetch("/.netlify/functions/labels", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("PUT failed");
      localStorage.setItem("label:"+id, JSON.stringify(payload));
      return await res.json();
    } catch (e) {
      localStorage.setItem("label:"+id, JSON.stringify(payload));
      return { ok:false, error:String(e) };
    }
  }

  function renderLabel({ name, dob }) {
    const parts = [];
    if (name) parts.push(name);
    if (dob) parts.push(dob);
    $("#label").textContent = parts.join(" • ");
  }

  function tryLoadImage(id, idx=0) {
    const img = $("#photo");
    if (idx >= IMAGE_BASES.length) {
      img.removeAttribute("src");
      $("#label").textContent = "Image not found for " + id;
      return;
    }
    const base = IMAGE_BASES[idx];
    const sep = base && !base.endsWith("/") ? "/" : "";
    const src = `${base}${base ? sep : ""}${id}.jpg`;
    img.onerror = () => tryLoadImage(id, idx+1);
    img.onload = () => { img.onerror = null; };
    img.crossOrigin = "anonymous";
    img.src = src + `?v=${Date.now()}`;
    img.alt = id;
  }

  async function hydrate(id) {
    tryLoadImage(id, 0);
    const data = await fetchLabel(id);
    renderLabel(data);
    currentLabel = { id, name: data.name || "", dob: data.dob || "" };
  }

  // Long‑press + double‑tap
  let pressTimer = null;
  let touchStartXY = null;
  const PRESS_MS = 500;
  const JITTER = 18;
  let lastTapTime = 0;
  let currentLabel = { id: "", name: "", dob: "" };

  function withinJitter(a, b) {
    return Math.abs(a.x - b.x) <= JITTER && Math.abs(a.y - b.y) <= JITTER;
  }

  function openEditorPrefilled() {
    $("#nameInput").value = currentLabel.name || "";
    $("#dobInput").value = currentLabel.dob || "";
    $("#editDialog").showModal();
  }

  function startPress(e) {
    // prevent page scroll so long‑press can fire
    if (e.cancelable) e.preventDefault();
    const pt = ("touches" in e && e.touches[0]) ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
    touchStartXY = pt;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(openEditorPrefilled, PRESS_MS);
  }
  function movePress(e) {
    if (!pressTimer || !touchStartXY) return;
    const pt = ("touches" in e && e.touches[0]) ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
    if (!withinJitter(touchStartXY, pt)) { clearTimeout(pressTimer); pressTimer = null; }
  }
  function endPress() { clearTimeout(pressTimer); pressTimer = null; touchStartXY = null; }

  // Double‑tap fallback
  function onTap(e) {
    const now = Date.now();
    if (now - lastTapTime < 300) {
      if (e.cancelable) e.preventDefault();
      openEditorPrefilled();
      lastTapTime = 0;
    } else {
      lastTapTime = now;
    }
  }

  const target = $("#anchor");
  // Pointer events
  target.addEventListener("pointerdown", startPress);
  target.addEventListener("pointermove", movePress);
  target.addEventListener("pointerup", endPress);
  target.addEventListener("pointercancel", endPress);
  // Touch (non‑passive so we can preventDefault)
  target.addEventListener("touchstart", startPress, { passive: false });
  target.addEventListener("touchmove", movePress, { passive: false });
  target.addEventListener("touchend", endPress, { passive: false });
  target.addEventListener("touchcancel", endPress, { passive: false });
  // Tap detection (covers quick double‑tap)
  target.addEventListener("click", onTap);

  $("#editForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = getIdFromHash();
    const name = $("#nameInput").value;
    const dob = $("#dobInput").value;
    await saveLabel(id, name, dob);
    currentLabel = { id, name, dob };
    renderLabel(currentLabel);
    $("#editDialog").close();
  });
  $("#cancelBtn").addEventListener("click", (e) => { e.preventDefault(); $("#editDialog").close(); });

  window.addEventListener("hashchange", () => hydrate(getIdFromHash()));
  hydrate(getIdFromHash());
})();
