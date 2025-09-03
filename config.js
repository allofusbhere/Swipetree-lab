
// SwipeTree Lab — config.js (rc1e)
// Points the Lab build at the shared images repository.
// Place this file in the repo root next to index.html and script.js.

// Primary images base (jsDelivr CDN).
// Assumes images like 100000.jpg, 140000.1.jpg live at the repo root.
window.SWIPETREE_IMG_BASE = "https://cdn.jsdelivr.net/gh/allofusbhere/family-tree-images@main";

// Optional fallback (raw GitHub) if CDN fails or cache lags.
window.SWIPETREE_IMG_FALLBACK = "https://raw.githubusercontent.com/allofusbhere/family-tree-images/refs/heads/main";
