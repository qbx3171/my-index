const CACHE_NAME = 'lezhe-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './community.js'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (c) {
      return c.addAll(STATIC_ASSETS).catch(function () {});
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;

  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }

  if (url.origin !== self.location.origin) return;

  if (url.pathname.indexOf('/rest/') === 0 ||
      url.pathname.indexOf('/auth/') === 0 ||
      url.pathname.indexOf('/storage/') === 0 ||
      url.pathname.indexOf('/realtime/') === 0) {
    return;
  }

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (c) { c.put(req, copy); }).catch(function () {});
        return res;
      }).catch(function () {
        return caches.match(req).then(function (r) {
          return r || caches.match('./index.html');
        }).then(function (r) {
          return r || new Response('', { status: 504, statusText: 'Offline' });
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (res) {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (c) { c.put(req, copy); }).catch(function () {});
        return res;
      }).catch(function () {
        return new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
});
