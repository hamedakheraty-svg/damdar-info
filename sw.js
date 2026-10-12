const CACHE_NAME = "damdar-app-v9";
const ASSETS = [
  "./",
  "./index.html",
  "./admin.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./common.js",
  "./xlsx.full.min.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // تماس با گوگل اسکریپت همیشه از اینترنت
  if (req.url.includes("script.google.com") || req.url.includes("googleusercontent.com")) {
    event.respondWith(fetch(req).catch(() => new Response("[]", { headers: { "Content-Type": "application/json" } })));
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) =>
      cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        return res;
      }).catch(() => cached)
    )
  );
});
