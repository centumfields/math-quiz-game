/* 서비스 워커: 처음 한 번 파일을 모두 저장해 두고, 이후에는 인터넷 없이도 실행해요.
 * 앱 파일(index.html, app.js, questions.js 등)을 고쳤다면 VERSION 을 올려 주세요.
 * 그래야 이미 설치된 앱이 새 파일로 바뀌어요. */
var VERSION = "v1";
var CACHE = "mathquiz-" + VERSION;
var ASSETS = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "logic.js",
  "questions.js",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // cache: "reload" — 브라우저의 낡은 임시 저장본이 아니라 서버의 최신 파일을 받아요
      return cache.addAll(ASSETS.map(function (url) { return new Request(url, { cache: "reload" }); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return k.indexOf("mathquiz-") === 0 && k !== CACHE;
      }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    // ?check=1 같은 주소 뒤의 값은 무시하고 저장해 둔 파일을 찾아요
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      return fetch(req).catch(function () {
        // 인터넷이 없고 저장본도 없을 때: 페이지 이동이면 앱 첫 화면을 보여줘요
        if (req.mode === "navigate") return caches.match("index.html");
        return Response.error();
      });
    })
  );
});
