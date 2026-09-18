// Pobiera dane gier ze Steama -> data/games.json
// Uzycie: node tools/fetch-steam.mjs   (nadpisania w tools/overrides.json)
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const list = JSON.parse(fs.readFileSync(path.join(root, 'tools/lineup.json'), 'utf8'));
const overrides = fs.existsSync(path.join(root, 'tools/overrides.json'))
  ? JSON.parse(fs.readFileSync(path.join(root, 'tools/overrides.json'), 'utf8')) : {};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

async function getJSON(url) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 mfkig-notatnik' } });
    if (r.ok) return r.json();
    await sleep(1500 * (i + 1));
  }
  throw new Error('HTTP fail ' + url);
}

async function search(term) {
  const j = await getJSON(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(term)}&l=english&cc=PL`);
  return (j.items || []).filter(i => i.type === 'app');
}

async function details(id, lang) {
  const j = await getJSON(`https://store.steampowered.com/api/appdetails?appids=${id}&l=${lang}&cc=PL`);
  return j[id]?.success ? j[id].data : null;
}

function stripHtml(h) {
  return (h || '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|h\d|li)>/gi, '\n').replace(/<li>/gi, '• ')
    .replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n').trim();
}

async function itch(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const h = await r.text();
  const meta = p => (h.match(new RegExp('<meta[^>]*property="og:' + p + '"[^>]*content="([^"]*)"')) || h.match(new RegExp('<meta[^>]*content="([^"]*)"[^>]*property="og:' + p + '"')) || [])[1] || null;
  const shots = [...new Set([...h.matchAll(/<a href="(https:\/\/img\.itch\.zone\/[^"]+)"[^>]*data-image_lightbox/g)].map(m => m[1]))]
    .map(u => ({ full: u, thumb: u })).slice(0, 8);
  const yt = (h.match(/youtube(?:-nocookie)?\.com\/embed\/([\w-]{11})/) || [])[1] || null;
  const desc = (h.match(/formatted_description user_formatted">([\s\S]*?)<\/div>\s*<div class="more_information/) || [])[1] || '';
  const title = (h.match(/<h1 class="game_title">([^<]+)</) || [])[1] || null;
  return { image: meta('image'), short: meta('description'), shots, yt, about: stripHtml(desc).slice(0, 4000), title };
}

const out = [];
for (const g of list) {
  const key = `${g.studio}|${g.title}`;
  const ov = overrides[key] || {};
  let appid = ov.appid ?? null;
  let candidates = [];
  if (appid === null && !ov.noSteam) {
    candidates = await search(ov.search || g.title);
    // najpierw dokladna nazwa, potem nazwa zaczynajaca sie od tytulu; pomijamy dema/soundtracki
    const clean = candidates.filter(c => !/\b(demo|soundtrack|ost|playtest)\b/i.test(c.name));
    const exact = clean.find(c => norm(c.name) === norm(g.title));
    const starts = clean.find(c => norm(c.name).startsWith(norm(g.title)));
    appid = (exact || starts || null)?.id ?? null;
  }
  let d = null, dEn = null;
  if (appid) {
    d = await details(appid, 'polish'); await sleep(400);
    dEn = await details(appid, 'english'); await sleep(400);
  }
  const devs = d?.developers || [];
  const devMatch = devs.some(x => norm(x).includes(norm(g.studio).slice(0, 6)) || norm(g.studio).includes(norm(x).slice(0, 6)));
  const movie = d?.movies?.[0];
  const it = ov.itch ? await itch(ov.itch) : null;
  const rec = {
    id: norm(g.title) + (g.suffix || ''),
    studio: g.studio,
    title: g.title,
    appid,
    name: d?.name || (it?.title?.trim()) || g.title,
    steamUrl: appid ? `https://store.steampowered.com/app/${appid}/` : null,
    short: stripHtml(d?.short_description || '') || it?.short || '',
    shortEn: stripHtml(dEn?.short_description || ''),
    about: stripHtml(d?.about_the_game || '').slice(0, 4000) || it?.about || '',
    header: d?.header_image || it?.image || null,
    capsule: d?.capsule_imagev5 || d?.capsule_image || null,
    hero: d?.screenshots?.[0]?.path_full || it?.shots?.[0]?.full || null,
    background: d?.background_raw || d?.background || null,
    screenshots: d ? (d.screenshots || []).slice(0, 8).map(s => ({ thumb: s.path_thumbnail, full: s.path_full })) : (it?.shots || []),
    trailer: movie ? {
      name: movie.name,
      thumb: movie.thumbnail,
      mp4: movie.mp4?.max || movie.mp4?.['480'] || null,
      webm: movie.webm?.max || null,
      hls: movie.hls_h264 || null,
      dash: movie.dash_h264 || null,
    } : null,
    developers: devs,
    publishers: d?.publishers || [],
    genres: (d?.genres || []).map(x => x.description),
    categories: (d?.categories || []).map(x => x.description).slice(0, 12),
    release: d?.release_date ? { soon: d.release_date.coming_soon, date: d.release_date.date } : null,
    platforms: d?.platforms || null,
    languagesPL: /polski|polish/i.test(d?.supported_languages || ''),
    website: d?.website || null,
    devMatch,
    itchUrl: ov.itch || null,
    youtube: it?.yt || null,
    genreHint: ov.genre || null,
    note: ov.note || null,
    candidates: candidates.slice(0, 5).map(c => `${c.id}:${c.name}`),
  };
  out.push(rec);
  if (it) console.log('itch', g.title, !!it.image, it.shots.length, it.yt, it.about.length);
  console.log(`${appid ? (devMatch ? 'OK ' : '?? ') : '-- '} ${g.title.padEnd(40)} ${appid || ''} ${rec.name} [${devs.join(', ')}]  ${appid ? '' : rec.candidates.join(' | ')}`);
  await sleep(300);
}

fs.mkdirSync(path.join(root, 'data'), { recursive: true });
fs.writeFileSync(path.join(root, 'data/games.json'), JSON.stringify(out, null, 1));
console.log('\nZapisano', out.length, 'gier');
