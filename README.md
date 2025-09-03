
# SwipeTree Lab rc1d — Cross‑Device Labels Fix

This drop fixes the two issues you reported:
1. **Persistence across devices** (iPad ⇄ iPhone ⇄ desktop) using a canonical Netlify function path with cache‑busting and `Cache-Control: no-store`.
2. **Re‑edit prefill** — a second long‑press opens the dialog with your previously saved Name/DOB prefilled.

Also:
- The **blue edit button is removed** (long‑press only).
- GET includes a timestamp query (`&_=${Date.now()}`) to avoid stale responses.
- PUT also writes to `localStorage` as a fast visual cache; server remains source of truth.

## Files
- `script.js` — drop in your Lab `index.html` page.
- `netlify/functions/labels.js` — optional replacement if you want no‑store headers and clean GET/PUT. If you already have a working function, keep it and just use the new `script.js`.

## How to test
1. Load your Lab URL (e.g., `.../index.html#id=100000`) on iPad.
2. **Long‑press** the photo → edit dialog → enter Name + DOB → **Save**.
3. Open the same URL on iPhone (or desktop) → the label should match.
4. Long‑press again → the dialog should **prefill** with the existing values.
