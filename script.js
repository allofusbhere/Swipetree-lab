
/*
 SwipeTree Lab — rc1h (image extension fallback + on-screen debug)
 - Tries .jpg, .JPG, .jpeg, .png for each base
 - Shows a small debug line in bottom-left with the last attempted URL (tap to hide)
 - Keeps rc1f behavior (long-press + double-tap + label persistence)
*/

(function () {
  const $ = (sel, root=document) => root.querySelector(sel);

  // Basic styles & debug overlay
  const style = document.createElement("style");
  style.textContent = `
    html, body { height:100%; background:#000; overscroll-behavior:none; }
    body { margin:0; -webkit-touch-callout:none; -webkit-user-select:none; user-select:none; }
    #anchorWrap, #anchor { touch-action:none; }
    #dbg { position:fixed; left:8px; bottom:8px; font:12px/1.3 system-ui, -apple-system, Segoe UI, Roboto, Arial; color:#9cf; opacity:.8; background:rgba(0,0,0,.35); padding:6px 8px; border-radius:6px; max-width:80vw; z-index:9999; }
    #dbg.hide { display:none; }
    dialog::backdrop { background: rgba(0,0,0,0.35); }
  `;
  document.head.appendChild(style);

  const dbg = document.createElement("div");
  dbg.id = "dbg";
  dbg.textContent = "debug: ready";
  dbg.addEventListener("click", ()=>dbg.classList.add("hide"));
  document.body.appendChild(dbg);
  function setDbg(t){ dbg.textContent = t; }

  const host = document.getElementById("app") || document.body;
  if (!host.dataset.rc1h) {
    host.dataset.rc1h = "1";
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

  const CFG = (window.SWIPE_CFG || {});
  const IMAGE_BASES = [
    CFG.IMAGE_BASE || "",
    "https://allofusbhere.github.io/family-tree-images",
    "https://cdn.jsdelivr.net/gh/allofusbhere/family-tree-images@main"
  ];
  const EXTENSIONS = [".jpg",".JPG",".jpeg",".png"];

  const getIdFromHash = () => {
    const m = location.hash.match(/id=([0-9.]+)/);
    return m ? m[1] : "100000";
  };
  const labelsEndpoint = (id) => `${(window.SWIPE_CFG && window.SWIPE_CFG.LABELS_ENDPOINT) || "/.netlify/functions/labels"}?id=${encodeURIComponent(id)}&_=${Date.now()}`;

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
    const payload = { id, name: (name||"").trim(), dob: (dob||"").trim() };
    try {
      const res = await fetch(((window.SWIPE_CFG && window.SWIPE_CFG.LABELS_ENDPOINT) || "/.netlify/functions/labels"), {
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

  function tryLoadImage(id, baseIdx=0, extIdx=0) {
    const img = $("#photo");
    if (baseIdx >= IMAGE_BASES.length) {
      img.removeAttribute("src");
      setDbg("image not found for "+id);
      $("#label").textContent = "Image not found for " + id;
      return;
    }
    const base = IMAGE_BASES[baseIdx];
    const ext = EXTENSIONS[extIdx];
    const sep = base && !base.endsWith("/") ? "/" : "";
    const url = `${base}${base ? sep : ""}${id}${ext}`;
    setDbg("img: "+url);

    img.onerror = () => {
      const nextExt = extIdx + 1;
      if (nextExt < EXTENSIONS.length) {
        tryLoadImage(id, baseIdx, nextExt);
      } else {
        tryLoadImage(id, baseIdx + 1, 0);
      }
    };
    img.onload = () => { img.onerror = null; setDbg("loaded: "+url); };
    img.crossOrigin = "anonymous";
    img.src = url + `?v=${Date.now()}`;
    img.alt = id;
  }

  async function hydrate(id) {
    tryLoadImage(id, 0, 0);
    const data = await fetchLabel(id);
    renderLabel(data);
    currentLabel = { id, name: data.name || "", dob: data.dob || "" };
  }

  // Gestures: long-press + double-tap
  let pressTimer = null;
  let touchStartXY = null;
  const PRESS_MS = 500;
  const JITTER = 18;
  let lastTapTime = 0;
  let currentLabel = { id: "", name: "", dob: "" };

  function withinJitter(a, b) { return Math.abs(a.x - b.x) <= JITTER && Math.abs(a.y - b.y) <= JITTER; }
  function openEditorPrefilled() {
    $("#nameInput").value = currentLabel.name || "";
    $("#dobInput").value = currentLabel.dob || "";
    $("#editDialog").showModal();
  }
  function startPress(e) {
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
  function endPress(){ clearTimeout(pressTimer); pressTimer=null; touchStartXY=null; }
  function onTap(e){
    const now=Date.now(); if(now-lastTapTime<300){ if(e.cancelable)e.preventDefault(); openEditorPrefilled(); lastTapTime=0; } else { lastTapTime=now; }
  }

  const target = $("#anchor");
  target.addEventListener("pointerdown", startPress);
  target.addEventListener("pointermove", movePress);
  target.addEventListener("pointerup", endPress);
  target.addEventListener("pointercancel", endPress);
  target.addEventListener("touchstart", startPress, { passive:false });
  target.addEventListener("touchmove", movePress, { passive:false });
  target.addEventListener("touchend", endPress, { passive:false });
  target.addEventListener("touchcancel", endPress, { passive:false });
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
