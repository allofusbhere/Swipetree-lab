/* SwipeTree Labs — dual-path anchor preload to stabilize Safari paints */
(function(){
  'use strict';

  window.addEventListener('contextmenu', e => e.preventDefault(), {capture:true});
  ['gesturestart','gesturechange','gestureend'].forEach(t=>{
    document.addEventListener(t, e=>{ e.preventDefault(); }, {passive:false});
  });

  const IMAGE_BASE = (window.CONFIG && window.CONFIG.IMAGE_BASE) || 'https://allofusbhere.github.io/family-tree-images/';
  const ENABLE_LABELS = !!(window.CONFIG && window.CONFIG.ENABLE_LABELS);
  const MAX_COUNT = 9;
  const THRESH = 28;

  const stage = document.getElementById('stage');
  const anchorEl = document.getElementById('anchor');
  const preload = document.getElementById('preload');
  const grid = document.getElementById('grid');
  const backBtn = document.getElementById('backBtn');
  const startForm = document.getElementById('startForm');
  const startIdInput = document.getElementById('startId');
  const labelName = document.getElementById('labelName');

  const spouses = new Map();
  const labels = new Map();
  const historyStack = [];
  let currentId = null;

  function idMain(id){ return String(id).split('.')[0]; }
  function pow10(n){ return Math.pow(10, n); }
  function imgUrlForId(id){ return IMAGE_BASE + String(id) + '.jpg'; }

  function trailingZerosCount(idStr){
    const main = idMain(idStr);
    let count = 0;
    for (let i = main.length - 1; i >= 0; i--) { if (main[i] === '0') count++; else break; }
    return count;
  }

  async function loadSpouseMap(){
    try{
      const res = await fetch('spouse_link.json?v=' + Date.now(), {cache:'no-store'});
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)){
        for (const pair of data){
          if (Array.isArray(pair) && pair.length >= 2){
            const a = String(pair[0]), b = String(pair[1]);
            spouses.set(a,b); spouses.set(b,a);
          }
        }
      }else if (data && typeof data === 'object'){
        for (const [a,b] of Object.entries(data)){ spouses.set(String(a), String(b)); }
      }
    }catch(e){}
  }

  async function loadLabels(){
    if (!ENABLE_LABELS) return;
    try{
      const res = await fetch('labels.json?v=' + Date.now(), {cache:'no-store'});
      if (res.ok){
        const data = await res.json();
        if (data && typeof data === 'object'){
          for (const [id, name] of Object.entries(data)){
            labels.set(String(id), String(name));
          }
        }
      }
    }catch(e){}
  }

  function deriveParent(idStr){
    const main = idMain(idStr);
    const tz = trailingZerosCount(main);
    const step = pow10(tz + 1);
    const base = parseInt(main, 10);
    const head = Math.floor(base / step) * step;
    if (head === 0 || head === base) return null;
    return String(head);
  }
  function deriveChildrenList(idStr){
    const main = idMain(idStr);
    const tz = trailingZerosCount(main);
    if (tz < 1) return [];
    const step = pow10(tz - 1);
    const base = parseInt(main, 10);
    const arr = [];
    for (let n=1; n<=MAX_COUNT; n++){ arr.push(String(base + n*step)); }
    return arr;
  }
  function deriveSiblingsList(idStr){
    const parent = deriveParent(idStr);
    if (parent){
      const ptz = trailingZerosCount(parent);
      if (ptz < 1) return [];
      const step = pow10(ptz - 1);
      const pbase = parseInt(idMain(parent), 10);
      const me = parseInt(idMain(idStr), 10);
      const arr = [];
      for (let n=1; n<=MAX_COUNT; n++){
        const sib = pbase + n*step;
        if (sib !== me) arr.push(String(sib));
      }
      return arr;
    }
    const main = idMain(idStr);
    const tz = trailingZerosCount(main);
    const step = pow10(tz);
    const cohort = [];
    for (let k=1; k<=9; k++){ cohort.push(String(k*step)); }
    const me = String(parseInt(main,10));
    return cohort.filter(x => x !== me);
  }
  function resolveSpouseId(idStr){
    const ex = spouses.get(String(idStr));
    if (ex) return ex;
    if (String(idStr).includes('.1')) return idMain(idStr);
    return String(idStr)+'.1';
  }
  function resolveOtherParent(parentId){
    const s = spouses.get(String(parentId));
    if (s) return s;
    if (!String(parentId).includes('.1')) return String(parentId)+'.1';
    return idMain(parentId);
  }

  function setAnchorBackground(url){
    anchorEl.style.backgroundImage = 'url("' + url + '")';
    anchorEl.style.backgroundRepeat = 'no-repeat';
    anchorEl.style.backgroundSize = 'contain';
    anchorEl.style.backgroundPosition = 'center center';
  }

  function warmAndPaint(url){
    // Set immediately (fast path)
    setAnchorBackground(url);
    // Warm cache for Safari, then repaint on load
    preload.onload = () => { setAnchorBackground(url); };
    preload.src = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
  }

  async function loadAnchor(id){
    currentId = String(id);
    const url = imgUrlForId(currentId);
    anchorEl.classList.remove('hidden');
    grid.classList.add('hidden');
    warmAndPaint(url);
    setIdInHash(currentId);
    if (ENABLE_LABELS) labelName.textContent = labels.get(currentId) || '';
  }

  function setIdInHash(id){
    const newHash = `#id=${id}`;
    if (location.hash !== newHash){ history.pushState({id}, '', newHash); }
  }
  function getIdFromHash(){
    const m = location.hash.match(/id=([0-9.]+)/);
    return m ? m[1] : null;
  }

  function makeTile(id){
    const card = document.createElement('div'); card.className = 'card';
    const face = document.createElement('div'); face.className = 'face';
    face.style.backgroundImage = 'url("' + imgUrlForId(id) + '")';
    card.appendChild(face);
    if (ENABLE_LABELS){
      const name = labels.get(String(id));
      if (name){ const cap = document.createElement('div'); cap.className = 'cardLabel'; cap.textContent = name; card.appendChild(cap); }
    }
    card.addEventListener('click', ()=>{ historyStack.push(currentId); loadAnchor(id); });
    return card;
  }

  function showGrid(type, list){
    anchorEl.classList.add('hidden');
    grid.classList.remove('hidden');
    grid.className = 'grid' + (type === 'parents' ? ' parents' : '');
    grid.innerHTML = '';

    let added = 0;
    Array.from(new Set(list)).forEach(id=>{ grid.appendChild(makeTile(id)); added++; });

    if (added === 0){
      const msg = document.createElement('div');
      msg.style.color = '#aab4c2'; msg.style.textAlign = 'center';
      msg.textContent = 'No images available for this category.';
      grid.appendChild(msg);
    }
  }

  // Gestures
  const opts = {passive:false, capture:true};
  let active=false, sx=0, sy=0;
  function onStart(x,y){ active=true; sx=x; sy=y; }
  function onEnd(x,y){
    if (!active) return; active=false;
    const dx = x - sx, dy = y - sy;
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax < THRESH && ay < THRESH) return;

    if (ax > ay){
      if (dx > 0){
        const s = resolveSpouseId(currentId); if (s){ historyStack.push(currentId); loadAnchor(s); }
      } else {
        const sibs = deriveSiblingsList(currentId);
        showGrid('siblings', sibs);
      }
    } else {
      if (dy < 0){
        const pA = deriveParent(currentId);
        const list = []; if (pA){ list.push(pA); const pB = resolveOtherParent(pA); if (pB) list.push(pB); }
        showGrid('parents', list);
      } else {
        const kidsSelf = deriveChildrenList(currentId);
        const s = resolveSpouseId(currentId);
        const kidsSpouse = s ? deriveChildrenList(s) : [];
        const merged = Array.from(new Set([...kidsSelf, ...kidsSpouse]));
        showGrid('children', merged);
      }
    }
  }

  [stage, anchorEl].forEach(el=>{
    el.addEventListener('pointerdown', e=>{ if(e.cancelable) e.preventDefault(); onStart(e.clientX,e.clientY); }, opts);
    el.addEventListener('pointermove', e=>{ if(e.cancelable) e.preventDefault(); }, opts);
    el.addEventListener('pointerup',   e=>{ if(e.cancelable) e.preventDefault(); onEnd(e.clientX,e.clientY); }, opts);
  });

  backBtn.addEventListener('click', () => {
    if (!grid.classList.contains('hidden')){ grid.classList.add('hidden'); anchorEl.classList.remove('hidden'); return; }
    const prev = historyStack.pop(); if (prev) loadAnchor(prev);
  });

  startForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    let v = (startIdInput.value||'').trim();
    v = v.replace(/[^0-9.]/g,''); // keep digits and optional .1
    if (!v) return;
    historyStack.length = 0;
    loadAnchor(v);
  });

  (async function init(){
    grid.classList.add('hidden');
    anchorEl.classList.remove('hidden');
    await loadSpouseMap();
    await loadLabels();
    const startId = getIdFromHash() || '100000';
    loadAnchor(startId);
    window.addEventListener('popstate', ()=>{ const id=getIdFromHash(); if(id) loadAnchor(id); });
  })();
})();