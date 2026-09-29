// Nalda preview: live phone frames. Every phone is an iframe onto view-<platform>.dc.html (412 × 922, scaled by CSS).
// A pool loads frames lazily as they near the viewport and keeps at most MAX_LIVE alive, so a grid of 146 cards
// stays responsive: far-away frames are unloaded back to their placeholder.
(() => {
  'use strict';

  const FRAME_W = 412, FRAME_H = 922;
  const MAX_LIVE = 14;
  const CONCURRENCY = 3;
  const LOAD_TIMEOUT = 15000;
  // The prototype renders just after its load event; wait a beat so the placeholder never flashes an empty frame.
  const SETTLE_MS = 120;

  const textSizeFor = (p, size) => size !== 'auto' ? size : (p === 'ios' ? '작게 보기' : '기본');

  function frameUrl(p, key, theme, size) {
    return `view-${p}.dc.html?` + new URLSearchParams({ screen: key, theme, textSize: textSizeFor(p, size) });
  }

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  // A phone placeholder: sized by the --scale custom property of an ancestor, filled by a pool or at once.
  function phone(src, label, caption) {
    const box = el('div', src.startsWith('view-android') ? 'phone-box phone-box--android' : 'phone-box phone-box--ios');
    box.dataset.src = src;
    box.dataset.label = label;
    const ph = el('div', 'phone-box__ph');
    ph.setAttribute('aria-hidden', 'true');
    if (caption) ph.append(el('span', 'phone-box__code', caption.code), el('span', 'phone-box__title', caption.title));
    ph.append(el('span', 'phone-box__wait', '불러오는 중'));
    box.append(ph);
    return box;
  }

  function mount(box, onDone) {
    const f = document.createElement('iframe');
    f.title = box.dataset.label;
    f.loading = 'eager';
    f.tabIndex = -1;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      box.finishLoad = null;
      clearTimeout(timer);
      setTimeout(() => { if (f.isConnected) box.classList.add('is-ready'); }, SETTLE_MS);
      onDone?.();
    };
    const timer = setTimeout(finish, LOAD_TIMEOUT);
    box.finishLoad = finish;
    f.addEventListener('load', finish);
    f.addEventListener('error', finish);
    f.src = box.dataset.src;
    box.append(f);
    box.classList.add('is-live');
    return f;
  }

  // Removing a frame that is still loading frees its loading slot at once.
  function unmount(box) {
    box.finishLoad?.();
    box.querySelector('iframe')?.remove();
    box.classList.remove('is-live', 'is-ready');
  }

  // Load a phone at once (one-screen view, cover): no pool, resolves when it has rendered.
  function mountNow(box) {
    return new Promise(resolve => mount(box, resolve));
  }

  function distance(box) {
    const r = box.getBoundingClientRect();
    const dy = Math.max(0, r.top - innerHeight, -r.bottom);
    const dx = Math.max(0, r.left - innerWidth, -r.right);
    return dy + dx;
  }

  function createPool() {
    const near = new Set();
    const live = new Set();
    const queue = [];
    let loading = 0;
    let queued = false;
    const stats = { started: performance.now(), loads: 0, unloads: 0, maxLive: 0, firstScreenReady: 0 };
    const io = new IntersectionObserver(entries => {
      for (const e of entries) e.isIntersecting ? near.add(e.target) : near.delete(e.target);
      schedule();
    }, { rootMargin: '600px 200px' });

    function schedule() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; reconcile(); });
    }

    function reconcile() {
      const wanted = [...near].filter(b => b.isConnected && b.offsetParent !== null)
        .map(b => [distance(b), b]).sort((a, b) => a[0] - b[0]).slice(0, MAX_LIVE).map(x => x[1]);
      const keep = new Set(wanted);
      queue.length = 0;
      for (const box of [...live]) if (!keep.has(box)) { live.delete(box); unmount(box); stats.unloads += 1; }
      for (const box of wanted) if (!live.has(box)) queue.push(box);
      pump();
    }

    function pump() {
      while (loading < CONCURRENCY && queue.length && live.size < MAX_LIVE) {
        const box = queue.shift();
        loading += 1;
        live.add(box);
        stats.loads += 1;
        stats.maxLive = Math.max(stats.maxLive, live.size);
        mount(box, () => { loading -= 1; noteReady(); pump(); });
      }
    }

    function noteReady() {
      if (stats.firstScreenReady || loading || queue.length) return;
      stats.firstScreenReady = Math.round(performance.now() - stats.started);
    }

    return {
      observe(box) { io.observe(box); },
      refresh: schedule,
      destroy() { io.disconnect(); live.forEach(unmount); live.clear(); near.clear(); queue.length = 0; },
      stats: () => ({ ...stats, live: live.size, near: near.size, queued: queue.length }),
    };
  }

  window.NaldaFrames = { FRAME_W, FRAME_H, MAX_LIVE, frameUrl, textSizeFor, phone, mountNow, createPool };
})();
