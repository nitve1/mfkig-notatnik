/* MFKiG Indie Notes: kafelki gier + notatnik (IndexedDB, offline, eksport ZIP) */
'use strict';

/* ================= IndexedDB ================= */
const DB = (() => {
  let dbp;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('mfkig-notes', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('state', { keyPath: 'gameId' });
      d.createObjectStore('media', { keyPath: 'id' }).createIndex('gameId', 'gameId');
      d.createObjectStore('custom', { keyPath: 'id' });
      d.createObjectStore('meta', { keyPath: 'k' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const tx = async (store, mode, fn) => {
    const d = await open();
    return new Promise((res, rej) => {
      const t = d.transaction(store, mode);
      const req = fn(t.objectStore(store));
      let out;
      if (req) req.onsuccess = () => { out = req.result; };
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error || new Error('Transakcja przerwana'));
    });
  };
  return {
    get: (s, k) => tx(s, 'readonly', st => st.get(k)),
    all: s => tx(s, 'readonly', st => st.getAll()),
    put: (s, v) => tx(s, 'readwrite', st => st.put(v)),
    del: (s, k) => tx(s, 'readwrite', st => st.delete(k)),
  };
})();

/* ================= Stan ================= */
const S = {
  games: [],          // gry z listy + dodane recznie
  state: {},          // gameId -> notatki, oceny, checki
  media: {},          // gameId -> [rekordy media]
  thumbs: new Map(),  // mediaId -> objectURL miniatury
  filter: 'all',
  sort: 'lineup',
  q: '',
  openId: null,
};

const CHECKS = [
  ['played', 'Zagrane'],
  ['talk', 'Rozmowa z devem'],
  ['contact', 'Kontakt / press kit'],
  ['article', 'Do artykułu'],
  ['follow', 'Follow-up'],
];
const FILTERS = [
  ['all', 'Wszystkie'],
  ['todo', 'Do zagrania'],
  ['played', 'Zagrane'],
  ['article', 'Do artykułu'],
  ['top', '★ 4+'],
  ['media', 'Z materiałami'],
  ['sort', 'Sortuj: lista'],
];
const SORTS = [['lineup', 'lista'], ['az', 'A–Z'], ['rating', 'ocena'], ['recent', 'ostatnie']];

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (n, cls = '') => `<svg class="${cls}"><use href="#i-${n}"/></svg>`;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const fmtSize = b => b > 1e9 ? (b / 1e9).toFixed(2) + ' GB' : b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB';
const fmtTime = t => new Date(t).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const fmtDur = s => { s = Math.round(s || 0); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const hue = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % 360;
const initials = t => t.split(/[\s:]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

function st(id) {
  return S.state[id] || (S.state[id] = { gameId: id, checks: {}, rating: 0, notes: '', booth: '', contact: '', link: '', cover: null, updated: 0 });
}
const game = id => S.games.find(g => g.id === id);
const mediaOf = id => S.media[id] || [];
const title = g => st(g.id).titleOverride || g.name || g.title;
const linkOf = g => st(g.id).link || g.steamUrl || g.itchUrl || g.website || '';

/* ================= Start ================= */
async function init() {
  const [lineup, states, media, custom] = await Promise.all([
    fetch('data/games.json').then(r => r.json()),
    DB.all('state').catch(() => []),
    DB.all('media').catch(() => []),
    DB.all('custom').catch(() => []),
  ]);
  lineup.forEach((g, i) => { g.order = i; });
  custom.sort((a, b) => a.created - b.created).forEach((g, i) => { g.order = 1000 + i; });
  S.games = [...lineup, ...custom];
  states.forEach(s => { S.state[s.gameId] = s; });
  media.sort((a, b) => a.created - b.created).forEach(m => { (S.media[m.gameId] ||= []).push(m); });

  try { const f = JSON.parse(localStorage.getItem('mfkig-ui') || '{}'); S.filter = f.filter || 'all'; S.sort = f.sort || 'lineup'; } catch {}

  renderFilters();
  renderList();
  bindGlobal();
  installHint();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

function saveUi() { try { localStorage.setItem('mfkig-ui', JSON.stringify({ filter: S.filter, sort: S.sort })); } catch {} }

/* ================= Filtry i lista ================= */
function counts() {
  const c = { all: 0, todo: 0, played: 0, article: 0, top: 0, media: 0 };
  for (const g of S.games) {
    const s = st(g.id);
    c.all++;
    if (s.checks.played) c.played++; else c.todo++;
    if (s.checks.article) c.article++;
    if (s.rating >= 4) c.top++;
    if (mediaOf(g.id).length) c.media++;
  }
  return c;
}

function renderFilters() {
  const c = counts();
  $('#filters').innerHTML = FILTERS.map(([k, label]) => {
    if (k === 'sort') return `<button class="chip" data-sort>Sortuj: ${SORTS.find(s => s[0] === S.sort)[1]}</button>`;
    return `<button class="chip ${S.filter === k ? 'on' : ''}" data-f="${k}">${label} <b>${c[k]}</b></button>`;
  }).join('');
  const pct = c.all ? Math.round(c.played / c.all * 100) : 0;
  $('#progress i').style.width = pct + '%';
  $('#progress small').textContent = `${c.played}/${c.all} zagranych`;
}

function visibleGames() {
  const q = S.q.trim().toLowerCase();
  let list = S.games.filter(g => {
    const s = st(g.id);
    switch (S.filter) {
      case 'todo': if (s.checks.played) return false; break;
      case 'played': if (!s.checks.played) return false; break;
      case 'article': if (!s.checks.article) return false; break;
      case 'top': if (s.rating < 4) return false; break;
      case 'media': if (!mediaOf(g.id).length) return false; break;
    }
    if (!q) return true;
    return [title(g), g.title, g.studio, s.notes, s.booth, s.contact, (g.genres || []).join(' ')].join(' ').toLowerCase().includes(q);
  });
  const by = {
    lineup: (a, b) => a.order - b.order,
    az: (a, b) => title(a).localeCompare(title(b), 'pl'),
    rating: (a, b) => st(b.id).rating - st(a.id).rating || a.order - b.order,
    recent: (a, b) => (st(b.id).updated || 0) - (st(a.id).updated || 0) || a.order - b.order,
  }[S.sort];
  return list.sort(by);
}

function renderList() {
  const games = visibleGames();
  const list = $('#list');
  list.innerHTML = games.map(tileHTML).join('');
  $('#empty').hidden = games.length > 0;
  if (S.openId && games.some(g => g.id === S.openId)) {
    const el = tileEl(S.openId);
    el.classList.add('open');
    $('.tile-head', el).setAttribute('aria-expanded', 'true');
    fillBody(el, game(S.openId));
  }
}

const tileEl = id => document.querySelector(`.tile[data-id="${CSS.escape(id)}"]`);

function coverUrl(g) {
  const s = st(g.id);
  const m = mediaOf(g.id);
  const cover = (s.cover && m.find(x => x.id === s.cover)) || (!g.tileImg && !g.header && m.find(x => x.kind === 'photo'));
  if (cover) return thumbUrl(cover);
  return g.tileImg || g.header || null;
}

const genBg = (g, l1 = 18, l2 = 32) => { const h = hue(g.id); return `linear-gradient(120deg,hsl(${h} 45% ${l1}%),hsl(${(h + 50) % 360} 60% ${l2}%))`; };

function artHTML(g) {
  const url = coverUrl(g);
  // gradient pod spodem: widac go, gdyby obrazek sie nie wczytal
  if (url) return `<div class="art" style="background-image:url('${esc(url)}'),${genBg(g)}"></div>`;
  return `<div class="art gen" style="background:${genBg(g)}">${esc(initials(title(g)))}</div>`;
}

function badgesHTML(g) {
  const s = st(g.id), m = mediaOf(g.id), b = [];
  if (s.checks.played) b.push(`<span class="badge ok">✓ zagrane</span>`);
  if (s.rating) b.push(`<span class="badge star">${icon('star')}${s.rating}</span>`);
  if (s.checks.article) b.push(`<span class="badge hot">artykuł</span>`);
  const ph = m.filter(x => x.kind === 'photo').length, vi = m.filter(x => x.kind === 'video').length, au = m.filter(x => x.kind === 'audio').length;
  if (ph) b.push(`<span class="badge">${icon('camera')}${ph}</span>`);
  if (vi) b.push(`<span class="badge">${icon('video')}${vi}</span>`);
  if (au) b.push(`<span class="badge">${icon('mic')}${au}</span>`);
  if (s.notes?.trim()) b.push(`<span class="badge">${icon('note')}</span>`);
  return b.join('');
}

function tileClasses(g) {
  const s = st(g.id);
  return ['tile', s.checks.article ? 's-article' : s.checks.played ? 's-played' : '', S.openId === g.id ? 'open' : ''].join(' ');
}

function tileHTML(g) {
  return `<article class="${tileClasses(g)}" data-id="${esc(g.id)}">
    <button class="tile-head" aria-expanded="false">
      ${artHTML(g)}<div class="fade"></div>
      <div class="head-text">
        <h2>${esc(title(g))}</h2>
        <p>${esc(g.studio || '')}</p>
        <div class="badges">${badgesHTML(g)}</div>
      </div>
      ${icon('chev', 'chev')}
    </button>
    <div class="tile-body"><div class="tile-inner"></div></div>
  </article>`;
}

/* Odswiezenie naglowka kafelka bez zwijania */
function refreshTile(id) {
  const el = tileEl(id), g = game(id);
  if (!el || !g) return;
  el.className = tileClasses(g);
  const head = $('.tile-head', el);
  $('.art', head).outerHTML = artHTML(g);
  $('.badges', head).innerHTML = badgesHTML(g);
  $('h2', head).textContent = title(g);
  renderFilters();
}

function toggleTile(id) {
  const el = tileEl(id);
  const wasOpen = el.classList.contains('open');
  $$('.tile.open').forEach(t => closeTile(t));
  if (wasOpen) { S.openId = null; return; }
  S.openId = id;
  fillBody(el, game(id));
  requestAnimationFrame(() => {
    el.classList.add('open');
    $('.tile-head', el).setAttribute('aria-expanded', 'true');
    setTimeout(() => {
      const top = el.getBoundingClientRect().top + scrollY - $('.top').offsetHeight - 8;
      scrollTo({ top, behavior: 'smooth' });
    }, 60);
  });
}

function closeTile(el) {
  el.classList.remove('open');
  $('.tile-head', el).setAttribute('aria-expanded', 'false');
  stopRecording();
  $$('video', el).forEach(v => v.pause());
  setTimeout(() => { if (!el.classList.contains('open')) $('.tile-inner', el).innerHTML = ''; }, 420);
}

/* ================= Rozwiniety kafelek ================= */
function heroHTML(g) {
  const poster = g.heroImg || g.trailer?.thumb || g.tileImg || coverUrl(g);
  const hasVideo = g.trailer?.hls || g.trailer?.mp4 || g.youtube;
  if (!poster && !hasVideo) {
    return `<div class="hero gen" style="background:${genBg(g, 16, 30)}">${esc(initials(title(g)))}</div>`;
  }
  return `<div class="hero" style="background-image:url('${esc(poster || '')}'),${genBg(g, 16, 30)}">
    ${hasVideo ? `<button class="play" data-act="trailer" aria-label="Odtwórz trailer"><span>${icon('play')}</span><em>${esc(g.trailer?.name || 'Trailer')}</em></button>` : ''}
  </div>`;
}

function fillBody(el, g) {
  const s = st(g.id);
  const tags = [];
  if (g.release?.date) tags.push(`<span class="tag date">${esc(g.release.date)}</span>`);
  (g.genres || []).filter(x => !/niezależne|indie/i.test(x)).slice(0, 4).forEach(x => tags.push(`<span class="tag">${esc(x)}</span>`));
  if (!g.genres?.length && g.genreHint) tags.push(`<span class="tag">${esc(g.genreHint)}</span>`);
  if (g.languagesPL) tags.push(`<span class="tag pl">PL</span>`);
  if (g.categories?.some(c => /kooperac|co-op|multi|wielu graczy/i.test(c))) tags.push(`<span class="tag">Multi / co-op</span>`);

  const plat = g.platforms ? Object.entries(g.platforms).filter(([, v]) => v).map(([k]) => ({ windows: 'Windows', mac: 'macOS', linux: 'Linux/Deck' }[k] || k)).join(', ') : '';
  const meta = [
    ['Studio', (g.developers?.length ? g.developers.join(', ') : g.studio)],
    ['Wydawca', (g.publishers || []).filter(p => p && !g.developers?.includes(p)).join(', ')],
    ['Premiera', g.release?.date],
    ['Platformy', plat],
    ['Polski', g.appid ? (g.languagesPL ? 'tak' : 'nie') : ''],
  ].filter(([, v]) => v);

  const link = linkOf(g);
  const searchQ = encodeURIComponent(`${g.title} ${g.studio || ''}`.trim());

  $('.tile-inner', el).innerHTML = `<div class="tile-content">
    ${heroHTML(g)}
    ${g.short ? `<p class="lead">${esc(g.short)}</p>` : ''}
    ${tags.length ? `<div class="tags">${tags.join('')}</div>` : ''}
    ${!g.short && !g.custom ? `<div class="nodata"><b>Brak strony gry w sieci.</b> ${esc(g.note || '')} Zrób zdjęcie stoiska albo ekranu tytułowego, stanie się okładką kafelka. Link wpiszesz niżej.</div>` : ''}
    ${g.custom ? `<div class="nodata"><b>Gra dodana ręcznie.</b> Zdjęcie stanie się okładką kafelka.</div>` : ''}

    <div class="actions">
      <button class="act" data-act="photo">${icon('camera')}Zdjęcie</button>
      <button class="act" data-act="video">${icon('video')}Wideo</button>
      <button class="act" data-act="rec">${icon('mic')}Głosówka</button>
      <button class="act" data-act="focus-notes">${icon('note')}Notatka</button>
    </div>
    <div class="recslot"></div>

    <div class="section">
      <h4>Status</h4>
      <div class="checks">${CHECKS.map(([k, l]) => `<button class="check ${s.checks[k] ? 'on' : ''}" data-k="${k}"><i></i>${l}</button>`).join('')}</div>
    </div>
    <div class="section">
      <h4>Ocena</h4>
      <div class="stars">${[1, 2, 3, 4, 5].map(n => `<button data-star="${n}" class="${s.rating >= n ? 'on' : ''}" aria-label="${n}">${icon('star')}</button>`).join('')}<small>${s.rating ? s.rating + '/5' : 'brak'}</small></div>
    </div>

    <div class="section">
      <h4>Notatki <span class="saved">Zapisano ✓</span></h4>
      <textarea class="notes" placeholder="Wrażenia z grania, co działa, co nie, cytaty deva, pomysły na tekst…">${esc(s.notes)}</textarea>
      <div class="note-tools">
        <button class="mini" data-act="stamp">${icon('clock')}Wstaw godzinę</button>
        <button class="mini" data-act="tpl">${icon('note')}Szablon</button>
      </div>
      <div class="fields">
        <label>Stoisko / miejsce<input data-field="booth" value="${esc(s.booth)}" placeholder="np. B12, strefa indie" autocomplete="off"></label>
        <label>Kontakt<input data-field="contact" value="${esc(s.contact)}" placeholder="imię, mail, Discord" autocomplete="off"></label>
        <label class="wide">Link do gry<input data-field="link" value="${esc(s.link)}" placeholder="${esc(g.steamUrl || g.itchUrl || 'https://…')}" inputmode="url" autocomplete="off"></label>
      </div>
    </div>

    <div class="section">
      <h4>Moje materiały</h4>
      <div class="mediaslot"></div>
    </div>

    ${g.about || g.screenshots?.length || meta.length ? `<div class="section">
      <h4>O grze</h4>
      ${g.screenshots?.length ? `<div class="shots">${g.screenshots.map((x, i) => `<button data-shot="${i}" style="background-image:url('${esc(x.thumb)}')" aria-label="Screenshot ${i + 1}"></button>`).join('')}</div>` : ''}
      ${g.about ? `<p class="about" style="margin-top:12px">${esc(g.about)}</p><button class="link" data-act="more" style="margin-top:6px">Czytaj więcej</button>` : ''}
      ${meta.length ? `<dl class="meta" style="margin-top:14px">${meta.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''}
    </div>` : ''}

    <div class="links">
      ${link ? `<a class="mini" href="${esc(link)}" target="_blank" rel="noopener">${icon('ext')}${link.includes('steampowered') ? 'Steam' : link.includes('itch.io') ? 'itch.io' : 'Strona'}</a>` : ''}
      ${g.steamUrl && link !== g.steamUrl ? `<a class="mini" href="${esc(g.steamUrl)}" target="_blank" rel="noopener">${icon('ext')}Steam</a>` : ''}
      ${g.website ? `<a class="mini" href="${esc(g.website)}" target="_blank" rel="noopener">${icon('ext')}WWW</a>` : ''}
      ${!g.steamUrl ? `<a class="mini" href="https://store.steampowered.com/search/?term=${encodeURIComponent(g.title)}" target="_blank" rel="noopener">${icon('search')}Szukaj na Steam</a>
      <a class="mini" href="https://itch.io/search?q=${encodeURIComponent(g.title)}" target="_blank" rel="noopener">${icon('search')}itch.io</a>
      <a class="mini" href="https://www.google.com/search?q=${searchQ}" target="_blank" rel="noopener">${icon('search')}Google</a>` : ''}
    </div>

    <div class="foot-actions">
      <button class="btn" data-act="share-game">${icon('share')}Wyślij paczkę</button>
      <button class="btn" data-act="zip-game">${icon('download')}ZIP tej gry</button>
      ${g.custom ? `<button class="btn danger" data-act="del-game" style="grid-column:1/-1">${icon('trash')}Usuń grę z listy</button>` : ''}
    </div>
  </div>`;
  renderMedia(el, g);
}

function renderMedia(el, g) {
  const slot = $('.mediaslot', el);
  if (!slot) return;
  const m = mediaOf(g.id), s = st(g.id);
  const visual = m.filter(x => x.kind !== 'audio');
  const audio = m.filter(x => x.kind === 'audio');
  if (!m.length) { slot.innerHTML = `<p class="nomedia">Brak. Zdjęcia, wideo i głosówki zapiszą się tutaj, w pamięci telefonu.</p>`; return; }
  slot.innerHTML = `
    ${visual.length ? `<div class="gallery">${visual.map(x => `<button class="thumb ${s.cover === x.id ? 'cover' : ''}" data-media="${x.id}" style="${thumbUrl(x) ? `background-image:url('${thumbUrl(x)}')` : ''}">
      ${x.kind === 'video' ? `<span class="kind">${icon('play')}${x.dur ? fmtDur(x.dur) : 'wideo'}</span>` : ''}</button>`).join('')}</div>` : ''}
    ${audio.length ? `<div class="audios">${audio.map(x => `<div class="audio" data-audio="${x.id}"><span>${fmtTime(x.created)}</span><audio controls preload="none" src="${blobUrl(x)}"></audio>
      <button class="icon-btn" data-act="share-media" data-id="${x.id}" aria-label="Udostępnij">${icon('share')}</button>
      <button class="icon-btn danger" data-act="del-media" data-id="${x.id}" aria-label="Usuń">${icon('trash')}</button></div>`).join('')}</div>` : ''}`;
}

/* ================= Zapisywanie stanu ================= */
const saveTimers = {};
function touch(id, { now = false, tile = true } = {}) {
  const s = st(id);
  s.updated = Date.now();
  clearTimeout(saveTimers[id]);
  const run = async () => {
    await DB.put('state', s);
    const el = tileEl(id);
    const badge = el && $('.saved', el);
    if (badge) { badge.classList.add('on'); setTimeout(() => badge.classList.remove('on'), 1200); }
  };
  if (now) run(); else saveTimers[id] = setTimeout(run, 350);
  if (tile) refreshTile(id);
}

/* ================= Media ================= */
const blobUrls = new Map();
function blobUrl(m) {
  if (!blobUrls.has(m.id)) blobUrls.set(m.id, URL.createObjectURL(m.blob));
  return blobUrls.get(m.id);
}
function thumbUrl(m) {
  if (S.thumbs.has(m.id)) return S.thumbs.get(m.id);
  if (m.thumb) { const u = URL.createObjectURL(m.thumb); S.thumbs.set(m.id, u); return u; }
  if (m.kind === 'photo') return blobUrl(m);
  return '';
}

function loadImage(url) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
}
function canvasThumb(src, w, h, max = 480) {
  const k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return new Promise(res => c.toBlob(b => res(b), 'image/jpeg', .78));
}
async function makePhotoThumb(blob) {
  const url = URL.createObjectURL(blob);
  try { const img = await loadImage(url); return await canvasThumb(img, img.naturalWidth, img.naturalHeight); }
  catch { return null; } finally { URL.revokeObjectURL(url); }
}
function makeVideoThumb(blob) {
  return new Promise(res => {
    const url = URL.createObjectURL(blob);
    const v = document.createElement('video');
    let done = false;
    const finish = (thumb, dur) => { if (done) return; done = true; URL.revokeObjectURL(url); res({ thumb, dur }); };
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.onloadedmetadata = () => { v.currentTime = Math.min(0.5, (v.duration || 1) / 3); };
    v.onseeked = async () => { finish(await canvasThumb(v, v.videoWidth, v.videoHeight).catch(() => null), v.duration); };
    v.onerror = () => finish(null, 0);
    setTimeout(() => finish(null, v.duration || 0), 6000);
    v.src = url; v.load();
  });
}

async function addFiles(gameId, files, kind) {
  if (!files.length) return;
  busy(`Zapisuję ${files.length > 1 ? files.length + ' pliki' : 'plik'}…`);
  let n = 0;
  try {
    for (const f of files) {
      const k = kind || (f.type.startsWith('video') ? 'video' : f.type.startsWith('audio') ? 'audio' : 'photo');
      const rec = { id: uid(), gameId, kind: k, name: f.name || `${k}`, type: f.type || 'application/octet-stream', size: f.size, created: Date.now(), blob: f, thumb: null, dur: 0 };
      if (k === 'photo') rec.thumb = await makePhotoThumb(f);
      if (k === 'video') Object.assign(rec, await makeVideoThumb(f));
      await DB.put('media', rec);
      (S.media[gameId] ||= []).push(rec);
      n++;
    }
    persistStorage();
    const s = st(gameId);
    if (kind === 'photo' && !s.checks.played) { /* zdjecie z gry zwykle znaczy, ze gra byla ograna, ale nie zgadujemy */ }
    touch(gameId, { now: true });
    const el = tileEl(gameId);
    if (el) renderMedia(el, game(gameId));
    toast(`Dodano ${n} ${kind === 'video' ? 'wideo' : n === 1 ? 'plik' : 'pliki'}`);
  } catch (e) {
    console.error(e);
    toast('Nie udało się zapisać: ' + (e.message || e) + (n ? ` (zapisano ${n})` : ''));
  } finally { unbusy(); }
}

async function deleteMedia(id) {
  for (const gid in S.media) {
    const i = S.media[gid].findIndex(m => m.id === id);
    if (i < 0) continue;
    await DB.del('media', id);
    S.media[gid].splice(i, 1);
    if (blobUrls.has(id)) { URL.revokeObjectURL(blobUrls.get(id)); blobUrls.delete(id); }
    if (S.thumbs.has(id)) { URL.revokeObjectURL(S.thumbs.get(id)); S.thumbs.delete(id); }
    const s = st(gid);
    if (s.cover === id) s.cover = null;
    touch(gid, { now: true });
    const el = tileEl(gid);
    if (el) renderMedia(el, game(gid));
    return gid;
  }
}

let asked = false;
async function persistStorage() {
  if (asked || !navigator.storage?.persist) return;
  asked = true;
  try { await navigator.storage.persist(); } catch {}
}

/* ================= Nagrywanie glosu ================= */
let rec = null;
async function startRecording(gameId) {
  if (rec) return stopRecording();
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return toast('Ta przeglądarka nie nagrywa dźwięku');
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch { return toast('Brak dostępu do mikrofonu'); }
  const type = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/aac'].find(t => MediaRecorder.isTypeSupported?.(t)) || '';
  const mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
  const chunks = [];
  const t0 = Date.now();
  mr.ondataavailable = e => e.data.size && chunks.push(e.data);
  mr.onstop = async () => {
    stream.getTracks().forEach(t => t.stop());
    const mime = (mr.mimeType || type || 'audio/mp4').split(';')[0];
    const ext = mime.includes('webm') ? 'webm' : 'm4a';
    const blob = new Blob(chunks, { type: mime });
    const file = new File([blob], `glosowka.${ext}`, { type: mime });
    const dur = (Date.now() - t0) / 1000;
    const recGame = gameId;
    await addFiles(recGame, [file], 'audio');
    const last = mediaOf(recGame).at(-1);
    if (last) { last.dur = dur; DB.put('media', last); }
  };
  mr.start(1000);
  rec = { mr, gameId, t0, timer: null };
  const el = tileEl(gameId);
  const slot = el && $('.recslot', el);
  if (slot) {
    slot.innerHTML = `<div class="recbar"><span class="dot"></span><b>0:00</b><button class="mini" data-act="rec">${icon('stop')}Zapisz nagranie</button></div>`;
    rec.timer = setInterval(() => { const b = $('.recbar b', slot); if (b) b.textContent = fmtDur((Date.now() - t0) / 1000); }, 500);
  }
  const btn = el && $('.act[data-act="rec"]', el);
  if (btn) { btn.classList.add('rec'); btn.innerHTML = `${icon('stop')}Stop`; }
}
function stopRecording() {
  if (!rec) return;
  const { mr, gameId, timer } = rec;
  clearInterval(timer);
  rec = null;
  if (mr.state !== 'inactive') mr.stop();
  const el = tileEl(gameId);
  if (el) {
    const slot = $('.recslot', el); if (slot) slot.innerHTML = '';
    const btn = $('.act[data-act="rec"]', el);
    if (btn) { btn.classList.remove('rec'); btn.innerHTML = `${icon('mic')}Głosówka`; }
  }
}

/* ================= Trailer ================= */
let hlsLib = null;
async function playTrailer(el, g) {
  const hero = $('.hero', el);
  if (g.youtube && !g.trailer) {
    hero.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${esc(g.youtube)}?autoplay=1&playsinline=1" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
    return;
  }
  const t = g.trailer;
  const v = document.createElement('video');
  v.controls = true; v.playsInline = true; v.autoplay = true; v.poster = g.heroImg || t.thumb || '';
  hero.innerHTML = '';
  hero.appendChild(v);
  if (t.mp4) v.src = t.mp4;
  else if (v.canPlayType('application/vnd.apple.mpegurl')) v.src = t.hls; // iPhone / Safari: HLS natywnie
  else {
    try {
      if (!hlsLib) hlsLib = await new Promise((res, rej) => {
        const sc = document.createElement('script');
        sc.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js';
        sc.onload = () => res(window.Hls); sc.onerror = rej;
        document.head.appendChild(sc);
      });
      const h = new hlsLib(); h.loadSource(t.hls); h.attachMedia(v);
    } catch { hero.innerHTML = `<div class="nodata">Nie da się odtworzyć trailera tutaj. <a class="link" href="${esc(g.steamUrl)}" target="_blank" rel="noopener">Otwórz na Steam</a></div>`; return; }
  }
  v.play().catch(() => {});
}

/* ================= Lightbox ================= */
const LB = { items: [], gameId: null };
function openLightbox(items, start, gameId = null) {
  LB.items = items; LB.gameId = gameId;
  const track = $('#lbTrack');
  track.innerHTML = items.map(x => `<div class="lb-item">${x.kind === 'video'
    ? `<video src="${esc(x.url)}" controls playsinline preload="metadata"></video>`
    : `<img src="${esc(x.url)}" alt="" loading="lazy">`}</div>`).join('');
  $('#lightbox').hidden = false;
  document.body.classList.add('locked');
  $$('.lb-tools button').forEach(b => { b.hidden = !gameId; });
  requestAnimationFrame(() => { track.scrollLeft = start * track.clientWidth; lbUpdate(); });
}
function lbIndex() { const t = $('#lbTrack'); return Math.round(t.scrollLeft / Math.max(1, t.clientWidth)); }
function lbUpdate() {
  const i = lbIndex(), cur = LB.items[i];
  $('#lbCount').textContent = LB.items.length > 1 ? `${i + 1} / ${LB.items.length}` : '';
  const cov = $('[data-lb="cover"]');
  if (LB.gameId) cov.hidden = cur?.kind !== 'photo';
  $$('#lbTrack video').forEach((v, k) => { if (k !== i) v.pause(); });
}
function closeLightbox() {
  $$('#lbTrack video').forEach(v => v.pause());
  $('#lightbox').hidden = true;
  $('#lbTrack').innerHTML = '';
  document.body.classList.remove('locked');
}
function mediaLightbox(gameId, mediaId) {
  const visual = mediaOf(gameId).filter(x => x.kind !== 'audio');
  openLightbox(visual.map(x => ({ id: x.id, kind: x.kind, url: blobUrl(x) })), Math.max(0, visual.findIndex(x => x.id === mediaId)), gameId);
}

/* ================= Eksport ================= */
const safe = s => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L')
  .replace(/[^\w\s.-]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'gra';
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic', 'image/heif': 'heif', 'image/webp': 'webp', 'image/gif': 'gif', 'video/quicktime': 'mov', 'video/mp4': 'mp4', 'video/webm': 'webm', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/webm': 'webm', 'audio/mpeg': 'mp3' };
const extOf = m => EXT[m.type?.split(';')[0]] || (m.name?.match(/\.(\w{2,5})$/)?.[1]?.toLowerCase()) || 'bin';
const stamp = t => { const d = new Date(t); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };
const folderOf = g => `${String(g.order < 1000 ? g.order + 1 : g.order - 900).padStart(2, '0')} ${safe(title(g))}`;
const mediaFileName = (m, i) => `${{ photo: 'foto', video: 'wideo', audio: 'glos' }[m.kind]}-${String(i + 1).padStart(2, '0')}-${stamp(m.created)}.${extOf(m)}`;

function gameMarkdown(g, withFiles = true) {
  const s = st(g.id), m = mediaOf(g.id);
  const checks = CHECKS.filter(([k]) => s.checks[k]).map(([, l]) => l);
  const L = [`## ${title(g)}`, `*${g.studio || ''}*`, ''];
  const link = linkOf(g);
  if (link) L.push(`Link: ${link}`);
  if (s.rating) L.push(`Ocena: ${'★'.repeat(s.rating)}${'☆'.repeat(5 - s.rating)} (${s.rating}/5)`);
  if (checks.length) L.push(`Status: ${checks.join(', ')}`);
  if (s.booth) L.push(`Stoisko: ${s.booth}`);
  if (s.contact) L.push(`Kontakt: ${s.contact}`);
  if (g.release?.date) L.push(`Premiera: ${g.release.date}`);
  if (g.short) L.push('', `> ${g.short}`);
  if (s.notes?.trim()) L.push('', '### Notatki', '', s.notes.trim());
  if (withFiles && m.length) {
    L.push('', '### Materiały');
    const byKind = { photo: [], video: [], audio: [] };
    m.forEach(x => byKind[x.kind].push(x));
    for (const k in byKind) byKind[k].forEach((x, i) => L.push(`- ${mediaFileName(x, i)} (${fmtTime(x.created)}, ${fmtSize(x.size)})`));
  }
  return L.join('\n');
}

function reportMarkdown() {
  const all = [...S.games].sort((a, b) => a.order - b.order);
  const touched = all.filter(g => { const s = st(g.id); return s.updated || mediaOf(g.id).length; });
  const rest = all.filter(g => !touched.includes(g));
  const c = counts();
  return [
    `# MFKiG 2026: notatki z testów gier indie`,
    `Wygenerowano: ${new Date().toLocaleString('pl-PL')} · zagrane ${c.played}/${c.all} · do artykułu ${c.article}`,
    '',
    ...touched.map(g => gameMarkdown(g) + '\n'),
    rest.length ? `---\n\n**Bez notatek:** ${rest.map(g => `${title(g)} (${g.studio})`).join(', ')}` : '',
  ].join('\n');
}

async function loadZip() {
  if (window.JSZip) return window.JSZip;
  await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'js/vendor/jszip.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  return window.JSZip;
}

async function buildZip(games, { video = true, name }) {
  const JSZip = await loadZip();
  const zip = new JSZip();
  const backup = { app: 'mfkig-indie-notes', version: 1, exported: Date.now(), state: [], custom: [], media: [] };
  let total = 0;
  for (const g of games) {
    const s = st(g.id), m = mediaOf(g.id);
    if (!s.updated && !m.length && games.length > 1) continue;
    const dir = folderOf(g);
    zip.file(`${dir}/notatki.md`, `# ${title(g)}\n\n` + gameMarkdown(g).split('\n').slice(1).join('\n'));
    if (s.updated) backup.state.push(s);
    if (g.custom) backup.custom.push(g);
    const byKind = { photo: [], video: [], audio: [] };
    m.forEach(x => byKind[x.kind].push(x));
    for (const k in byKind) {
      byKind[k].forEach((x, i) => {
        const path = `${dir}/${mediaFileName(x, i)}`;
        const include = video || x.kind !== 'video';
        if (include) { zip.file(path, x.blob, { binary: true, date: new Date(x.created) }); total += x.size; }
        backup.media.push({ id: x.id, gameId: x.gameId, kind: x.kind, name: x.name, type: x.type, size: x.size, created: x.created, dur: x.dur, path: include ? path : null });
      });
    }
  }
  if (games.length > 1) {
    zip.file('RAPORT.md', reportMarkdown());
    backup.custom = S.games.filter(g => g.custom);
  }
  zip.file('backup.json', JSON.stringify(backup, null, 1));
  busy(`Pakuję ${fmtSize(total)}…`);
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE', streamFiles: true }, meta => {
    $('#busyText').textContent = `Pakuję… ${Math.round(meta.percent)}%`;
  });
  return new File([blob], name, { type: 'application/zip' });
}

async function exportAll(video) {
  const total = Object.values(S.media).flat().filter(m => video || m.kind !== 'video').reduce((a, m) => a + m.size, 0);
  if (total > 1.5e9 && !confirm(`Paczka będzie miała ok. ${fmtSize(total)}. Na iPhonie tak duży ZIP może się nie zmieścić w pamięci. Lepiej wysyłać gry pojedynczo („Wyślij paczkę” w kafelku). Kontynuować?`)) return;
  busy('Przygotowuję eksport…');
  try {
    const file = await buildZip([...S.games].sort((a, b) => a.order - b.order), { video, name: `MFKiG-2026-${video ? 'wszystko' : 'bez-wideo'}-${stamp(Date.now())}.zip` });
    try { localStorage.setItem('mfkig-last-export', String(Date.now())); } catch {}
    ready(file, `Wszystkie gry z notatkami lub materiałami. ${fmtSize(file.size)}.`);
  } catch (e) { console.error(e); toast('Eksport nie wyszedł: ' + (e.message || e)); }
  finally { unbusy(); }
}

async function zipGame(g) {
  busy('Pakuję grę…');
  try {
    const file = await buildZip([g], { video: true, name: `${safe(title(g))}-${stamp(Date.now())}.zip` });
    ready(file, `${title(g)}: notatki i ${mediaOf(g.id).length} plików. ${fmtSize(file.size)}.`);
  } catch (e) { toast('Nie wyszło: ' + (e.message || e)); } finally { unbusy(); }
}

/* Udostepnianie plikow bez ZIP: iOS pokaze AirDrop / Zapisz w Plikach / Mail */
async function shareGame(g) {
  const m = mediaOf(g.id);
  const notes = new File([`# ${title(g)}\n\n` + gameMarkdown(g).split('\n').slice(1).join('\n')], `${safe(title(g))} - notatki.md`, { type: 'text/markdown' });
  const byKind = { photo: [], video: [], audio: [] };
  m.forEach(x => byKind[x.kind].push(x));
  const files = [notes];
  for (const k in byKind) byKind[k].forEach((x, i) => files.push(new File([x.blob], `${safe(title(g))} - ${mediaFileName(x, i)}`, { type: x.type })));
  if (navigator.canShare?.({ files })) {
    try { await navigator.share({ files, title: title(g) }); } catch (e) { if (e.name !== 'AbortError') toast('Udostępnianie przerwane'); }
  } else if (navigator.canShare?.({ files: [notes] })) {
    toast('Za dużo plików naraz, robię ZIP'); zipGame(g);
  } else zipGame(g);
}

let readyFile = null;
function ready(file, info) {
  readyFile = file;
  $('#readyTitle').textContent = file.name;
  $('#readyInfo').textContent = info;
  $('#readyShare').hidden = !navigator.canShare?.({ files: [file] });
  openSheet('#ready');
}
function download(file) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

/* ================= Import ================= */
async function importZip(file) {
  busy('Wczytuję kopię…');
  try {
    const JSZip = await loadZip();
    const zip = await JSZip.loadAsync(file);
    const bj = zip.file('backup.json');
    if (!bj) throw new Error('W ZIP-ie nie ma backup.json');
    const b = JSON.parse(await bj.async('string'));
    for (const g of b.custom || []) {
      if (!game(g.id)) { await DB.put('custom', g); S.games.push(g); }
    }
    let ns = 0, nm = 0;
    for (const s of b.state || []) {
      const cur = S.state[s.gameId];
      if (!cur || (s.updated || 0) > (cur.updated || 0)) { S.state[s.gameId] = s; await DB.put('state', s); ns++; }
    }
    const have = new Set(Object.values(S.media).flat().map(m => m.id));
    for (const m of b.media || []) {
      if (have.has(m.id) || !m.path || !zip.file(m.path)) continue;
      $('#busyText').textContent = `Wczytuję ${m.path.split('/').pop()}…`;
      const blob = new Blob([await zip.file(m.path).async('arraybuffer')], { type: m.type });
      const rec = { ...m, blob, thumb: null };
      delete rec.path;
      if (m.kind === 'photo') rec.thumb = await makePhotoThumb(blob);
      if (m.kind === 'video') rec.thumb = (await makeVideoThumb(blob)).thumb;
      await DB.put('media', rec);
      (S.media[m.gameId] ||= []).push(rec);
      nm++;
    }
    renderFilters(); renderList();
    toast(`Przywrócono: ${ns} notatek, ${nm} plików`);
  } catch (e) { console.error(e); toast('Import nie wyszedł: ' + (e.message || e)); }
  finally { unbusy(); }
}

/* ================= UI: sheets, toast, busy ================= */
function openSheet(sel) { $(sel).hidden = false; document.body.classList.add('locked'); }
function closeSheets() { $$('.sheet').forEach(s => { s.hidden = true; }); if ($('#lightbox').hidden) document.body.classList.remove('locked'); }
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600); }
function busy(msg) { $('#busyText').textContent = msg; $('#busy').hidden = false; }
function unbusy() { $('#busy').hidden = true; }

async function renderStats() {
  const c = counts();
  const all = Object.values(S.media).flat();
  const k = kind => all.filter(m => m.kind === kind).length;
  let storage = '';
  try {
    const e = await navigator.storage?.estimate?.();
    const p = await navigator.storage?.persisted?.();
    if (e) storage = `Zajęte: ${fmtSize(e.usage || 0)}${e.quota ? ' z ' + fmtSize(e.quota) : ''}. ${p ? 'Pamięć trwała: tak.' : 'Zainstaluj apkę na ekranie początkowym, żeby iOS nie czyścił danych.'}`;
  } catch {}
  let last = '';
  try { const l = +localStorage.getItem('mfkig-last-export'); last = l ? ` Ostatni eksport: ${fmtTime(l)}.` : ' Jeszcze nie robiłeś eksportu.'; } catch {}
  $('#stats').innerHTML = `
    <div class="stat"><b>${c.played}/${c.all}</b><small>zagrane</small></div>
    <div class="stat"><b>${k('photo')}</b><small>zdjęć</small></div>
    <div class="stat"><b>${k('video') + k('audio')}</b><small>nagrań</small></div>
    <p>${storage}${last}</p>`;
}

function installHint() {
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let dismissed = false;
  try { dismissed = localStorage.getItem('mfkig-hint') === '1'; } catch {}
  $('#installHint').hidden = standalone || !ios || dismissed;
}

/* ================= Zdarzenia ================= */
let pickTarget = null;

function bindGlobal() {
  $('#q').addEventListener('input', e => { S.q = e.target.value; renderList(); });
  $('#filters').addEventListener('click', e => {
    const f = e.target.closest('[data-f]'), so = e.target.closest('[data-sort]');
    if (f) { S.filter = f.dataset.f; }
    if (so) { const i = SORTS.findIndex(s => s[0] === S.sort); S.sort = SORTS[(i + 1) % SORTS.length][0]; }
    if (f || so) { saveUi(); renderFilters(); renderList(); }
  });
  $('#hideHint').onclick = () => { $('#installHint').hidden = true; try { localStorage.setItem('mfkig-hint', '1'); } catch {} };

  $('#menuBtn').onclick = () => { renderStats(); openSheet('#menu'); };
  $('#menu').addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (e.target === $('#menu')) return closeSheets();
    if (!b) return;
    const act = b.dataset.act;
    closeSheets();
    if (act === 'export-all') exportAll(true);
    if (act === 'export-light') exportAll(false);
    if (act === 'report') copyText(reportMarkdown()).then(ok => toast(ok ? 'Raport skopiowany' : 'Nie udało się skopiować'));
    if (act === 'add-game') { $('#addGameForm').reset(); openSheet('#addGame'); setTimeout(() => $('#addGameForm [name=title]').focus(), 250); }
    if (act === 'import') $('#pickZip').click();
  });
  $$('.sheet').forEach(s => s.addEventListener('click', e => { if (e.target === s || e.target.closest('[data-close]')) closeSheets(); }));
  $('#addGameForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const link = (f.get('link') || '').trim();
    const appid = link.match(/store\.steampowered\.com\/app\/(\d+)/)?.[1];
    const g = {
      id: 'custom-' + uid(), custom: true, created: Date.now(), title: f.get('title').trim(), name: f.get('title').trim(),
      studio: (f.get('studio') || '').trim(), steamUrl: appid ? `https://store.steampowered.com/app/${appid}/` : null,
      itchUrl: /itch\.io/.test(link) ? link : null, website: !appid && !/itch\.io/.test(link) && link ? link : null,
      header: appid ? `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg` : null,
      order: 1000 + S.games.filter(x => x.custom).length, screenshots: [], genres: [],
    };
    await DB.put('custom', g);
    S.games.push(g);
    closeSheets();
    S.filter = 'all'; S.q = ''; $('#q').value = '';
    renderFilters(); renderList();
    toggleTile(g.id);
  });

  $('#readyShare').onclick = async () => {
    try { await navigator.share({ files: [readyFile], title: readyFile.name }); closeSheets(); }
    catch (e) { if (e.name !== 'AbortError') toast('Nie udało się udostępnić, użyj „Pobierz plik”'); }
  };
  $('#readyDownload').onclick = () => { download(readyFile); closeSheets(); };

  $('#pickPhoto').onchange = e => { const f = [...e.target.files]; e.target.value = ''; addFiles(pickTarget, f, 'photo'); };
  $('#pickVideo').onchange = e => { const f = [...e.target.files]; e.target.value = ''; addFiles(pickTarget, f, 'video'); };
  $('#pickZip').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importZip(f); };

  // Lightbox
  $('#lbTrack').addEventListener('scroll', () => requestAnimationFrame(lbUpdate), { passive: true });
  $('#lightbox').addEventListener('click', async e => {
    const b = e.target.closest('[data-lb]');
    if (!b) { if (e.target.classList.contains('lb-item')) closeLightbox(); return; }
    const cur = LB.items[lbIndex()];
    if (b.dataset.lb === 'close') return closeLightbox();
    if (!cur?.id) return;
    const m = mediaOf(LB.gameId).find(x => x.id === cur.id);
    if (b.dataset.lb === 'cover') { st(LB.gameId).cover = cur.id; touch(LB.gameId, { now: true }); const el = tileEl(LB.gameId); if (el) renderMedia(el, game(LB.gameId)); toast('Ustawiono jako okładkę kafelka'); }
    if (b.dataset.lb === 'share' && m) shareMedia(m);
    if (b.dataset.lb === 'delete' && m && confirm('Usunąć ten plik z telefonu (z apki)?')) {
      const gid = LB.gameId;
      await deleteMedia(m.id);
      const rest = mediaOf(gid).filter(x => x.kind !== 'audio');
      if (!rest.length) closeLightbox(); else mediaLightbox(gid, rest[Math.min(lbIndex(), rest.length - 1)].id);
      toast('Usunięto');
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeLightbox(); closeSheets(); } });

  // Lista: delegacja
  const list = $('#list');
  list.addEventListener('click', e => {
    const head = e.target.closest('.tile-head');
    const tile = e.target.closest('.tile');
    if (!tile) return;
    const id = tile.dataset.id, g = game(id);
    if (head) return toggleTile(id);

    const chk = e.target.closest('.check');
    if (chk) {
      const s = st(id), k = chk.dataset.k;
      s.checks[k] = !s.checks[k];
      chk.classList.toggle('on', s.checks[k]);
      if (navigator.vibrate) navigator.vibrate(10);
      return touch(id, { now: true });
    }
    const star = e.target.closest('[data-star]');
    if (star) {
      const s = st(id), n = +star.dataset.star;
      s.rating = s.rating === n ? 0 : n;
      $$('[data-star]', tile).forEach(b => b.classList.toggle('on', s.rating >= +b.dataset.star));
      $('.stars small', tile).textContent = s.rating ? s.rating + '/5' : 'brak';
      return touch(id, { now: true });
    }
    const thumb = e.target.closest('[data-media]');
    if (thumb) return mediaLightbox(id, thumb.dataset.media);
    const shot = e.target.closest('[data-shot]');
    if (shot) return openLightbox(g.screenshots.map(x => ({ kind: 'photo', url: x.full })), +shot.dataset.shot);

    const b = e.target.closest('[data-act]');
    if (!b) return;
    switch (b.dataset.act) {
      case 'photo': pickTarget = id; $('#pickPhoto').click(); break;
      case 'video': pickTarget = id; $('#pickVideo').click(); break;
      case 'rec': rec && rec.gameId === id ? stopRecording() : startRecording(id); break;
      case 'focus-notes': { const t = $('.notes', tile); t.focus(); t.setSelectionRange(t.value.length, t.value.length); t.scrollIntoView({ block: 'center', behavior: 'smooth' }); break; }
      case 'stamp': insertAtCursor($('.notes', tile), `${t0()} `, id); break;
      case 'tpl': insertAtCursor($('.notes', tile), `Pierwsze wrażenie: \nGameplay: \nOprawa: \nCo wyróżnia: \nProblemy / bugi: \nCytat deva: \nWerdykt: `, id); break;
      case 'trailer': playTrailer(tile, g); break;
      case 'more': { const a = $('.about', tile); a.classList.toggle('full'); b.textContent = a.classList.contains('full') ? 'Zwiń' : 'Czytaj więcej'; break; }
      case 'share-game': shareGame(g); break;
      case 'zip-game': zipGame(g); break;
      case 'share-media': { const m = mediaOf(id).find(x => x.id === b.dataset.id); if (m) shareMedia(m); break; }
      case 'del-media': if (confirm('Usunąć to nagranie?')) deleteMedia(b.dataset.id).then(() => toast('Usunięto')); break;
      case 'del-game': delGame(g); break;
    }
  });
  list.addEventListener('input', e => {
    const tile = e.target.closest('.tile');
    if (!tile) return;
    const id = tile.dataset.id, s = st(id);
    if (e.target.matches('.notes')) { s.notes = e.target.value; touch(id, { tile: false }); debounceTile(id); }
    if (e.target.dataset.field) { s[e.target.dataset.field] = e.target.value.trim(); touch(id, { tile: false }); }
  });
  // zapis natychmiast przy wyjsciu z pola / apki
  list.addEventListener('focusout', e => { const t = e.target.closest('.tile'); if (t && e.target.matches('textarea,input')) { touch(t.dataset.id, { now: true }); } });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { for (const id in saveTimers) { clearTimeout(saveTimers[id]); DB.put('state', st(id)); } if (rec) stopRecording(); }
  });
}

