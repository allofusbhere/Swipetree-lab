// SwipeTree Labs config
// Toggle experimental features here or via query param: ?exp=labels,edit
// Change IMAGE_BASE if your images live elsewhere.
window.CONFIG = {
  IMAGE_BASE: 'https://allofusbhere.github.io/family-tree-images/',
  ENABLE_LABELS: false,
  ENABLE_SOFTEDIT: false,
  NETLIFY_FN: '/.netlify/functions/labels' // only used if ENABLE_SOFTEDIT=true
};
(function(){
  const p = new URLSearchParams(location.search).get('exp');
  if (!p) return;
  const flags = new Set(p.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean));
  if (flags.has('labels')) window.CONFIG.ENABLE_LABELS = true;
  if (flags.has('edit')) window.CONFIG.ENABLE_SOFTEDIT = true;
})();