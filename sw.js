/* =====================================================================
   Atur Ngaji MDIIA — Service Worker
   Naikkan angka VERSI di bawah setiap kali index.html diperbarui,
   supaya semua HP mengambil versi terbaru.
   ===================================================================== */
const VERSI = 'v9';
const CACHE_APP = 'atur-ngaji-app-' + VERSI;
const CACHE_LIB = 'atur-ngaji-lib-' + VERSI;

const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

/* Host pustaka luar yang boleh disimpan agar aplikasi tetap jalan offline */
const LIB_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.jsdelivr.net',
  'www.gstatic.com'
];
/* Host yang TIDAK BOLEH disimpan (data langsung & login) */
const NEVER_CACHE = [
  'firebaseio.com',
  'firebasedatabase.app',
  'googleapis.com',
  'google-analytics.com',
  'googletagmanager.com'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_APP)
      .then(c => c.addAll(ASSETS))
      .catch(() => null)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_APP && k !== CACHE_LIB).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  if (NEVER_CACHE.some(h => url.hostname.endsWith(h) || url.hostname.includes(h))) return;

  /* --- File aplikasi sendiri: utamakan jaringan, cadangan cache --- */
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_APP).then(c => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then(hit =>
            hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)
          )
        )
    );
    return;
  }

  /* --- Pustaka luar (font, Excel, SDK Firebase): utamakan cache --- */
  if (LIB_HOSTS.some(h => url.hostname.endsWith(h))) {
    event.respondWith(
      caches.match(req).then(hit => {
        const net = fetch(req).then(res => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE_LIB).then(c => c.put(req, copy)).catch(() => {});
          }
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    );
  }
});
