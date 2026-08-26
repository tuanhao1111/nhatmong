/* =============================================================================
   SERVICE WORKER · Nhất Mộng PWA
   - Precache phần "vỏ" tĩnh của site (HTML/CSS/JS/icon)
   - Same-origin: stale-while-revalidate (mở nhanh, tự cập nhật nền)
   - Cross-origin (API phim, CDN, video): KHÔNG can thiệp — đi mạng như thường
   Đổi VERSION mỗi khi muốn ép mọi máy tải lại bản mới.
   ========================================================================== */
const VERSION = 'nm-v11';
const SHELL = [
  './',
  'index.html',
  'phim.html',
  'gacha.html',
  'bangchien.html',
  '404.html',
  'css/phim.css?v=6',
  'css/bangchien.css?v=3',
  'js/phim.js',
  'js/bangchien.js?v=3',
  'js/support.js',
  'js/cyber-bg.js',
  'js/mong-gate.js',
  'js/nhac-nen.js',
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
  // Request Range (tua audio/video) trả về 206 — Cache API không nhận → đi mạng thẳng
  if (req.headers.get('range')) return;

  // Stale-while-revalidate: trả bản cache ngay, đồng thời tải bản mới về thay
  e.respondWith(
    caches.open(VERSION).then((cache) =>
      cache.match(req).then((cached) => {
        const fresh = fetch(req).then((res) => {
          // Chỉ cache bản đầy đủ (200); .catch chống lỗi put làm hỏng response
          if (res && res.status === 200) cache.put(req, res.clone()).catch(() => {});
          return res;
        }).catch(() => cached);
        return cached || fresh;
      })
    )
  );
});
