const CACHE = "wishshelf-v1";
const CORE = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png", "./icon-180.png"];
self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE).catch(() => {})));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  // 共有シート等からの画面遷移は常にアプリ本体を返す（オフラインでも開ける／?url= はJSが読む）
  if (req.mode === "navigate") {
    e.respondWith(caches.match("./index.html").then(r => r || fetch(req).catch(() => caches.match("./"))));
    return;
  }
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return res;
    }).catch(() => r)));
  }
  // 外部（フォント・商品画像・スクショ）はそのままネットワークへ
});
