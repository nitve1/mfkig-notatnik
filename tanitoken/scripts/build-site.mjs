// Składa stronę LightTokenz do jednego katalogu pod hosting statyczny (Cloudflare Pages).
//   node tanitoken/scripts/build-site.mjs   ->   tanitoken/site-dist/
// Cloudflare Pages: Build command = node tanitoken/scripts/build-site.mjs, Output = tanitoken/site-dist.
// Strona importuje wspólny kod z core/, więc kopiujemy go obok i poprawiamy ścieżki. Dane bierze na żywo
// z gałęzi tanitoken-data, a kopia z data/ jest zapasem, gdy GitHub nie odpowiada.
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'site-dist');
const fix = (s) => s.replaceAll("'../core/", "'./core/").replaceAll("'../data/'", "'./data/'");

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'core', 'locales'), { recursive: true });
mkdirSync(join(OUT, 'data'), { recursive: true });

for (const f of readdirSync(join(ROOT, 'landing'))) {
  const src = join(ROOT, 'landing', f);
  if (f.endsWith('.js')) writeFileSync(join(OUT, f), fix(readFileSync(src, 'utf8')));
  else cpSync(src, join(OUT, f));
}
for (const f of ['pricing.js', 'sources.js', 'i18n.js', 'affiliates.js', 'history.js']) cpSync(join(ROOT, 'core', f), join(OUT, 'core', f));
cpSync(join(ROOT, 'core', 'locales'), join(OUT, 'core', 'locales'), { recursive: true });
for (const f of ['snapshot.json', 'history.json']) cpSync(join(ROOT, 'data', f), join(OUT, 'data', f));

// Krótszy cache dla danych, dłuższy dla obrazków (format pliku _headers w Cloudflare Pages).
writeFileSync(join(OUT, '_headers'), `/data/*
  Cache-Control: public, max-age=300
/*.jpg
  Cache-Control: public, max-age=86400
`);
console.log(`OK ${OUT}`);
