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
const FONTS = ['Archivo_400Regular', 'Archivo_500Medium', 'Archivo_600SemiBold', 'Archivo_700Bold', 'Archivo_800ExtraBold'];

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
const page = `<title>LightTokenz</title>
<style>
  :root { --bg: #0c0a17; color-scheme: dark; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #0c0a17; color-scheme: dark; } }
  :root[data-theme="dark"] { --bg: #0c0a17; color-scheme: dark; }
  /* Strona stoi w miejscu jak apka: bez przesuwania na boki, sprężynowania i zoomu. */
  html, body { height: 100%; width: 100%; background: var(--bg); overflow: hidden; overscroll-behavior: none; }
  body { position: fixed; inset: 0; touch-action: pan-x pan-y; /* bez pinch i double-tap zoom */ -webkit-text-size-adjust: 100%; }
  #root { display: flex; height: 100%; width: 100%; flex: 1; overflow: hidden; }
</style>
<div id="root"></div>
<script>
  (function () {
    var meta = document.querySelector('meta[name="viewport"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'viewport'; document.head.appendChild(meta); }
    meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover';
    ['gesturestart', 'gesturechange'].forEach(function (e) { document.addEventListener(e, function (ev) { ev.preventDefault(); }, { passive: false }); });
  })();
</script>
<script>${safe}</script>
`;
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'index.html'), page);
copyFileSync(join(ROOT, '..', 'data', 'snapshot.json'), join(OUT, 'snapshot.json'));
rmSync(BUILD, { recursive: true, force: true });
console.log(`OK dist-web/index.html (${(page.length / 1e6).toFixed(1)} MB, fonty: ${inlined}/${FONTS.length}) + snapshot.json`);
