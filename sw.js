/* =============================================================================
   SERVICE WORKER · Nhất Mộng PWA
   - Precache phần "vỏ" tĩnh của site (HTML/CSS/JS/icon)
   - Same-origin: stale-while-revalidate (mở nhanh, tự cập nhật nền)
   - Cross-origin (API phim, CDN, video): KHÔNG can thiệp — đi mạng như thường
   Đổi VERSION mỗi khi muốn ép mọi máy tải lại bản mới.
   ========================================================================== */
const VERSION = 'nm-v2';
const SHELL = [
  './',
  'index.html',
  'phim.html',
  'gacha.html',
  '404.html',
  'css/main.css',
  'css/phim.css',
  'js/site.js',
  'js/phim.js',
  'js/support.js',
  'js/cyber-bg.js',
  'js/mong-gate.js',
  'assets/favicon.svg',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'manifest.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API / CDN / video: mặc định qua mạng

  // Stale-while-revalidate: trả bản cache ngay, đồng thời tải bản mới về thay
  e.respondWith(
    caches.open(VERSION).then((cache) =>
      cache.match(req).then((cached) => {
        const fresh = fetch(req).then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => cached);
        return cached || fresh;
      })
    )
  );
});
