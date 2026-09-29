// Nalda preview: the text views of content.json — 소개 (cover, the landing page) and 부록 (changelog, glossary, codes).
(() => {
  'use strict';

  const F = window.NaldaFrames;
  const HERO_KEY = 'home';

  // Text with `code` spans: backtick runs become <code>, everything else stays plain text.
  function rich(ctx, tag, cls, text) {
    const node = ctx.el(tag, cls);
    String(text).split('`').forEach((part, i) => {
      if (!part) return;
      node.append(i % 2 ? ctx.el('code', '', part) : document.createTextNode(part));
    });
    return node;
  }

  function list(ctx, cls, items, ordered) {
    const ul = ctx.el(ordered ? 'ol' : 'ul', cls);
    items.forEach(text => ul.append(rich(ctx, 'li', '', text)));
    return ul;
  }

  function button(ctx, cls, text, patch) {
    const b = ctx.el('button', cls, text);
    b.addEventListener('click', () => ctx.go(patch));
    return b;
  }

  // ---------- 소개 ----------

  function heroPhones(ctx) {
    const wrap = ctx.el('div', 'hero__phones');
    const screen = ctx.data.byKey.get(HERO_KEY) || ctx.data.screens[0];
    const platforms = ctx.state.p === 'both' ? ['ios', 'android'] : [ctx.state.p];
    wrap.classList.toggle('hero__phones--two', platforms.length > 1);
    for (const p of platforms) {
      const fig = ctx.el('figure', 'hero__phone');
      const box = F.phone(F.frameUrl(p, screen.key, ctx.state.theme, ctx.state.size), `${screen.title} — ${ctx.platformName(p)}`);
      const open = ctx.el('button', 'card__phone');
      open.setAttribute('aria-label', `${screen.code} ${screen.title} — 한 화면으로 크게 보기`);
      open.addEventListener('click', () => ctx.go({ view: 'screen', screen: screen.key }));
      open.append(box);
      fig.append(open);
      wrap.append(fig);
      F.mountNow(box);
    }
    return wrap;
  }

  function hero(ctx, cover) {
    const { el } = ctx;
    const text = el('div', 'hero__text');
    text.append(rich(ctx, 'h1', 'hero__title', cover.title), rich(ctx, 'p', 'hero__lead', cover.oneLiner),
      rich(ctx, 'p', 'hero__purpose', cover.purpose));
    const actions = el('div', 'hero__actions');
    actions.append(button(ctx, 'btn btn--primary', '핵심 흐름부터 보기', { view: 'flows' }),
      button(ctx, 'btn', `전체 화면 ${ctx.data.screens.length}개`, { view: 'all' }));
    text.append(actions);
    const node = el('section', 'hero');
    node.append(text, heroPhones(ctx));
    return node;
  }



  function flowLinks(ctx) {
    const { el } = ctx;
    const flows = ctx.data.content.flows;
    const node = el('section', 'block');
    node.append(el('h2', 'block__title', '핵심 흐름'));
    const grid = el('div', 'flow-links');
    flows.forEach((f, i) => {
      const b = el('button', 'flow-link');
      b.append(el('span', 'flow-link__num', String(i + 1)), el('span', 'flow-link__title', f.title));
      b.addEventListener('click', () => ctx.go({ view: 'flows', sec: f.id }));
      grid.append(b);
    });
    node.append(grid);
    return node;
  }


  function renderCover(ctx) {
    const cover = ctx.data.content.cover;
    ctx.stage.className = 'stage stage--doc';
    const main = ctx.el('div', 'doc-main doc-main--cover');
    main.append(hero(ctx, cover), flowLinks(ctx));
    ctx.stage.append(main);
    ctx.done();
  }

  // ---------- 부록 ----------

  function changelog(ctx) {
    const { el } = ctx;
    const node = el('section', 'block');
    node.id = 'changelog';
    node.append(el('h2', 'block__title', '변경 기록'));
    for (const entry of ctx.data.content.changelog) {
      const item = el('article', 'release');
      const head = el('h3', 'release__title', entry.version);
      if (entry.date) head.append(el('span', 'release__date', entry.date));
      item.append(head, list(ctx, 'release__items', entry.items));
      node.append(item);
    }
    return node;
  }

  function glossary(ctx) {
    const { el } = ctx;
    const node = el('section', 'block');
    node.id = 'glossary';
    node.append(el('h2', 'block__title', '용어'));
    const dl = el('dl', 'glossary');
    for (const g of ctx.data.content.glossary) dl.append(rich(ctx, 'dt', '', g.term), rich(ctx, 'dd', '', g.meaning));
    node.append(dl);
    return node;
  }

  function codeRow(ctx, s, sectionName) {
    const tr = ctx.el('tr');
    const title = ctx.el('td');
    title.append(button(ctx, 'link', s.title, { view: 'screen', screen: s.key }));
    if (s.stateOf) title.append(ctx.el('span', 'tag tag--state', '상태'));
    tr.append(ctx.el('td', 'code', s.code), title, ctx.el('td', 'mono', s.id), ctx.el('td', 'mono', s.key),
      ctx.el('td', '', sectionName), ctx.el('td', '', s.since));
    return tr;
  }

  function codeTable(ctx) {
    const { el } = ctx;
    const node = el('section', 'block');
    node.id = 'codes';
    node.append(el('h2', 'block__title', '화면 코드 표'),
      el('p', 'block__lead', '새 코드(TL-01)와 옛 번호(1a), 프로토타입 키를 한눈에 맞춰 볼 수 있습니다.'));
    const wrap = el('div', 'table-wrap');
    const table = el('table', 'codes');
    const head = el('tr');
    ['코드', '제목', '옛 번호', '키', '섹션', '버전'].forEach(t => head.append(el('th', '', t)));
    const thead = el('thead');
    thead.append(head);
    const body = el('tbody');
    const names = new Map(ctx.data.sections.map(s => [s.id, s.name]));
    ctx.data.screens.forEach(s => body.append(codeRow(ctx, s, names.get(s.section))));
    table.append(thead, body);
    wrap.append(table);
    node.append(wrap);
    return node;
  }

  function appendixIndex(ctx) {
    const nav = ctx.el('nav', 'flow-index');
    nav.setAttribute('aria-label', '부록 목차');
    for (const [id, label] of [['changelog', '변경 기록'], ['glossary', '용어'], ['codes', '화면 코드 표']]) {
      const b = ctx.el('button', 'chip', label);
      b.addEventListener('click', () => {
        const target = document.getElementById(id);
        window.scrollTo({ top: target.getBoundingClientRect().top + scrollY - document.getElementById('bar').offsetHeight - 16 });
      });
      nav.append(b);
    }
    return nav;
  }

  function renderAppendix(ctx) {
    const { el } = ctx;
    ctx.stage.className = 'stage stage--doc';
    const main = el('div', 'doc-main doc-main--appendix');
    const head = el('header', 'page-head');
    head.append(el('h1', 'page-head__title', '부록'), el('p', 'page-head__lead', '버전별로 바뀐 점, 문서에 나오는 용어, 화면 코드 대응표입니다.'),
      appendixIndex(ctx));
    main.append(head, changelog(ctx), glossary(ctx), codeTable(ctx));
    ctx.stage.append(main);
    ctx.done();
  }

  window.NaldaDocs = { renderCover, renderAppendix };
})();
