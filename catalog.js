// Nalda preview: icon gallery (icons.json) and color tokens (tokens.json). Used by site.js.
(() => {
  'use strict';

  const THEMES = ['White', 'Dim', 'Black'];
  const SIZES = ['16', '20', '24', '32'];
  const cache = {};
  let current = { root: null, kind: '' };

  const load = url => (cache[url] ||= fetch(url).then(r => {
    if (!r.ok) throw new Error(`${url} ${r.status}`);
    return r.json();
  }));

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  const norm = s => (s || '').toLowerCase().replace(/`/g, '');

  function searchBox(ctx, placeholder, onInput) {
    const input = el('input', 'search');
    input.type = 'search';
    input.placeholder = placeholder;
    input.value = ctx.state.q;
    input.setAttribute('aria-label', placeholder);
    input.addEventListener('input', () => { ctx.setState({ q: input.value.trim() }); onInput(); });
    return input;
  }

  function copyButton(ctx, text, cls, label) {
    const b = el('button', `copy ${cls || ''}`.trim(), label ?? text);
    b.title = `${text} 복사`;
    b.addEventListener('click', () => ctx.copyText(text));
    return b;
  }

  function section(title, count) {
    const s = el('section', 'catalog__section');
    const h = el('h2', 'catalog__h2', title);
    if (count !== undefined) h.append(el('small', '', String(count)));
    s.append(h);
    return s;
  }

  // ---------- Theme colors used by the icon tiles ----------

  function themeGround(tokens) {
    const pick = id => tokens.groups.flatMap(g => g.tokens).find(t => t.id === id)?.values.ios;
    const bg = pick('background'), fg = pick('foreground');
    return Object.fromEntries(THEMES.map(t => [t, { bg: bg?.[t]?.hex || '#FFFFFF', fg: fg?.[t]?.hex || '#0F1419' }]));
  }

  function applyTheme(theme) {
    if (!current.root) return;
    if (current.kind === 'icons') {
      const g = current.ground[theme];
      current.root.style.setProperty('--tile-bg', g.bg);
      current.root.style.setProperty('--tile-fg', g.fg);
      return;
    }
    const col = THEMES.indexOf(theme);
    current.root.querySelectorAll('[data-col]').forEach(c => c.classList.toggle('is-active', Number(c.dataset.col) === col));
  }

  // ---------- Icons ----------

  function glyph(ctx, svgs, file, kind) {
    const b = el('button', 'glyph');
    b.title = `${file} 복사`;
    b.setAttribute('aria-label', `${file} 파일 이름 복사`);
    const box = el('span', 'glyph__box');
    box.innerHTML = svgs[file] || '';
    b.append(box);
    if (kind) b.append(el('span', 'glyph__kind', kind));
    b.addEventListener('click', () => ctx.copyText(file));
    return b;
  }

  function iconTile(ctx, svgs, item) {
    const tile = el('article', 'icon-tile');
    const glyphs = el('div', 'icon-tile__glyphs');
    glyphs.style.cssText = 'background:var(--tile-bg);color:var(--tile-fg)';
    const pair = item.files.length > 1;
    item.files.forEach((f, i) => glyphs.append(glyph(ctx, svgs, f, pair ? (i === 0 ? '기본' : '채움') : '')));
    const body = el('div', 'icon-tile__body');
    body.append(item.key ? el('span', 'icon-tile__key', item.key) : el('span', 'icon-tile__key icon-tile__key--none', '키 없음'));
    if (item.label) body.append(el('span', 'icon-tile__label', item.label.replace(/`/g, '')));
    body.append(el('span', 'icon-tile__files', item.files.join(' · ')));
    tile.append(glyphs, body);
    tile.dataset.search = norm([item.key, item.label, ...item.files].join(' '));
    return tile;
  }

  function sizeSeg(ctx, root) {
    const seg = el('div', 'seg');
    seg.setAttribute('aria-label', '아이콘 크기');
    for (const size of SIZES) {
      const b = el('button', '', size);
      b.dataset.v = size;
      b.setAttribute('aria-pressed', String(ctx.state.isz === size));
      seg.append(b);
    }
    seg.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      ctx.setState({ isz: b.dataset.v });
      root.style.setProperty('--glyph', b.dataset.v + 'px');
      seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    });
    return seg;
  }

  function filterTiles(root, q, meta, total) {
    const needle = norm(q);
    let shown = 0;
    root.querySelectorAll('.catalog__section').forEach(sec => {
      let n = 0;
      const title = norm(sec.dataset.title);
      sec.querySelectorAll('.icon-tile').forEach(tile => {
        const hit = !needle || tile.dataset.search.includes(needle) || title.includes(needle);
        tile.hidden = !hit;
        if (hit) n += 1;
      });
      sec.hidden = n === 0;
      shown += n;
    });
    meta.textContent = needle ? `${shown}개 찾음 / ${total}개` : `${total}개 타일`;
    root.querySelector('.catalog__empty').hidden = shown > 0;
  }

  async function renderIcons(ctx) {
    const [icons, tokens] = await Promise.all([load('icons.json'), load('tokens.json')]);
    const root = el('div', 'catalog');
    root.style.setProperty('--glyph', ctx.state.isz + 'px');
    current = { root, kind: 'icons', ground: themeGround(tokens) };
    const bar = el('div', 'catalog__toolbar');
    const meta = el('span', 'catalog__meta');
    const files = Object.keys(icons.svgs).length;
    const refilter = () => filterTiles(root, ctx.state.q, meta, total);
    bar.append(searchBox(ctx, '키 · 이름 · 파일 이름으로 찾기 ( / )', refilter), sizeSeg(ctx, root), meta,
      el('span', 'catalog__hint', `SVG ${files}개 · 아이콘을 누르면 파일 이름 복사`));
    root.append(bar);
    let total = 0;
    for (const s of icons.sections) {
      const sec = section(s.title, s.items.length);
      sec.dataset.title = s.title;
      const grid = el('div', 'icons');
      s.items.forEach(item => grid.append(iconTile(ctx, icons.svgs, item)));
      total += s.items.length;
      sec.append(grid);
      root.append(sec);
    }
    root.append(el('p', 'catalog__empty', '찾는 아이콘이 없습니다.'));
    ctx.stage.append(root);
    applyTheme(ctx.state.theme);
    refilter();
    ctx.done();
  }

  // ---------- Colors ----------

  const pct = a => `${Math.round(a * 100)}%`;
  const cssColor = c => {
    const h = c.hex.slice(1);
    const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
    return c.alpha >= 1 ? c.hex : `rgba(${r}, ${g}, ${b}, ${c.alpha})`;
  };
  const sameColor = (a, b) => !a || !b ? a === b : a.hex === b.hex && Math.abs(a.alpha - b.alpha) < 0.005;

  function swatch(c) {
    const s = el('div', c ? 'swatch' : 'swatch swatch--none');
    if (c) { const i = el('i'); i.style.background = cssColor(c); s.append(i); }
    return s;
  }

  function valueLine(ctx, c, tag, alt) {
    const line = el('div', alt ? 'value value--alt' : 'value');
    if (tag) line.append(el('span', 'value__tag', tag));
    if (!c) { line.append(el('span', '', '—')); return line; }
    line.append(copyButton(ctx, c.hex));
    if (c.alpha < 1) line.append(el('small', '', `불투명도 ${pct(c.alpha)}`));
    return line;
  }

  // The swatch shows the iOS (Swift) value; Android and the prototypes are listed only where they differ.
  function colorCell(ctx, token, theme, col) {
    const v = token.values;
    const main = v.ios?.[theme] || v.android?.[theme] || v.protoIos?.[theme] || v.protoAndroid?.[theme] || null;
    const cell = el('div', 'ct__cell');
    cell.dataset.col = col;
    cell.append(el('span', 'ct__theme-label', theme), swatch(main));
    const ios = v.ios?.[theme], and = v.android?.[theme];
    if (ios && and && !sameColor(ios, and)) {
      cell.append(valueLine(ctx, ios, 'iOS'), valueLine(ctx, and, 'Android', true));
    } else {
      cell.append(valueLine(ctx, main, !ios && !and ? '프로토타입' : ''));
    }
    for (const [key, tag] of [['protoIos', '프로토 iOS'], ['protoAndroid', '프로토 Android']]) {
      const p = v[key]?.[theme];
      if (p && main && (ios || and) && !sameColor(p, key === 'protoIos' ? (ios || and) : (and || ios))) cell.append(valueLine(ctx, p, tag, true));
    }
    return cell;
  }

  function nameLine(ctx, label, value) {
    const span = el('span');
    span.append(el('span', '', label), copyButton(ctx, value, 'mono'));
    return span;
  }

  function tokenNames(ctx, n) {
    const names = el('div', 'ct__names');
    if (n.swift) names.append(nameLine(ctx, 'Swift', n.swift));
    if (n.kotlin) names.append(nameLine(ctx, 'Kotlin', n.kotlin));
    if (n.cssIos && n.cssIos === n.cssAndroid) names.append(nameLine(ctx, 'CSS', n.cssIos));
    else {
      if (n.cssIos) names.append(nameLine(ctx, 'CSS iOS', n.cssIos));
      if (n.cssAndroid) names.append(nameLine(ctx, 'CSS Android', n.cssAndroid));
    }
    return names;
  }

  function tokenRow(ctx, token) {
    const row = el('div', 'ct__row');
    const name = el('div', 'ct__name');
    const title = el('div', 'ct__title', token.id);
    if (token.diff) title.append(el('span', 'badge badge--warn', 'iOS ≠ Android'));
    if (token.protoDiff) title.append(el('span', 'badge badge--warn', '프로토타입 값 다름'));
    if (token.fixed) title.append(el('span', 'badge badge--info', '모든 테마 공통'));
    name.append(title);
    if (token.doc) name.append(el('div', 'ct__doc', token.doc.replace(/`/g, '')));
    name.append(tokenNames(ctx, token.names));
    row.append(name);
    if (token.fixed) {
      const cell = colorCell(ctx, token, THEMES[0], -1);
      cell.classList.add('ct__cell--span');
      cell.querySelector('.ct__theme-label').remove();
      row.append(cell);
    } else {
      THEMES.forEach((t, i) => row.append(colorCell(ctx, token, t, i)));
    }
    row.dataset.search = norm([token.id, token.doc, ...Object.values(token.names)].join(' '));
    return row;
  }

  function avatarSection(ctx, avatars) {
    const sec = section(avatars.title, avatars.pairs.length);
    const grid = el('div', 'avatars');
    for (const p of avatars.pairs) {
      const card = el('div', 'avatar-card');
      const disc = el('div', 'avatar-card__disc', '아');
      disc.style.background = p.ios.bg.hex;
      disc.style.color = p.ios.fg.hex;
      card.append(disc, el('span', 'mono', `pairs[${p.index}]`), copyButton(ctx, p.ios.bg.hex, 'mono'), copyButton(ctx, p.ios.fg.hex, 'mono'));
      if (p.diff) card.append(el('span', 'badge badge--warn', 'iOS ≠ Android'));
      card.dataset.search = norm(`avatar 아바타 pairs[${p.index}] ${p.ios.bg.hex} ${p.ios.fg.hex}`);
      grid.append(card);
    }
    sec.append(grid);
    return sec;
  }

  function cssSection(ctx, css) {
    const sec = section(css.title, css.vars.length);
    const list = el('div', 'css-list');
    const scope = s => s === ':root' ? '공통' : (s === '.is-dark' ? '다크 테마' : s);
    for (const v of css.vars) {
      const row = el('div', 'css-row');
      const text = el('div', 'css-row__text');
      text.append(copyButton(ctx, v.name, 'mono'), valueLine(ctx, v.color),
        el('span', 'css-row__meta', `${v.file} · ${scope(v.selector)}${v.doc ? ' · ' + v.doc : ''}`));
      row.append(swatch(v.color), text);
      row.dataset.search = norm(`${v.name} ${v.file} ${v.doc} ${v.color.hex}`);
      list.append(row);
    }
    sec.append(list);
    return sec;
  }

  function colorsHead() {
    const head = el('div', 'ct__head');
    head.append(el('div', 'ct__col', '토큰 · 이름 (Swift · Kotlin · CSS)'));
    THEMES.forEach((t, i) => { const c = el('div', 'ct__col', t); c.dataset.col = i; head.append(c); });
    return head;
  }

  function colorsLegend(tokens) {
    const all = tokens.groups.flatMap(g => g.tokens);
    const legend = el('div', 'legend');
    const diffs = all.filter(t => t.diff).length;
    legend.append(el('span', '', `테마 토큰 ${all.length}개 · 고정 색 ${tokens.fixed.reduce((n, g) => n + g.tokens.length, 0)}개`));
    const warn = el('span', 'badge badge--warn', 'iOS ≠ Android');
    legend.append(warn, el('span', '', diffs ? `${diffs}개 토큰이 플랫폼마다 다름` : '지금은 모든 토큰이 두 플랫폼에서 같습니다'));
    return legend;
  }

  function filterRows(root, q) {
    const needle = norm(q);
    let shown = 0;
    root.querySelectorAll('.catalog__section').forEach(sec => {
      let n = 0;
      sec.querySelectorAll('[data-search]').forEach(row => {
        const hit = !needle || row.dataset.search.includes(needle) || norm(sec.dataset.title).includes(needle);
        row.hidden = !hit;
        if (hit) n += 1;
      });
      sec.hidden = n === 0;
      shown += n;
    });
    root.querySelector('.catalog__empty').hidden = shown > 0;
  }

  function tokenSection(ctx, group) {
    const sec = section(group.title, group.tokens.length);
    sec.dataset.title = group.title;
    group.tokens.forEach(t => sec.append(tokenRow(ctx, t)));
    return sec;
  }

  async function renderColors(ctx) {
    const tokens = await load('tokens.json');
    const root = el('div', 'catalog ct');
    current = { root, kind: 'colors' };
    const bar = el('div', 'catalog__toolbar');
    bar.append(searchBox(ctx, '토큰 · Swift · Kotlin · CSS 이름이나 hex로 찾기 ( / )', () => filterRows(root, ctx.state.q)),
      colorsLegend(tokens), el('span', 'catalog__hint', '이름이나 hex를 누르면 복사'), colorsHead());
    root.append(bar);
    [...tokens.groups, ...tokens.fixed].forEach(g => root.append(tokenSection(ctx, g)));
    const avatars = avatarSection(ctx, tokens.avatars);
    avatars.dataset.title = tokens.avatars.title;
    const css = cssSection(ctx, tokens.css);
    css.dataset.title = tokens.css.title;
    root.append(avatars, css, el('p', 'catalog__empty', '찾는 색이 없습니다.'));
    ctx.stage.append(root);
    applyTheme(ctx.state.theme);
    filterRows(root, ctx.state.q);
    ctx.done();
  }

  window.NaldaCatalog = { renderIcons, renderColors, setTheme: applyTheme };
})();
