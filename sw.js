// ═════════════════════════════════════════════════════════════════
// sw.js — Service Worker AI Tools Pro
// Tugas: (1) cache app shell network-first, (2) terima Web Push,
// (3) handle klik notifikasi. Bump SW_VERSION tiap rilis.
// ═════════════════════════════════════════════════════════════════

const SW_VERSION = 'v1';
const CACHE_NAME = 'aitp-shell-' + SW_VERSION;

// App shell yang di-cache saat install (konten tetap dari Worker — tidak dicache)
const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  // Bersihkan cache versi lama & langsung ambil alih semua tab
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first: konten selalu segar; fallback cache hanya saat offline.
// Request ke Worker (API) TIDAK dicache.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('/index.html')))
  );
});

// ── WEB PUSH — notifikasi ala native ─────────────────────────────
self.addEventListener('push', (e) => {
  let data = { title: 'AI Tools Pro', body: 'Ada update baru!', url: '/' };
  try {
    if (e.data) data = { ...data, ...e.data.json() };
  } catch (_) { /* payload bukan JSON — pakai default */ }

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'aitp-update', // notif baru menimpa yang lama — no spam bertumpuk
      renotify: true,
      data: { url: data.url || '/' },
    })
  );
});

// Klik notifikasi → fokus ke tab app yang sudah ada, atau buka baru
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = e.notification.data && e.notification.data.url ? e.notification.data.url : '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
