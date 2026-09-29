// Nalda preview: the screen cards, the 전체 화면 grid (sections, search, side navigation, scroll-spy)
// and the 핵심 흐름 rows. Phones load through the lazy frame pool of frames.js.
(() => {
  'use strict';

  const F = window.NaldaFrames;
  const norm = s => (s || '').toLowerCase();

  // ---------- Cards ----------

  function card(ctx, s, pool) {
    const { el } = ctx;
    const node = el('article', 'card');
    node.id = `card-${s.key}`;
    node.dataset.key = s.key;
    if (s.stateOf) node.classList.add('card--state');
    const open = el('button', 'card__phone');
    open.setAttribute('aria-label', `${s.code} ${s.title} — 한 화면으로 크게 보기`);
    const p = ctx.state.p === 'android' ? 'android' : 'ios';
    const box = F.phone(F.frameUrl(p, s.key, ctx.state.theme, ctx.state.size), `${s.code} ${s.title}`, s);
    open.append(box);
    open.addEventListener('click', () => ctx.go({ view: 'screen', screen: s.key }));
    pool.observe(box);
    node.append(open, cardMeta(ctx, s), cardTitle(ctx, s));
    if (s.detail) node.append(cardDetail(ctx, s));
    node.dataset.search = norm([s.code, s.title, s.key, s.id, s.detail].join(' '));
    return node;
  }

  function cardMeta(ctx, s) {
    const { el } = ctx;
    const meta = el('div', 'card__meta');
    meta.append(el('span', 'code', s.code), el('span', 'tag', s.since));
    if (s.stateOf) {
      const tag = el('span', 'tag tag--state', '상태');
      const parent = ctx.data.byKey.get(s.stateOf);
      if (parent) tag.title = `${parent.code} ${parent.title}의 상태`;
      meta.append(tag);
    }
    const old = el('span', 'card__old', s.id);
    old.title = `옛 번호 ${s.id} · 프로토타입 키 ${s.key}`;
    meta.append(old);
    return meta;
  }

  function cardTitle(ctx, s) {
    const h = ctx.el('h3', 'card__title');
    const b = ctx.el('button', 'card__link', s.title);
    b.title = s.title;
    b.addEventListener('click', () => ctx.go({ view: 'screen', screen: s.key }));
    h.append(b);
    return h;
  }

  function cardDetail(ctx, s) {
    const d = ctx.el('details', 'card__more');
    d.append(ctx.el('summary', '', '자세히'), ctx.el('p', '', s.detail));
    return d;
  }

  function flash(node) {
    node.classList.remove('is-flash');
    void node.offsetWidth;
    node.classList.add('is-flash');
  }

  function stickyOffset() {
    const bar = document.getElementById('bar').offsetHeight;
    const tool = document.querySelector('.toolbar')?.offsetHeight || 0;
    return bar + tool + 12;
  }

  function scrollToNode(node, smooth) {
    const top = node.getBoundingClientRect().top + scrollY - stickyOffset();
    window.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' });
  }

  function makePool(ctx) {
    const pool = F.createPool();
    window.__naldaPool = pool;
    ctx.setCleanup(() => { pool.destroy(); document.body.classList.remove('is-nav-open'); });
    return pool;
  }

  // ---------- 전체 화면: side navigation ----------

  function navSection(ctx, sec, screens, onPick) {
    const { el } = ctx;
    const li = el('li', 'side__sec');
    li.dataset.sec = sec.id;
    const row = el('div', 'side__row');
    const go = el('button', 'side__item');
    go.append(el('span', 'code', sec.id), el('span', 'side__name', sec.name), el('span', 'side__count', String(screens.length)));
    go.addEventListener('click', () => onPick({ sec: sec.id }));
    const toggle = el('button', 'side__toggle');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', `${sec.name} 화면 목록 펼치기`);
    const list = el('ul', 'side__screens');
    list.id = `side-list-${sec.id}`;
    list.hidden = true;
    toggle.setAttribute('aria-controls', list.id);
    toggle.addEventListener('click', () => {
      const openNow = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(openNow));
      list.hidden = !openNow;
    });
    for (const s of screens) list.append(navScreen(ctx, s, onPick));
    row.append(go, toggle);
    li.append(row, list);
    return li;
  }

  function navScreen(ctx, s, onPick) {
    const li = ctx.el('li');
    li.dataset.key = s.key;
    const b = ctx.el('button', s.stateOf ? 'side__screen side__screen--state' : 'side__screen');
    b.append(ctx.el('span', 'code', s.code), ctx.el('span', '', s.title));
    b.addEventListener('click', () => onPick({ key: s.key }));
    li.append(b);
    return li;
  }

  function sideNav(ctx, groups, onPick) {
    const { el } = ctx;
    const nav = el('nav', 'side');
    nav.id = 'side';
    nav.setAttribute('aria-label', '섹션');
    const head = el('div', 'side__head');
    const close = el('button', 'icon-btn side__close', '×');
    close.setAttribute('aria-label', '목차 닫기');
    close.addEventListener('click', () => document.body.classList.remove('is-nav-open'));
    head.append(el('span', 'side__title', `섹션 ${groups.length} · 화면 ${ctx.data.screens.length}`), close);
    const list = el('ul', 'side__list');
    groups.forEach(g => list.append(navSection(ctx, g.sec, g.screens, onPick)));
    nav.append(head, list);
    return nav;
  }

  // ---------- 전체 화면: search ----------

  function applySearch(view, needle) {
    let shown = 0;
    for (const g of view.groups) {
      let n = 0;
      for (const c of g.cards) {
        const hit = !needle || c.dataset.search.includes(needle);
        c.hidden = !hit;
        view.side.querySelector(`li[data-key="${c.dataset.key}"]`).hidden = !hit;
        if (hit) n += 1;
      }
      g.node.hidden = n === 0;
      g.count.textContent = needle ? `${n} / ${g.cards.length}` : `${g.cards.length}개`;
      view.side.querySelector(`.side__sec[data-sec="${g.sec.id}"]`).classList.toggle('is-empty', n === 0);
      shown += n;
    }
    const visible = view.groups.filter(g => !g.node.hidden);
    view.groups.forEach(g => g.node.classList.toggle('is-last', g === visible[visible.length - 1]));
    view.meta.textContent = needle ? `${shown}개 찾음 · 전체 ${view.total}개` : `화면 ${view.total}개`;
    view.meta.parentElement.classList.toggle('is-searching', !!needle);
    view.empty.hidden = shown > 0;
    view.pool.refresh();
    view.spy();
  }

  function searchBar(ctx, view) {
    const { el } = ctx;
    const bar = el('div', 'toolbar');
    const toc = el('button', 'toolbar__toc', '목차');
    toc.setAttribute('aria-controls', 'side');
    toc.addEventListener('click', () => document.body.classList.add('is-nav-open'));
    const input = el('input', 'search');
    input.type = 'search';
    input.value = ctx.state.q;
    input.placeholder = '코드 · 제목 · 키 · 옛 번호 · 설명으로 찾기 ( / )';
    input.setAttribute('aria-label', '화면 찾기');
    let t;
    input.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => { ctx.setState({ q: input.value.trim() }); applySearch(view, norm(input.value.trim())); }, 80);
    });
    view.meta = el('span', 'toolbar__meta');
    bar.append(toc, input, view.meta, el('span', 'toolbar__hint', '카드를 누르면 한 화면으로 크게 봅니다'));
    return bar;
  }

  // ---------- 전체 화면: scroll-spy ----------

  // The active section is the last one whose heading has passed the line 30% down the viewport (never
  // above the sticky bars). An IntersectionObserver whose box ends at that line tells when a heading crosses it.
  function wireSpy(ctx, view) {
    let io = null;
    const line = () => Math.max(innerHeight * 0.3, stickyOffset() + 24);
    const compute = () => {
      const visible = view.groups.filter(g => !g.node.hidden);
      let active = visible[0];
      for (const g of visible) if (g.head.getBoundingClientRect().top <= line()) active = g;
      if (active) markActive(ctx, view, active.sec.id);
    };
    const observe = () => {
      io?.disconnect();
      io = new IntersectionObserver(compute, { rootMargin: `0px 0px -${Math.round(innerHeight - line())}px 0px`, threshold: [0, 1] });
      view.groups.forEach(g => io.observe(g.head));
    };
    observe();
    view.spy = compute;
    ctx.setResize(() => { observe(); compute(); });
    return () => io?.disconnect();
  }

  // Scroll only the side list (scrollIntoView would also move the page, fighting the reader's scroll).
  function revealInList(list, item) {
    const top = item.offsetTop;
    if (top < list.scrollTop) list.scrollTop = top - 8;
    else if (top + item.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = top + item.offsetHeight - list.clientHeight + 8;
  }

  function markActive(ctx, view, id) {
    if (view.active === id) return;
    view.active = id;
    view.side.querySelectorAll('.side__sec').forEach(li => {
      const on = li.dataset.sec === id;
      li.querySelector('.side__item').setAttribute('aria-current', on ? 'location' : 'false');
      if (on) revealInList(view.side.querySelector('.side__list'), li);
    });
    view.tocCurrent.textContent = view.groups.find(g => g.sec.id === id)?.sec.name || '';
    const sec = id === view.groups[0].sec.id ? '' : id;
    if (ctx.state.sec !== sec) ctx.setState({ sec });
  }

  // ---------- 전체 화면 ----------

  function sectionGroups(ctx) {
    return ctx.data.sections
      .map(sec => ({ sec, screens: ctx.data.screens.filter(s => s.section === sec.id) }))
      .filter(g => g.screens.length);
  }

  function sectionNode(ctx, g, pool) {
    const { el } = ctx;
    const node = el('section', 'gsec');
    node.id = `sec-${g.sec.id}`;
    node.setAttribute('aria-labelledby', `sec-h-${g.sec.id}`);
    const head = el('header', 'gsec__head');
    const h = el('h2', 'gsec__title');
    h.id = `sec-h-${g.sec.id}`;
    h.append(el('span', 'code', g.sec.id), document.createTextNode(` ${g.sec.name}`));
    const count = el('span', 'gsec__count');
    head.append(h, count, el('p', 'gsec__summary', g.sec.summary));
    const grid = el('div', 'cards');
    const cards = g.screens.map(s => card(ctx, s, pool));
    grid.append(...cards);
    node.append(head, grid);
    return { ...g, node, head, count, cards };
  }

  function onPickFactory(view) {
    return ({ sec, key }) => {
      document.body.classList.remove('is-nav-open');
      if (key) {
        const c = document.getElementById(`card-${key}`);
        if (c && !c.hidden) { scrollToNode(c, false); flash(c); }
        return;
      }
      const g = view.groups.find(x => x.sec.id === sec);
      if (g && !g.node.hidden) scrollToNode(g.node, false);
    };
  }

  function renderAll(ctx) {
    const { el, stage } = ctx;
    stage.className = 'stage stage--all';
    const pool = makePool(ctx);
    const groups = sectionGroups(ctx);
    // Read before the first scroll-spy pass, which rewrites ?sec= to the section at the top.
    const target = { key: ctx.opts.focusKey, sec: ctx.state.sec };
    const view = { pool, active: '', total: ctx.data.screens.length, spy: () => {} };
    view.groups = groups.map(g => sectionNode(ctx, g, pool));
    view.side = sideNav(ctx, groups, onPickFactory(view));
    const main = el('div', 'doc-main');
    const bar = searchBar(ctx, view);
    view.tocCurrent = el('span', 'toolbar__current');
    bar.querySelector('.toolbar__toc').append(view.tocCurrent);
    view.empty = el('p', 'empty', '찾는 화면이 없습니다. 코드(TL-01), 제목, 키, 옛 번호(1a)로 찾아 보세요.');
    main.append(bar, ...view.groups.map(g => g.node), view.empty);
    const scrim = el('div', 'side-scrim');
    scrim.addEventListener('click', () => document.body.classList.remove('is-nav-open'));
    stage.append(view.side, scrim, main);
    const stopSpy = wireSpy(ctx, view);
    ctx.setCleanup(() => { stopSpy(); pool.destroy(); document.body.classList.remove('is-nav-open'); });
    applySearch(view, norm(ctx.state.q));
    restorePosition(view, target);
    ctx.done();
  }

  function restorePosition(view, target) {
    if (!target.key && !target.sec) return;
    requestAnimationFrame(() => {
      onPickFactory(view)(target.key ? { key: target.key } : { sec: target.sec });
      view.spy();
    });
  }

  // ---------- 핵심 흐름 ----------

  function flowNode(ctx, flow, index, pool) {
    const { el } = ctx;
    const node = el('section', 'flow');
    node.id = `flow-${flow.id}`;
    const head = el('header', 'flow__head');
    head.append(el('span', 'flow__num', String(index + 1)), el('h2', 'flow__title', flow.title),
      el('span', 'flow__count', `${flow.steps.length}단계`), el('p', 'flow__summary', flow.summary));
    const list = el('ol', 'flow__steps');
    list.setAttribute('aria-label', `${flow.title} 단계`);
    flow.steps.forEach((key, i) => {
      const s = ctx.data.byKey.get(key);
      const li = el('li', 'flow__step');
      li.append(el('span', 'flow__stepnum', `${i + 1}단계`), card(ctx, s, pool));
      list.append(li);
    });
    node.append(head, list);
    return node;
  }

  function flowIndex(ctx) {
    const nav = ctx.el('nav', 'flow-index');
    nav.setAttribute('aria-label', '핵심 흐름 목록');
    ctx.data.content.flows.forEach((f, i) => {
      const b = ctx.el('button', 'chip');
      b.append(ctx.el('span', 'chip__num', String(i + 1)), document.createTextNode(f.title));
      b.addEventListener('click', () => {
        ctx.setState({ sec: f.id });
        scrollToNode(document.getElementById(`flow-${f.id}`), false);
      });
      nav.append(b);
    });
    return nav;
  }

  function renderFlows(ctx) {
    const { el, stage } = ctx;
    stage.className = 'stage stage--flows';
    const pool = makePool(ctx);
    const flows = ctx.data.content.flows;
    const main = el('div', 'doc-main doc-main--flows');
    const intro = el('header', 'page-head');
    intro.append(el('h1', 'page-head__title', `핵심 흐름 ${flows.length}개`),
      el('p', 'page-head__lead', '사용자가 가장 자주 지나는 길을 단계 순서대로 늘어놓았습니다. 옆으로 밀어 다음 단계를 보고, 카드를 누르면 크게 봅니다.'),
      flowIndex(ctx));
    main.append(intro, ...flows.map((f, i) => flowNode(ctx, f, i, pool)));
    stage.append(main);
    const target = ctx.state.sec && document.getElementById(`flow-${ctx.state.sec}`);
    if (target) requestAnimationFrame(() => scrollToNode(target, false));
    ctx.done();
  }

  window.NaldaGrid = { renderAll, renderFlows };
})();
