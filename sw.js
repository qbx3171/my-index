var CACHE_NAME='lezhe-v5';

self.addEventListener('install',function(e){
self.skipWaiting();
e.waitUntil(caches.open(CACHE_NAME).then(function(cache){
return cache.addAll(['./']);
}));
});

self.addEventListener('activate',function(e){
e.waitUntil(caches.keys().then(function(keys){
return Promise.all(keys.map(function(k){
if(k!==CACHE_NAME)return caches.delete(k);
}));
}).then(function(){return self.clients.claim();}));
});

self.addEventListener('fetch',function(e){
if(e.request.method!=='GET')return;
var url=e.request.url;
if(url.indexOf('community.js')!==-1||url.indexOf('sw.js')!==-1){
e.respondWith(fetch(e.request,{cache:'no-store'}).catch(function(){return caches.match(e.request);}));
return;
}
e.respondWith(
fetch(e.request).then(function(res){
if(res&&res.status===200&&res.type==='basic'){
var clone=res.clone();
caches.open(CACHE_NAME).then(function(cache){cache.put(e.request,clone);});
}
return res;
}).catch(function(){
return caches.match(e.request);
})
);
});
