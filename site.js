// Nalda preview shell: state in the URL, top bar, and the four views (all screens, one screen, icons, colors).
(() => {
  'use strict';

  const DEFAULTS = { view: 'all', p: 'ios', theme: 'White', size: 'auto', screen: 'home', sec: '', q: '', isz: '24' };
  const FRAME_W = 412, FRAME_H = 922;
  const OVERVIEW_MIN_W = 540;
  const TOUCH_RAIL = window.matchMedia('(pointer: coarse), (max-width: 720px)');
  const $ = id => document.getElementById(id);
  const q = new URLSearchParams(location.search);
  const state = Object.fromEntries(Object.entries(DEFAULTS).map(([k, v]) => [k, q.get(k) || v]));
  const data = { screens: [], sections: { ios: [], android: [] } };
  let cleanup = () => {};
  let refit = null;

  const platforms = () => state.p === 'both' ? ['ios', 'android'] : [state.p];
  const textSize = p => state.size !== 'auto' ? state.size : (p === 'ios' ? '작게 보기' : '기본');
  const viewUrl = p => `view-${p}.dc.html?` + new URLSearchParams({ screen: state.screen, theme: state.theme, textSize: textSize(p) });
  const overviewUrl = p => `overview-${p}.dc.html?` + new URLSearchParams({ theme: state.theme });

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function syncUrl() {
    const out = new URLSearchParams();
    for (const [k, v] of Object.entries(state)) if (v !== DEFAULTS[k]) out.set(k, v);
    history.replaceState(null, '', out.toString() ? '?' + out : location.pathname);
  }

  // Keys that only mean something in one view are dropped when leaving it, so shared links stay short.
  function normalizeState() {
    if (state.view === 'all' && state.p === 'both') state.p = 'ios';
    if (state.view !== 'all') state.sec = '';
    if (state.view !== 'icons' && state.view !== 'colors') state.q = '';
    if (state.view !== 'icons') state.isz = DEFAULTS.isz;
  }

  function syncControls() {
    normalizeState();
    document.querySelectorAll('.bar .seg').forEach(seg => {
      seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(state[seg.dataset.key] === b.dataset.v)));
    });
    document.querySelector('[data-key="p"] [data-v="both"]').disabled = state.view === 'all';
    $('platformField').hidden = state.view === 'icons' || state.view === 'colors';
    $('picker').hidden = state.view !== 'screen';
    $('sizeField').hidden = state.view !== 'screen';
    $('screen').value = state.screen;
  }

  // ---------- Toast + clipboard (shared with catalog.js) ----------

  let toastT;
  function toast(message) {
    const t = $('toast');
    t.textContent = message;
    t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => { t.hidden = true; }, 1600);
  }

  function copyText(text) {
    const done = () => toast(`${text} 복사됨`);
    const fallback = () => {
      const area = el('textarea');
      area.value = text;
      area.style.cssText = 'position:fixed;opacity:0';
      document.body.append(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      ok ? done() : toast('복사하지 못했습니다 — 직접 선택해 주세요');
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }

  // ---------- One screen ----------

  function fitScale() {
    const stage = $('stage');
    const n = platforms().length;
    const availW = (stage.clientWidth - 32 - (n - 1) * 24) / n;
    const availH = stage.clientHeight - 48 - 28;
    return Math.min(1, availW / FRAME_W, Math.max(availH, 480) / FRAME_H);
  }

  function frame(src, title) {
    const f = document.createElement('iframe');
    f.src = src;
    f.title = title;
    f.addEventListener('load', () => { $('loading').hidden = true; });
    return f;
  }

  function renderScreen(stage) {
    stage.className = 'stage stage--screen';
    const s = fitScale();
    for (const p of platforms()) {
      const box = el('div', 'phone__box');
      box.style.width = FRAME_W * s + 'px';
      box.style.height = FRAME_H * s + 'px';
      const f = frame(viewUrl(p), `Nalda ${p === 'ios' ? 'iOS' : 'Android'} 화면`);
      f.style.transform = `scale(${s})`;
      box.append(f);
      const wrap = el('div', 'phone');
      wrap.append(el('div', 'phone__label', p === 'ios' ? 'iOS' : 'Android'), box);
      stage.append(wrap);
    }
  }

  function step(delta) {
    const list = data.screens;
    const i = list.findIndex(s => s.key === state.screen);
    const next = list[(i + delta + list.length) % list.length];
    if (next) { state.screen = next.key; render(); }
  }

  // ---------- All screens (overview) ----------

  function overviewDoc(f) {
    try { return f.contentDocument; } catch { return null; }
  }

  // Section headings are the 18px bold spans the overview renders from its GROUPS titles.
  function findSections(doc, titles) {
    const found = new Map();
    if (!doc) return found;
    for (const span of doc.querySelectorAll('span')) {
      if (span.style.fontSize !== '18px') continue;
      const title = span.textContent.trim();
      if (titles.includes(title) && !found.has(title)) found.set(title, span.parentElement.parentElement);
    }
    return found;
  }

  function buildNav(list, onPick, onClose) {
    const nav = el('nav', 'ov-nav');
    nav.setAttribute('aria-label', '화면 묶음');
    const head = el('div', 'ov-nav__head');
    const close = el('button', 'icon-btn ov-nav__close', '×');
    close.setAttribute('aria-label', '목차 닫기');
    close.addEventListener('click', onClose);
    head.append(el('span', 'ov-nav__title', `화면 묶음 ${list.length}`), close);
    const ul = el('ul', 'ov-nav__list');
    for (const g of list) {
      const li = el('li');
      const b = el('button', 'ov-nav__item');
      b.dataset.title = g.title;
      if (g.note) b.title = g.note;
      b.append(el('span', 'ov-nav__name', g.title), el('span', 'ov-nav__count', String(g.count)));
      b.addEventListener('click', () => onPick(g.title));
      li.append(b);
      ul.append(li);
    }
    nav.append(head, ul);
    return nav;
  }

  function renderOverview(stage) {
    stage.className = 'stage stage--all';
    const list = data.sections[state.p] || [];
    const titles = list.map(g => g.title);
    const main = el('div', 'ov-main');
    const f = frame(overviewUrl(state.p), `Nalda ${state.p === 'ios' ? 'iOS' : 'Android'} 전체 화면`);
    const toc = el('button', 'ov-toc');
    const tocCurrent = el('span', 'ov-toc__current');
    toc.append(el('span', '', '목차'), tocCurrent);
    const scrim = el('div', 'ov-scrim');
    const setOpen = open => stage.classList.toggle('is-nav-open', open);
    const ov = { f, titles, sections: new Map(), active: '' };
    const nav = buildNav(list, title => { setOpen(false); goToSection(ov, title); }, () => setOpen(false));
    toc.addEventListener('click', () => setOpen(true));
    scrim.addEventListener('click', () => setOpen(false));
    main.append(f, toc);
    stage.append(nav, scrim, main);
    ov.markActive = title => markActive(ov, nav, tocCurrent, title);
    fitOverview(main, f);
    ov.main = main;
    refit = () => { fitOverview(main, f); if (ov.rail) ov.rail.sync(); };
    wireOverview(ov);
  }

  // Phones in the overview are 402px wide; narrower frames render it at OVERVIEW_MIN_W and scale down.
  function fitOverview(main, f) {
    const w = main.clientWidth, h = main.clientHeight;
    if (!w || w >= OVERVIEW_MIN_W) { f.style.cssText = ''; return; }
    const s = w / OVERVIEW_MIN_W;
    f.style.width = OVERVIEW_MIN_W + 'px';
    f.style.height = h / s + 'px';
    f.style.transform = `scale(${s})`;
  }

  function markActive(ov, nav, tocCurrent, title) {
    if (ov.active === title) return;
    ov.active = title;
    tocCurrent.textContent = title;
    nav.querySelectorAll('.ov-nav__item').forEach(b => {
      const on = b.dataset.title === title;
      b.setAttribute('aria-current', String(on));
      if (on) b.scrollIntoView({ block: 'nearest' });
    });
    if (state.sec !== title) { state.sec = title === ov.titles[0] ? '' : title; syncUrl(); }
  }

  function sectionsOf(ov) {
    if (ov.sections.size < ov.titles.length) ov.sections = findSections(overviewDoc(ov.f), ov.titles);
    return ov.sections;
  }

  function goToSection(ov, title) {
    const target = sectionsOf(ov).get(title);
    const doc = overviewDoc(ov.f);
    if (!target || !doc) return false;
    const se = doc.scrollingElement;
    se.scrollTop = target.getBoundingClientRect().top + se.scrollTop - 16;
    ov.markActive(title);
    return true;
  }

  function currentSection(ov) {
    let current = ov.titles[0];
    for (const [title, node] of sectionsOf(ov)) if (node.getBoundingClientRect().top <= 120) current = title;
    return current;
  }

  // Classic scrollbars take layout width; overlay ones (macOS, phones) take none and stay hidden until used.
  function hasClassicScrollbar(f) {
    const doc = overviewDoc(f);
    return !!doc && f.contentWindow.innerWidth - doc.documentElement.clientWidth > 0;
  }

  function wireOverview(ov) {
    ov.f.addEventListener('load', () => {
      const win = ov.f.contentWindow;
      let queued = false;
      const onScroll = () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; ov.markActive(currentSection(ov)); if (ov.rail) ov.rail.sync(); });
      };
      win.addEventListener('scroll', onScroll, { passive: true });
      win.addEventListener('resize', onScroll);
      // The overview's styles arrive with its render, so the scrollbar is measured once the sections exist.
      restoreSection(ov, () => {
        if (!ov.rail && (TOUCH_RAIL.matches || !hasClassicScrollbar(ov.f))) ov.rail = buildRail(ov.main, ov.f);
        onScroll();
      });
    });
  }

  // The overview renders after its own scripts load; wait for the section headings, then jump to ?sec=.
  function restoreSection(ov, onReady) {
    const wanted = state.sec;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      const ready = sectionsOf(ov).size === ov.titles.length;
      if (ready && (!wanted || goToSection(ov, wanted))) { clearInterval(timer); onReady(); }
      else if (tries > 100) { clearInterval(timer); onReady(); }
    }, 150);
    cleanup = () => clearInterval(timer);
  }

  // A drawn scroll bar for touch screens, where the iframe's own bar is hidden or too thin to grab.
  function buildRail(main, f) {
    const rail = el('div', 'rail');
    rail.setAttribute('aria-hidden', 'true');
    const track = el('div', 'rail__track');
    const thumb = el('div', 'rail__thumb');
    track.append(thumb);
    rail.append(track);
    main.append(rail);
    const se = () => overviewDoc(f)?.scrollingElement;
    const api = {
      sync() {
        const s = se();
        if (!s) return;
        const trackH = track.clientHeight;
        const ratio = s.clientHeight / Math.max(s.scrollHeight, 1);
        const thumbH = Math.max(40, trackH * ratio);
        const max = Math.max(s.scrollHeight - s.clientHeight, 1);
        thumb.style.height = thumbH + 'px';
        thumb.style.top = (trackH - thumbH) * (s.scrollTop / max) + 'px';
      },
    };
    wireRailDrag(rail, track, thumb, se, api);
    return api;
  }

  function wireRailDrag(rail, track, thumb, se, api) {
    const scrollTo = clientY => {
      const s = se();
      if (!s) return;
      const r = track.getBoundingClientRect();
      const thumbH = thumb.offsetHeight;
      const pos = Math.min(Math.max(clientY - r.top - thumbH / 2, 0), r.height - thumbH);
      s.scrollTop = pos / Math.max(r.height - thumbH, 1) * (s.scrollHeight - s.clientHeight);
      api.sync();
    };
    rail.addEventListener('pointerdown', e => {
      rail.setPointerCapture(e.pointerId);
      rail.classList.add('is-dragging');
      scrollTo(e.clientY);
    });
    rail.addEventListener('pointermove', e => { if (rail.classList.contains('is-dragging')) scrollTo(e.clientY); });
    const end = () => rail.classList.remove('is-dragging');
    rail.addEventListener('pointerup', end);
    rail.addEventListener('pointercancel', end);
  }

  // ---------- Render ----------

  function render() {
    cleanup();
    cleanup = () => {};
    refit = null;
    syncControls();
    syncUrl();
    const stage = $('stage');
    stage.querySelectorAll(':scope > :not(#loading)').forEach(node => node.remove());
    stage.classList.remove('is-nav-open');
    $('loading').hidden = false;
    if (state.view === 'all') return renderOverview(stage);
    if (state.view === 'screen') return renderScreen(stage);
    stage.className = 'stage stage--catalog';
    const ctx = { state, stage, el, copyText, setState, done: () => { $('loading').hidden = true; } };
    const view = state.view === 'icons' ? window.NaldaCatalog.renderIcons : window.NaldaCatalog.renderColors;
    view(ctx).catch(err => {
      $('loading').hidden = true;
      stage.append(el('p', 'catalog__empty', `데이터를 불러오지 못했습니다: ${err.message}`));
    });
  }

  // Catalog views update small bits of state (search, size) without a full re-render.
  function setState(patch) {
    Object.assign(state, patch);
    syncUrl();
  }

  function fillScreens() {
    const sel = $('screen');
    const groups = new Map();
    for (const s of data.screens) {
      if (!groups.has(s.group)) groups.set(s.group, []);
      groups.get(s.group).push(s);
    }
    for (const [group, list] of groups) {
      const og = document.createElement('optgroup');
      og.label = group;
      for (const s of list) og.append(new Option(`${s.id} · ${s.label}`, s.key));
      sel.append(og);
    }
  }

  function wireControls() {
    document.querySelectorAll('.bar .seg').forEach(seg => seg.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b || b.disabled || state[seg.dataset.key] === b.dataset.v) return;
      state[seg.dataset.key] = b.dataset.v;
      if (seg.dataset.key === 'theme' && (state.view === 'icons' || state.view === 'colors')) {
        syncControls();
        syncUrl();
        window.NaldaCatalog.setTheme(state.theme);
        return;
      }
      render();
    }));
    $('screen').addEventListener('change', e => { state.screen = e.target.value; render(); });
    $('prev').addEventListener('click', () => step(-1));
    $('next').addEventListener('click', () => step(1));
    document.addEventListener('keydown', onKey);
    let resizeT;
    window.addEventListener('resize', () => {
      clearTimeout(resizeT);
      // The overview only refits (reloading it would lose the scroll position, e.g. when a mobile URL bar hides).
      resizeT = setTimeout(() => { if (state.view === 'screen') render(); else if (refit) refit(); }, 200);
    });
  }

  function onKey(e) {
    const typing = ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName);
    if (e.key === '/' && !typing && (state.view === 'icons' || state.view === 'colors')) {
      e.preventDefault();
      document.querySelector('.search')?.focus();
      return;
    }
    if (e.key === 'Escape') $('stage').classList.remove('is-nav-open');
    if (state.view !== 'screen' || typing) return;
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  }

  const getJson = url => fetch(url).then(r => { if (!r.ok) throw new Error(`${url} ${r.status}`); return r.json(); });

  wireControls();
  Promise.allSettled([getJson('screens.json'), getJson('overview-groups.json')]).then(([s, g]) => {
    if (s.status === 'fulfilled') { data.screens = s.value; fillScreens(); }
    if (g.status === 'fulfilled') data.sections = g.value;
    render();
  });
})();
