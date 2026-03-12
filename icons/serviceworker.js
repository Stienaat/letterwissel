const CACHE_NAME = "letterwissel-v14";

const FILES_TO_CACHE = [
  "/Letterwissel/",
  "/Letterwissel/index.html",
  "/Letterwissel/letterwissel.css",
  "/Letterwissel/letterwissel.js",
  "/Letterwissel/i18n.js",
  "/Letterwissel/woorden.txt",
  "/Letterwissel/woorden_de.txt",
  "/Letterwissel/woorden_fr.txt",
  "/Letterwissel/woorden_en.txt",
  "/Letterwissel/manifest.json",
  "/Letterwissel/icons/icon-192b.png",
  "/Letterwissel/icons/icon-512b.png",
  "/Letterwissel/images/DE.png",
  "/Letterwissel/images/EN.png",
  "/Letterwissel/images/FR.png",
  "/Letterwissel/images/info.png",
  "/Letterwissel/images/logoFS.png",
  "/Letterwissel/images/new.png",
  "/Letterwissel/images/NL.png",
  "/Letterwissel/images/oog.png",
  "/Letterwissel/images/sluiten.png",
  "/Letterwissel/images/taal.png"
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

