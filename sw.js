/* 旧版 Service Worker 已废弃（当前页面不再注册 sw.js）。
   保留这个「自我注销」版本：老访客浏览器里仍残留的旧 SW 会在下一次更新检查时
   拉取本文件、安装后清空缓存并注销自己，避免它继续用缓存返回过期的首页/详情页。

   2026-10-31 修复记录：
   1) 原实现预热 ./community.js —— 仓库里实际文件是 community-2026.js，
      addAll() 整体失败且异常被 catch 吞掉，导致预缓存永远是空的、离线兜底也拿不到页面；
   2) 原 fetch 处理器缓存名固定为 lezhe-v1，页面更新后老访客可能长期拿到旧版本；
   3) 既然没有任何页面再注册它，与其留着半坏的缓存逻辑，不如让它自毁。
*/
self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    (async function () {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch (err) {
        /* 清缓存失败也要继续注销 */
      }
      try {
        await self.registration.unregister();
      } catch (err) {
        /* ignore */
      }
    })()
  );
});