const tileDeb = {};
function debounceTile(id) { clearTimeout(tileDeb[id]); tileDeb[id] = setTimeout(() => refreshTile(id), 800); }
const t0 = () => `[${new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}]`;

function insertAtCursor(ta, text, id) {
  const pre = ta.value && !ta.value.endsWith('\n') ? '\n' : '';
  const start = ta.selectionStart ?? ta.value.length;
  const atEnd = document.activeElement !== ta;
  if (atEnd) ta.value = ta.value + pre + text;
  else ta.setRangeText((ta.value.slice(0, start).endsWith('\n') || start === 0 ? '' : '\n') + text, start, ta.selectionEnd, 'end');
  st(id).notes = ta.value;
  touch(id);
  ta.focus();
  if (atEnd) ta.setSelectionRange(ta.value.length, ta.value.length);
}

async function shareMedia(m) {
  const g = game(m.gameId);
  const file = new File([m.blob], `${safe(title(g))} - ${mediaFileName(m, 0)}`, { type: m.type });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); } catch (e) { if (e.name !== 'AbortError') toast('Udostępnianie przerwane'); }
  } else download(file);
}

async function delGame(g) {
  if (!confirm(`Usunąć „${title(g)}” razem z notatkami i materiałami?`)) return;
  for (const m of [...mediaOf(g.id)]) await deleteMedia(m.id);
  await DB.del('custom', g.id);
  await DB.del('state', g.id);
  delete S.state[g.id];
  S.games = S.games.filter(x => x.id !== g.id);
  S.openId = null;
  renderFilters(); renderList();
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  }
}

init().catch(e => {
  console.error(e);
  document.getElementById('list').innerHTML = `<p class="empty">Nie udało się uruchomić: ${esc(e.message || e)}</p>`;
});
