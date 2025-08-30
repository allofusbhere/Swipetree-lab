# SwipeTree Labs (Sandbox)

A safe, standalone test app for experimenting with new features **without** touching your main Family Tree app.
It only reads images from your existing image repo.

## Quick Start

1. Create a new repo (e.g., `swipetree-labs`) and upload these files.
2. Turn on **GitHub Pages** for this repo (serve from `main`).
3. Open: `https://<your-username>.github.io/swipetree-labs/index.html#id=100000`

## Configure

Edit `config.js`:
- `IMAGE_BASE`: points to your images (default: `https://allofusbhere.github.io/family-tree-images/`).
- Feature flags:
  - `ENABLE_LABELS`: `true/false`
  - `ENABLE_SOFTEDIT`: `true/false` (enables long-press editor; posts to `NETLIFY_FN`)

Or pass flags via URL:
- `?exp=labels` (enable labels)
- `?exp=edit` (enable SoftEdit)
- `?exp=labels,edit` (both)

Example:
```
.../index.html?exp=labels,edit#id=100000
```

## Netlify (optional for SoftEdit)

If you enable `ENABLE_SOFTEDIT`, configure a Netlify Function at `/.netlify/functions/labels` to persist names.
You can reuse the function from our earlier package or point `NETLIFY_FN` to your existing endpoint.

## Notes

- Core relationship math and gestures are identical to the stable build.
- This sandbox won’t change your main site; it’s a separate repo and URL.
