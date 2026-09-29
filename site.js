// Nalda preview shell: state in the URL, the fixed top bar, screen ordering, the one-screen view and view routing.
(() => {
  'use strict';

  const DEFAULTS = { view: 'cover', p: 'ios', theme: 'White', size: 'auto', screen: 'home', sec: '', q: '', isz: '24' };
  const VIEWS = ['cover', 'flows', 'all', 'screen', 'icons', 'colors', 'appendix'];
  const SEARCH_VIEWS = ['all', 'icons', 'colors'];
  const BOTH_ONLY_SCREEN = '나란히는 한 화면 보기와 소개에서만 쓸 수 있어요';
  // Why a top-bar option does nothing in a view: { view: { field: reason } }; 'both' covers the 나란히 button only.
  const OFF = {
    flows: { both: BOTH_ONLY_SCREEN },
    all: { both: BOTH_ONLY_SCREEN },
    icons: { p: '아이콘은 iOS와 Android가 같은 SVG 파일을 써요', size: '글자 크기는 화면 미리보기에만 적용돼요' },
    colors: { p: '색상 표는 iOS와 Android 값을 한 줄에 함께 보여줘요', size: '글자 크기는 화면 미리보기에만 적용돼요' },
    appendix: {
      p: '부록은 글만 있어서 플랫폼을 고를 필요가 없어요',
      theme: '부록은 글만 있어서 테마를 고를 필요가 없어요',
      size: '부록은 글만 있어서 글자 크기를 고를 필요가 없어요',
    },
  };
  const F = window.NaldaFrames;
  const $ = id => document.getElementById(id);
  const q = new URLSearchParams(location.search);
  const state = Object.fromEntries(Object.entries(DEFAULTS).map(([k, v]) => [k, q.get(k) || v]));
  const data = { screens: [], byKey: new Map(), sections: [], content: null, flowsOf: new Map() };
  let cleanup = () => {};
  let onResize = null;

  if (!VIEWS.includes(state.view)) state.view = DEFAULTS.view;

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  const platforms = () => state.p === 'both' ? ['ios', 'android'] : [state.p];
  const platformName = p => p === 'ios' ? 'iOS' : 'Android';

  function syncUrl() {
    const out = new URLSearchParams();
    for (const [k, v] of Object.entries(state)) if (v !== DEFAULTS[k]) out.set(k, v);
    history.replaceState(null, '', out.toString() ? '?' + out : location.pathname);
  }

  // Keys that only mean something in one view are dropped when leaving it, so shared links stay short.
  function normalizeState() {
    if (OFF[state.view]?.both && state.p === 'both') state.p = 'ios';
    if (state.view !== 'all' && state.view !== 'flows') state.sec = '';
    if (!SEARCH_VIEWS.includes(state.view)) state.q = '';
    if (state.view !== 'icons') state.isz = DEFAULTS.isz;
    if (!data.byKey.has(state.screen) && data.screens.length) state.screen = data.screens[0].key;
  }

  // ---------- Top bar ----------

  function markOff(button, reason, whyId) {
    button.setAttribute('aria-disabled', String(!!reason));
    if (reason) {
      button.title = reason;
      button.setAttribute('aria-describedby', whyId);
    } else {
      button.removeAttribute('title');
      button.removeAttribute('aria-describedby');
    }
  }

  function syncControls() {
    normalizeState();
    const off = OFF[state.view] || {};
    document.querySelectorAll('.bar .seg').forEach(seg => {
      const key = seg.dataset.key;
      const why = $(`why-${key}`);
      const fieldReason = off[key] || '';
      seg.querySelectorAll('button').forEach(b => {
        b.setAttribute('aria-pressed', String(state[key] === b.dataset.v));
        if (!why) return;
        const reason = fieldReason || (key === 'p' && b.dataset.v === 'both' ? off.both || '' : '');
        markOff(b, reason, why.id);
      });
      if (why) why.textContent = fieldReason || (key === 'p' ? off.both || '' : '');
      seg.closest('.field').classList.toggle('is-off', !!fieldReason);
    });
  }

  function trackBarHeight() {
    const bar = $('bar');
    const set = () => document.documentElement.style.setProperty('--bar-h', bar.offsetHeight + 'px');
    new ResizeObserver(set).observe(bar);
    set();
  }

  // ---------- Toast + clipboard ----------

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

  // ---------- Screen data ----------

  const byCode = (a, b) => a.code.localeCompare(b.code, 'en', { numeric: true });

  // Section order from content.json; inside a section, representatives by code, each followed by its states.
  function orderScreens(screens, sections) {
    const ordered = [];
    for (const sec of sections) {
      const own = screens.filter(s => s.section === sec.id);
      const keys = new Set(own.map(s => s.key));
      const isChild = s => s.stateOf && keys.has(s.stateOf);
      for (const rep of own.filter(s => !isChild(s)).sort(byCode)) {
        ordered.push(rep);
        ordered.push(...own.filter(s => s.stateOf === rep.key).sort(byCode));
      }
      const placed = new Set(ordered.map(s => s.key));
      ordered.push(...own.filter(s => !placed.has(s.key)).sort(byCode));
    }
    return ordered;
  }

  function loadData(screens, content) {
    data.content = content;
    data.sections = content.sections;
    data.screens = orderScreens(screens, content.sections);
    data.byKey = new Map(data.screens.map(s => [s.key, s]));
    for (const flow of content.flows) {
      flow.steps.forEach((key, i) => {
        if (!data.flowsOf.has(key)) data.flowsOf.set(key, []);
        data.flowsOf.get(key).push({ flow, step: i + 1 });
      });
    }
  }

  // ---------- One screen ----------

  const SIDE_W = 320;

  function fitScale(stage) {
    const n = platforms().length;
    const wide = innerWidth > 960;
    const availW = (stage.clientWidth - 48 - (wide ? SIDE_W + 32 : 0) - (n - 1) * 24) / n;
    const availH = innerHeight - stage.getBoundingClientRect().top - 48 - 28;
    return Math.max(0.3, Math.min(1, availW / F.FRAME_W, Math.max(availH, 420) / F.FRAME_H));
  }

  function screenPicker() {
    const wrap = el('div', 'picker');
    const prev = el('button', 'icon-btn', '‹');
    prev.setAttribute('aria-label', '이전 화면 (←)');
    prev.title = '이전 화면 (←)';
    const next = el('button', 'icon-btn', '›');
    next.setAttribute('aria-label', '다음 화면 (→)');
    next.title = '다음 화면 (→)';
    const sel = el('select');
    sel.setAttribute('aria-label', '화면 고르기');
    for (const sec of data.sections) {
      const og = document.createElement('optgroup');
      og.label = `${sec.id} · ${sec.name}`;
      for (const s of data.screens.filter(x => x.section === sec.id)) og.append(new Option(`${s.code} · ${s.title}`, s.key));
      sel.append(og);
    }
    sel.value = state.screen;
    sel.addEventListener('change', () => go({ screen: sel.value }));
    prev.addEventListener('click', () => step(-1));
    next.addEventListener('click', () => step(1));
    wrap.append(prev, sel, next);
    return wrap;
  }

  function screenLink(s, prefix) {
    const b = el('button', 'link');
    b.append(el('span', 'code', s.code), document.createTextNode(` ${prefix || ''}${s.title}`));
    b.addEventListener('click', () => go({ screen: s.key }));
    return b;
  }

  function screenInfo(s) {
    const side = el('aside', 'one__side');
    side.append(screenPicker());
    const head = el('div', 'one__head');
    const meta = el('div', 'one__meta');
    meta.append(el('span', 'code code--lg', s.code), el('span', 'tag', s.since));
    if (s.stateOf) meta.append(el('span', 'tag tag--state', '상태'));
    meta.append(el('span', 'one__old', `옛 번호 ${s.id} · ${s.key}`));
    head.append(meta, el('h1', 'one__title', s.title));
    side.append(head);
    if (s.detail) side.append(el('p', 'one__detail', s.detail));
    side.append(...screenRelations(s));
    return side;
  }

  function relationBlock(title, nodes) {
    const box = el('div', 'one__rel');
    box.append(el('h2', 'one__h2', title));
    const list = el('ul', 'one__list');
    nodes.forEach(n => { const li = el('li'); li.append(n); list.append(li); });
    box.append(list);
    return box;
  }

  function screenRelations(s) {
    const blocks = [];
    const parent = s.stateOf && data.byKey.get(s.stateOf);
    if (parent) blocks.push(relationBlock('이 상태의 기본 화면', [screenLink(parent)]));
    const kids = data.screens.filter(x => x.stateOf === s.key);
    if (kids.length) blocks.push(relationBlock(`상태 ${kids.length}개`, kids.map(k => screenLink(k))));
    const flows = data.flowsOf.get(s.key) || [];
    if (flows.length) {
      blocks.push(relationBlock('핵심 흐름', flows.map(({ flow, step: n }) => {
        const b = el('button', 'link', `${flow.title} · ${n}단계`);
        b.addEventListener('click', () => go({ view: 'flows', sec: flow.id }));
        return b;
      })));
    }
    const back = el('button', 'link link--muted', '전체 화면에서 이 화면 찾기');
    back.addEventListener('click', () => go({ view: 'all', sec: s.section, q: '' }, { focusKey: s.key }));
    blocks.push(back);
    return blocks;
  }

  function renderScreen(stage) {
    stage.className = 'stage stage--screen';
    const s = data.byKey.get(state.screen);
    const phones = el('div', 'one__phones');
    const apply = () => phones.style.setProperty('--scale', fitScale(stage).toFixed(3));
    for (const p of platforms()) {
      const box = F.phone(F.frameUrl(p, s.key, state.theme, state.size), `${s.code} ${s.title} — ${platformName(p)}`);
      const wrap = el('figure', 'one__phone');
      wrap.append(box, el('figcaption', 'one__label', platformName(p)));
      phones.append(wrap);
      F.mountNow(box).then(done);
    }
    stage.append(screenInfo(s), phones);
    apply();
    onResize = apply;
  }

  function step(delta) {
    const list = data.screens;
    const i = list.findIndex(s => s.key === state.screen);
    const next = list[(i + delta + list.length) % list.length];
    if (next) go({ screen: next.key });
  }

  // ---------- Render ----------

  function done() { $('loading').hidden = true; }

  function fail(stage, err) {
    done();
    const box = el('div', 'error');
    box.append(el('h1', '', '데이터를 불러오지 못했습니다'), el('p', 'mono', String(err?.message || err)));
    stage.append(box);
    console.error('Nalda preview:', err);
  }

  function render(opts = {}) {
    cleanup();
    cleanup = () => {};
    onResize = null;
    syncControls();
    syncUrl();
    const stage = $('stage');
    stage.querySelectorAll(':scope > :not(#loading)').forEach(node => node.remove());
    $('loading').hidden = false;
    if (!opts.keepScroll) scrollTo(0, 0);
    if (!data.content) return;
    const ctx = { state, data, stage, el, copyText, toast, setState, go, done, platformName, opts,
      setCleanup: fn => { cleanup = fn; }, setResize: fn => { onResize = fn; } };
    try {
      const out = VIEWS_RENDER[state.view](ctx);
      if (out && out.catch) out.catch(err => fail(stage, err));
    } catch (err) {
      fail(stage, err);
    }
  }

  const VIEWS_RENDER = {
    cover: ctx => window.NaldaDocs.renderCover(ctx),
    appendix: ctx => window.NaldaDocs.renderAppendix(ctx),
    flows: ctx => window.NaldaGrid.renderFlows(ctx),
    all: ctx => window.NaldaGrid.renderAll(ctx),
    screen: ctx => renderScreen(ctx.stage),
    icons: ctx => window.NaldaCatalog.renderIcons(ctx),
    colors: ctx => window.NaldaCatalog.renderColors(ctx),
  };

  // Views update small bits of state (search, section, size) without a full re-render.
  function setState(patch) {
    Object.assign(state, patch);
    syncUrl();
  }

  function go(patch, opts) {
    Object.assign(state, patch);
    render(opts);
  }

  // ---------- Wiring ----------

  function onSegClick(seg, e) {
    const b = e.target.closest('button');
    const key = seg.dataset.key;
    if (!b || b.getAttribute('aria-disabled') === 'true' || state[key] === b.dataset.v) return;
    state[key] = b.dataset.v;
    if (key === 'theme' && (state.view === 'icons' || state.view === 'colors')) {
      syncControls();
      syncUrl();
      window.NaldaCatalog.setTheme(state.theme);
      return;
    }
    render({ keepScroll: key !== 'view' });
  }

  function wireControls() {
    document.querySelectorAll('.bar .seg').forEach(seg => seg.addEventListener('click', e => onSegClick(seg, e)));
    const more = $('more');
    more.addEventListener('click', () => {
      const open = more.getAttribute('aria-expanded') !== 'true';
      more.setAttribute('aria-expanded', String(open));
      $('bar').classList.toggle('is-open', open);
    });
    document.addEventListener('keydown', onKey);
    let resizeT;
    window.addEventListener('resize', () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(() => onResize?.(), 150);
    });
  }

  function onKey(e) {
    const typing = ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable;
    if (e.key === '/' && !typing && SEARCH_VIEWS.includes(state.view)) {
      e.preventDefault();
      document.querySelector('.search')?.focus();
      return;
    }
    if (e.key === 'Escape') {
      document.body.classList.remove('is-nav-open');
      $('bar').classList.remove('is-open');
      $('more').setAttribute('aria-expanded', 'false');
    }
    if (state.view !== 'screen' || typing || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  }

  const getJson = url => fetch(url).then(r => {
    if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
    return r.json();
  });

  trackBarHeight();
  wireControls();
  syncControls();
  Promise.all([getJson('screens.json'), getJson('content.json')])
    .then(([screens, content]) => { loadData(screens, content); render({ keepScroll: true }); })
    .catch(err => fail($('stage'), err));
})();
