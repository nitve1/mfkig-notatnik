// Tło apki "Kolory kategorii, stonowane" (plamy 40%) jako jeden obrazek: rysowany raz, tańszy niż SVG.
//   node scripts/backdrop.mjs  -> assets/backdrop.jpg (1080x2400)
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'backdrop.jpg');
const bg = 'radial-gradient(70% 40% at 0% 0%,#3d63ff66 0%,transparent 60%),radial-gradient(70% 40% at 100% 25%,#ff8a0066 0%,transparent 60%),radial-gradient(70% 45% at 0% 75%,#ff4f8b66 0%,transparent 60%),radial-gradient(70% 40% at 100% 100%,#8b3dff52 0%,transparent 60%),#0b0a12';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 540, height: 1200 }, deviceScaleFactor: 2 });
await p.setContent(`<body style="margin:0;width:540px;height:1200px;background:${bg}"></body>`);
await p.screenshot({ path: OUT, type: 'jpeg', quality: 88 });
await b.close();
console.log(OUT);
