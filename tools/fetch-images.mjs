// Pobiera okladki i pierwszy screenshot do img/ (offline na targach) i dopisuje sciezki do data/games.json
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const file = path.join(root, 'data/games.json');
const games = JSON.parse(fs.readFileSync(file, 'utf8'));
fs.mkdirSync(path.join(root, 'img/games'), { recursive: true });

async function save(url, name) {
  if (!url) return null;
  const ext = (url.split('?')[0].match(/\.(jpe?g|png|gif|webp)$/i) || [, 'jpg'])[1].toLowerCase();
  const rel = `img/games/${name}.${ext}`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) { console.log('  fail', url); return null; }
  fs.writeFileSync(path.join(root, rel), Buffer.from(await r.arrayBuffer()));
  return rel;
}

for (const g of games) {
  // Na kafelek: header Steama (460x215) albo okladka z itch
  g.tileImg = await save(g.header, `${g.id}-tile`);
  // Na rozwiniety kafelek: poster trailera / pierwszy screen w 600px
  const heroSrc = g.trailer?.thumb || g.screenshots?.[0]?.thumb || g.hero;
  g.heroImg = heroSrc === g.header ? g.tileImg : await save(heroSrc, `${g.id}-hero`);
  console.log(g.id, !!g.tileImg, !!g.heroImg);
}
fs.writeFileSync(file, JSON.stringify(games, null, 1));
