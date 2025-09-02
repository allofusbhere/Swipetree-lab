# SwipeTree Lab — script.js (RC6 — Hybrid Long‑Press for iPad 7th Gen)

**Date:** 2025-09-02 16:51:39

This build hardens long‑press for **iPad 7th Gen / Safari (iPadOS 18.6.2)**:
- Hybrid recognizer: **Pointer Events + Touch Events** (either path triggers edit).
- Removes aggressive touch `preventDefault` from the surface so long‑press isn’t suppressed.
- Injects CSS to reduce interference: `overscroll-behavior: none`, `-webkit-touch-callout: none`.
- Keeps Netlify label sync + edge friction via CSS (no JS touch blocking).

## Deploy
Replace your lab `script.js` with this file and reload the Netlify URL.
