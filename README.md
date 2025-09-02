# SwipeTree Lab — script.js (RC5 — Long‑Press + Hint)

**Date:** 2025-09-02 16:40:58

This build improves long‑press reliability using **Pointer Events** (works on iPad Safari, iOS/Android, desktop)
and adds a small on‑screen hint: “Press & hold to edit”.

- Hold ~600ms on the photo to edit (touch, pen, mouse).
- Cancels if moved >10px or if the pointer leaves the image.
- Also supports right‑click (context menu) and double‑click as fallbacks.
- Keeps Netlify label sync + edge friction.

## Deploy
Replace `script.js` in the lab repo with this file and reload.
