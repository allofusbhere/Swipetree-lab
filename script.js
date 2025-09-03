
/*
 SwipeTree Lab — rc1d
 Fixes:
 1) Cross‑device persistence via Netlify function (GET/PUT).
 2) Long‑press re‑edit prefilled with existing values.
 3) Removes the blue corner Edit button entirely.
 4) Canonical fetch path & cache‑busting to avoid stale responses.
 5) Defensive: works even if hash changes (e.g., #id=140000).

 Assumptions:
 - Images live alongside index.html, named like 140000.jpg, 140000.1.jpg, etc.
 - A Netlify function exists at /.netlify/functions/labels supporting:
     GET  ?id=140000            -> { id, name, dob } or {}
     PUT  body { id,name,dob }  -> { ok: true, id }
*/

(function () {
  const $ = (sel, root=document) => root.querySelector(sel);

  // --- DOM scaffolding (keeps page uncluttered; no edit button) ---
  const host = document.getElementById("app") || document.body;
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

  // --- Utilities ---
  const getIdFromHash = () => {
    const m = location.hash.match(/id=([0-9.]+)/);
    return m ? m[1] : "100000";
  };

  const labelsEndpoint = (id) => `/.netlify/functions/labels?id=${encodeURIComponent(id)}&_=${Date.now()}`;

  async function fetchLabel(id) {
    try {
      const res = await fetch(labelsEndpoint(id), { method: "GET", cache: "no-store" });
      if (!res.ok) throw new Error("GET labels failed");
      const data = await res.json();
      if (data && (data.name || data.dob)) return data;
      return { id };
    } catch (e) {
      console.warn("Label GET error:", e);
      // optional fallback from localStorage
      try { return JSON.parse(localStorage.getItem("label:"+id)) || { id }; }
      catch { return { id }; }
    }
  }

  async function saveLabel(id, name, dob) {
    const payload = { id, name: (name||"").trim(), dob: (dob||"").trim() };
    try {
      const res = await fetch("/.netlify/functions/labels", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("PUT labels failed");
      const out = await res.json();
      // write local cache for instant cross‑tab reflection
      localStorage.setItem("label:"+id, JSON.stringify(payload));
      return out;
    } catch (e) {
      console.error("Label PUT error:", e);
      // still cache locally so the user sees it right away
      localStorage.setItem("label:"+id, JSON.stringify(payload));
      return { ok: false, error: String(e) };
    }
  }

  function renderLabel({ name, dob }) {
    const parts = [];
    if (name) parts.push(name);
    if (dob) parts.push(dob);
    $("#label").textContent = parts.join(" • ");
  }

  function loadPhoto(id) {
    const src = `${id}.jpg`;
    const img = $("#photo");
    img.src = src;
    img.alt = id;
  }

  async function hydrate(id) {
    loadPhoto(id);
    const data = await fetchLabel(id);
    renderLabel(data);
    // Store current in memory for prefill on long‑press
    currentLabel = { id, name: data.name || "", dob: data.dob || "" };
  }

  // --- Long‑press (SoftEdit) ---
  let pressTimer = null;
  let touchStartXY = null;
  const PRESS_MS = 500;
  const JITTER = 12;
  let currentLabel = { id: "", name: "", dob: "" };

  function withinJitter(a, b) {
    return Math.abs(a.x - b.x) <= JITTER && Math.abs(a.y - b.y) <= JITTER;
  }

  function startPress(e) {
    const id = getIdFromHash();
    const startPoint = ("touches" in e && e.touches[0]) ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
    touchStartXY = startPoint;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      // Prefill with existing values
      $("#nameInput").value = currentLabel.name || "";
      $("#dobInput").value = currentLabel.dob || "";
      $("#editDialog").showModal();
    }, PRESS_MS);
  }

  function movePress(e) {
    if (!pressTimer || !touchStartXY) return;
    const pt = ("touches" in e && e.touches[0]) ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
    if (!withinJitter(touchStartXY, pt)) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  }

  function endPress() {
    clearTimeout(pressTimer);
    pressTimer = null;
    touchStartXY = null;
  }

  $("#anchor").addEventListener("pointerdown", startPress);
  $("#anchor").addEventListener("pointermove", movePress);
  $("#anchor").addEventListener("pointerup", endPress);
  $("#anchor").addEventListener("pointercancel", endPress);
  $("#anchor").addEventListener("touchstart", startPress, { passive: true });
  $("#anchor").addEventListener("touchmove", movePress, { passive: true });
  $("#anchor").addEventListener("touchend", endPress);
  $("#anchor").addEventListener("touchcancel", endPress);

  // --- Save / Cancel ---
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
  $("#cancelBtn").addEventListener("click", (e) => {
    e.preventDefault();
    $("#editDialog").close();
  });

  // --- Hash handling ---
  window.addEventListener("hashchange", () => hydrate(getIdFromHash()));

  // --- Init ---
  hydrate(getIdFromHash());
})();
