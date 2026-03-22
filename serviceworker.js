const CACHE_NAME = "letterwissel-v14";

const FILES_TO_CACHE = [
  "/letterwissel/",
  "/letterwissel/index.html",
  "/letterwissel/lwissel.css",
  "/letterwissel/lwissel.js",
  "/letterwissel/strings.js",
  "/letterwissel/woorden.txt",
  "/letterwissel/woorden_de.txt",
  "/letterwissel/woorden_fr.txt",
  "/letterwissel/woorden_en.txt",
  "/letterwissel/manifest.json",
  "/letterwissel/icons/icon-192b.png",
  "/letterwissel/icons/icon-512b.png",
  "/letterwissel/images/DE.png",
  "/letterwissel/images/EN.png",
  "/letterwissel/images/FR.png",
  "/letterwissel/images/info.png",
  "/letterwissel/images/logoFS.png",
  "/letterwissel/images/new.png",
  "/letterwissel/images/NL.png",
  "/letterwissel/images/oog.png",
  "/letterwissel/images/sluiten.png",
  "/letterwissel/images/taal.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      return (
        cached ||
        fetch(event.request).then(response => {
          return response;
        })
      );
    })
  );
});
