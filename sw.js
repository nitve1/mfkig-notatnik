/* Offline: powloka apki + dane gier + okladki w cache; screeny ze Steama/itch dociagane i cache'owane w locie */
const VERSION = 'v2';
const SHELL = `shell-${VERSION}`;
const RUNTIME = 'runtime-v1';
const CORE = [
  './', 'index.html', 'css/app.css', 'js/app.js', 'js/vendor/jszip.min.js', 'manifest.webmanifest',
  'data/games.json', 'img/icons/icon-180.png', 'img/icons/icon-192.png', 'img/icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    await c.addAll(CORE);
    try {
      const games = await (await fetch('data/games.json')).json();
      const imgs = [...new Set(games.flatMap(g => [g.tileImg, g.heroImg]).filter(Boolean))];
      await c.addAll(imgs);
    } catch {}
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== SHELL && k !== RUNTIME) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.includes('/tanitoken/')) return; // osobna apka TaniToken, zawsze z sieci

  // Wlasne pliki: z cache od razu, w tle odswiezenie (stale-while-revalidate)
  if (url.origin === location.origin) {
    e.respondWith((async () => {
      const c = await caches.open(SHELL);
      const hit = await c.match(req, { ignoreSearch: true });
      const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
      if (hit) { e.waitUntil(net); return hit; }
      return (await net) || (req.mode === 'navigate' ? c.match('index.html') : Response.error());
    })());
    return;
  }

  // Obrazki ze Steama / itch: cache-first
  if (req.destination === 'image' || /steamstatic\.com\/.*\.(jpe?g|png|webp)|img\.itch\.zone/.test(url.href)) {
    e.respondWith((async () => {
      const c = await caches.open(RUNTIME);
      const hit = await c.match(req);
      if (hit) return hit;
      try { const r = await fetch(req); c.put(req, r.clone()); return r; }
      catch { return Response.error(); }
    })());
  }
  // Reszta (trailery HLS, YouTube, CDN) idzie prosto do sieci
});
