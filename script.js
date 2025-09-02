/* SwipeTree — Long‑Press Editing Patch (SoftEdit)
   Drop‑in replacement for script.js
   - Preserves swipe mapping: ↑ parents, ↓ children, ← siblings, → spouse
   - Adds long‑press (600ms) on the ANCHOR image to open a lightweight edit overlay
   - Edits fields: Name, DOB (MM/DD/YYYY)
   - Saves to localStorage immediately
   - Optionally syncs to Netlify labels function if NETLIFY_BASE is defined
     · GET:  `${NETLIFY_BASE}/.netlify/functions/labels?id=<ID>` (used to prefill if available)
     · POST: `${NETLIFY_BASE}/.netlify/functions/labels` with JSON { id, name, dob }
       (falls back silently if endpoint isn’t present)
   - No code changes needed to HTML — overlay is injected dynamically
*/

(function () {
  const VERSION = "SwipeTree longpress-patch " + new Date().toISOString().slice(0,10);

  // -------------------- CONFIG --------------------
  // If you have Netlify set up, set NETLIFY_BASE to your site origin.
  // Example: "https://elegant-panda-0f4cac.netlify.app"
  const NETLIFY_BASE = "https://elegant-panda-0f4cac.netlify.app"; // <-- change if needed
  const LONGPRESS_MS = 600; // duration to trigger long‑press
  const TOAST_MS = 1500;

  // -------------------- DOM HOOKS --------------------
  const anchor = document.getElementById("anchor");
  const idInput = document.getElementById("idInput");
  const startBtn = document.getElementById("startBtn");
  const versionEl = document.getElementById("version");
  const root = document.getElementById("app");

  if (versionEl) versionEl.textContent = VERSION;

  // -------------------- UTIL --------------------
  const $state = {
    id: null,
    touch: { startX:0, startY:0, startT:0, touching:false },
    mouse: { down:false, x:0, y:0, t:0 },
  };

  function showToast(msg) {
    let toast = document.getElementById("toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "toast";
      Object.assign(toast.style, {
        position:"fixed", bottom:"70px", left:"50%", transform:"translateX(-50%)",
        background:"#222", border:"1px solid #333", padding:"8px 12px",
        borderRadius:"10px", fontSize:"13px", color:"#eee", zIndex:"9999"
      });
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.display = "block";
    clearTimeout(showToast._t);
    showToast._t = setTimeout(()=> toast.style.display = "none", TOAST_MS);
  }

  function hashGetId() {
    const m = location.hash.match(/id=([\d.]+)/);
    return m ? m[1] : null;
  }

  // -------------------- LABELS (localStorage + Netlify) --------------------
  function lsKey(id){ return `swipetree:label:${id}`; }

  async function getLabel(id) {
    // 1) local
    try {
      const raw = localStorage.getItem(lsKey(id));
      if (raw) return JSON.parse(raw);
    } catch {}
    // 2) netlify (optional)
    if (NETLIFY_BASE) {
      try {
        const r = await fetch(`${NETLIFY_BASE}/.netlify/functions/labels?id=${encodeURIComponent(id)}`, { mode:"cors" });
        if (r.ok) {
          const j = await r.json();
          // Accept any payload that includes name/dob fields or a nested object.
          if (j && (j.name || j.dob || j.data)) {
            const rec = j.data ? j.data : { name: j.name || "", dob: j.dob || "" };
            return rec;
          }
        }
      } catch {}
    }
    return { name:"", dob:"" };
  }

  async function saveLabel(id, data) {
    // 1) local
    try { localStorage.setItem(lsKey(id), JSON.stringify(data)); } catch {}
    // 2) netlify (optional, best‑effort)
    if (NETLIFY_BASE) {
      try {
        await fetch(`${NETLIFY_BASE}/.netlify/functions/labels`, {
          method:"POST",
          headers: { "Content-Type":"application/json" },
          body: JSON.stringify({ id, ...data }),
          mode:"cors",
        });
      } catch {}
    }
  }

  // -------------------- OVERLAY (SoftEdit) --------------------
  let overlay = null;
  function buildOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "softEditOverlay";
    Object.assign(overlay.style, {
      position:"fixed", inset:"0", background:"rgba(0,0,0,0.7)",
      display:"flex", alignItems:"center", justifyContent:"center",
      zIndex:"9998"
    });
    const card = document.createElement("div");
    Object.assign(card.style, {
      width:"min(480px, 92vw)",
      background:"#161616",
      border:"1px solid #2a2a2a",
      borderRadius:"16px",
      boxShadow:"0 10px 40px rgba(0,0,0,0.5)",
      padding:"16px",
      color:"#eee",
      fontFamily:"system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif"
    });
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;">
        <div style="font-weight:600;">Edit Details</div>
        <button id="seClose" style="background:#222;border:1px solid #333;color:#eee;border-radius:8px;padding:6px 10px;cursor:pointer;">Close</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <label style="font-size:13px;opacity:0.9;">Name
          <input id="seName" type="text" placeholder="Full name" style="width:100%;margin-top:4px;padding:8px;border-radius:8px;border:1px solid #333;background:#111;color:#eee;">
        </label>
        <label style="font-size:13px;opacity:0.9;">Date of Birth (MM/DD/YYYY)
          <input id="seDob" type="text" placeholder="MM/DD/YYYY" style="width:100%;margin-top:4px;padding:8px;border-radius:8px;border:1px solid #333;background:#111;color:#eee;">
        </label>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;">
        <button id="seSave" style="background:#2a6;border:1px solid #3a7;color:#fff;border-radius:10px;padding:8px 12px;cursor:pointer;">Save</button>
      </div>
    `;
    overlay.appendChild(card);

    overlay.addEventListener("click", (e)=>{
      if (e.target === overlay) hideOverlay();
    });
    overlay.querySelector("#seClose").addEventListener("click", hideOverlay);
    overlay.querySelector("#seSave").addEventListener("click", async ()=>{
      const name = overlay.querySelector("#seName").value.trim();
      const dob  = overlay.querySelector("#seDob").value.trim();
      await saveLabel($state.id, { name, dob });
      showToast("Saved");
      hideOverlay();
      // Emit a custom event so UI that renders labels can update, if present.
      document.dispatchEvent(new CustomEvent("swipetree:labelSaved", { detail: { id:$state.id, name, dob } }));
    });
    return overlay;
  }
  async function showOverlay() {
    const ov = buildOverlay();
    // Prefill with existing
    const rec = await getLabel($state.id);
    ov.querySelector("#seName").value = rec?.name || "";
    ov.querySelector("#seDob").value  = rec?.dob  || "";
    document.body.appendChild(ov);
  }
  function hideOverlay() {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  // -------------------- IMAGE LOADING --------------------
  function loadById(id) {
    if (!id) return;
    $state.id = id;
    const src = `${id}.jpg`;
    anchor.src = src;
    anchor.onerror = () => {
      anchor.onerror = null;
      anchor.src = "placeholder.jpg";
      showToast(`Image not found for ${id}.jpg (showing placeholder)`);
    };
    location.hash = `id=${id}`;
    console.log("[SwipeTree] anchor set to", id);
    document.dispatchEvent(new CustomEvent("swipetree:anchorChanged", { detail:{ id } }));
  }

  // -------------------- SWIPES --------------------
  // Prevent bounce/scroll on iOS Safari while touching
  window.addEventListener("touchmove", (e)=>{
    if ($state.touch.touching) e.preventDefault();
  }, { passive:false });

  const threshold = 30; // px
  const restraint = 100;
  const allowedTime = 600;

  function onTouchStart(e) {
    const t = e.changedTouches[0];
    $state.touch.touching = true;
    $state.touch.startX = t.pageX;
    $state.touch.startY = t.pageY;
    $state.touch.startT = Date.now();

    // Start long‑press timer on ANCHOR only
    if (e.target === anchor) {
      clearTimeout(onTouchStart._t);
      onTouchStart._t = setTimeout(()=> {
        // If finger is still down and movement is minimal → treat as long‑press
        const now = Date.now();
        if ($state.touch.touching && (now - $state.touch.startT) >= LONGPRESS_MS) {
          const moved = Math.hypot(t.pageX - $state.touch.startX, t.pageY - $state.touch.startY);
          if (moved < 8) {
            showOverlay();
          }
        }
      }, LONGPRESS_MS);
    }
  }

  function onTouchEnd(e) {
    $state.touch.touching = false;
    clearTimeout(onTouchStart._t);

    const t = e.changedTouches[0];
    const dx = t.pageX - $state.touch.startX;
    const dy = t.pageY - $state.touch.startY;
    const dt = Date.now() - $state.touch.startT;

    // If overlay is open, ignore swipe
    if (document.getElementById("softEditOverlay")) return;

    if (dt <= allowedTime) {
      if (Math.abs(dx) >= threshold && Math.abs(dy) <= restraint) {
        showToast(dx < 0 ? "Siblings (←)" : "Spouse (→)");
        document.dispatchEvent(new CustomEvent("swipetree:swipe", { detail: { dir: dx<0?"left":"right", id:$state.id } }));
      } else if (Math.abs(dy) >= threshold && Math.abs(dx) <= restraint) {
        showToast(dy < 0 ? "Parents (↑)" : "Children (↓)");
        document.dispatchEvent(new CustomEvent("swipetree:swipe", { detail: { dir: dy<0?"up":"down", id:$state.id } }));
      }
    }
  }

  // Desktop long‑press (right‑click hold substitute): hold mouse for LONGPRESS_MS
  function onMouseDown(e){
    $state.mouse.down = true; $state.mouse.x=e.pageX; $state.mouse.y=e.pageY; $state.mouse.t=Date.now();
    if (e.target === anchor) {
      clearTimeout(onMouseDown._t);
      onMouseDown._t = setTimeout(()=>{
        if ($state.mouse.down) {
          const moved = Math.hypot(e.pageX - $state.mouse.x, e.pageY - $state.mouse.y);
          if (moved < 8) showOverlay();
        }
      }, LONGPRESS_MS);
    }
  }
  function onMouseUp(e){ $state.mouse.down=false; clearTimeout(onMouseDown._t); }

  document.addEventListener("touchstart", onTouchStart, { passive:false });
  document.addEventListener("touchend", onTouchEnd, { passive:false });
  document.addEventListener("mousedown", onMouseDown);
  document.addEventListener("mouseup", onMouseUp);

  if (startBtn && idInput) startBtn.addEventListener("click", ()=> loadById(idInput.value.trim()));

  // Init
  const initialId = hashGetId() || "100000";
  if (idInput) idInput.value = initialId;
  loadById(initialId);

  console.log(VERSION);
})();