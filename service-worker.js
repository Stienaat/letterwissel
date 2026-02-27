const CACHE_NAME = "letterwissel-v3";

// Automatisch juiste base path bepalen
const BASE_PATH = self.location.pathname.replace("service-worker.js", "");

const FILES_TO_CACHE = [
  "",
  "index.html",
  "letterwissel.css",
  "letterwissel.js",
  "woorden.txt",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(
        FILES_TO_CACHE.map(file => BASE_PATH + file)
      );
    })
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
