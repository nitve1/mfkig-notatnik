// Podgląd apki w przeglądarce (np. Safari na iPhonie) jako jedna strona HTML.
//   cd tanitoken/mobile && node scripts/web-preview.mjs
// Wynik: dist-web/index.html (kod i fonty w środku) + dist-web/snapshot.json.
// Strona nie pobiera nic z zewnątrz: ceny bierze z dołączonego snapshotu.
// Powiadomienia i zadania w tle na webie nie działają, reszta tak.
import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = join(ROOT, 'dist-web', 'build');
const OUT = join(ROOT, 'dist-web');
const FONTS = ['BricolageGrotesque_700Bold', 'BricolageGrotesque_800ExtraBold', 'Figtree_400Regular', 'Figtree_500Medium', 'Figtree_600SemiBold', 'Figtree_700Bold'];

rmSync(OUT, { recursive: true, force: true });
execSync(`npx expo export --platform web --output-dir ${BUILD}`, { cwd: ROOT, stdio: 'inherit' });

const jsDir = join(BUILD, '_expo', 'static', 'js', 'web');
const jsFile = readdirSync(jsDir).find((f) => f.endsWith('.js'));
let js = readFileSync(join(jsDir, jsFile), 'utf8');

// Fonty jako data URI (strona nie może ładować fontów z własnych plików).
js = js.replace(/"\/assets\/[^"]+?\/([A-Za-z]+_\d+[A-Za-z]+)\.[0-9a-f]+\.ttf"/g, (all, name) => {
  if (!FONTS.includes(name)) return all;
  const path = join(BUILD, all.slice(2, -1));
  return `"data:font/ttf;base64,${readFileSync(path).toString('base64')}"`;
});
const inlined = FONTS.filter((f) => js.includes(`base64`) && js.includes(f)).length;

const safe = js.replace(/<\/script/gi, '<\\/script');
const page = `<title>TaniToken</title>
<style>
  :root { --bg: #f7f7fb; color-scheme: light; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #100e1b; color-scheme: dark; } }
  :root[data-theme="dark"] { --bg: #100e1b; color-scheme: dark; }
  html, body { height: 100%; background: var(--bg); }
  body { overflow: hidden; }
  #root { display: flex; height: 100%; flex: 1; }
</style>
<div id="root"></div>
<script>${safe}</script>
`;
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'index.html'), page);
copyFileSync(join(ROOT, '..', 'data', 'snapshot.json'), join(OUT, 'snapshot.json'));
rmSync(BUILD, { recursive: true, force: true });
console.log(`OK dist-web/index.html (${(page.length / 1e6).toFixed(1)} MB, fonty: ${inlined}/${FONTS.length}) + snapshot.json`);
