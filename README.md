# SwipeTree Lab — Device‑Independent Labels (RC1)

**Date:** 2025-09-02 15:10:11

This is a **drop-in** `script.js` replacement for the **lab repo** that upgrades labeling
to be **device‑independent** using your Netlify function at `/.netlify/functions/labels`.
No HTML edits are required.

## What it does
- On load, it **fetches** labels from the Netlify function and merges them into localStorage.
- When labels are updated, it **POSTs** them back to the function so other devices see the same data.
- It preserves your existing localStorage behavior for backward compatibility.

## How it integrates (zero-code-change)
- Many earlier builds stored labels in `localStorage` key `"labels"`.
- This script **intercepts** writes to that key and mirrors changes to Netlify.
- Your UI (double‑tap edit, etc.) should keep working without modification.

## Fallbacks
- If the Netlify function is unreachable, labels still save locally.
- Next time the function is available, the latest local copy is pushed upstream.

## Files
- `script.js` — drop-in replacement.
- `README.md` — this file.

## Deploy
1. Back up your current lab `script.js`.
2. Replace it with the `script.js` from this ZIP.
3. Reload the lab app on iPad and PC; edits should sync between devices.

If anything breaks or you prefer a different sync contract (e.g., per‑ID updates),
tell me and I’ll ship RC2 tuned to your function.
