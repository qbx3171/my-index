self.addEventListener('install',function(e){
e.waitUntil(caches.open('lezhe-v1').then(function(cache){return cache.addAll(['/','/index.html','/community.js']);}));
});
self.addEventListener('fetch',function(e){
e.respondWith(caches.match(e.request).then(function(res){return res||fetch(e.request);}));
});