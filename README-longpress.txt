SwipeTree Long‑Press Editing Patch
Date: 2025-09-02

What it does
- Adds "SoftEdit" long‑press on the anchor image (600ms) to edit Name and DOB.
- Saves to localStorage immediately.
- Optionally POSTs to Netlify function at `/.netlify/functions/labels` if NETLIFY_BASE is set.
- Prefills fields from localStorage or Netlify (GET with ?id=...).

How to use
1) Replace your existing `script.js` with this one.
2) (Optional) Open the file and update NETLIFY_BASE to your Netlify site origin.
3) Long‑press the anchor (iPad) or hold mouse (desktop) to open the editor.
4) Save → toasts "Saved". Your UI can listen for `swipetree:labelSaved` to refresh labels.

Safe defaults
- If Netlify isn’t configured yet, everything still works in localStorage.
- If the image for an ID isn’t found, `placeholder.jpg` is shown (same folder).
