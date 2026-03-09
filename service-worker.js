const CACHE_NAME = "letterwissel-v3";

// Automatisch juiste base path bepalen
const BASE_PATH = self.location.pathname.replace("service-worker.js", "");

const FILES_TO_CACHE = [
  "",
  "index.html",
  "letterwissel.css",
  "letterwissel.js",
  "i18n.js",
  "woorden.txt",
  "woorden_de.txt",
  "woorden_fr.txt",
  "woorden_en.txt"
  "manifest.json",
  "icons/icon-192b.png",
  "icons/icon-512b.png"
  "images/DE.png"
  "images/EN.png"
  "images/FR.png" 
  "images/info.png"
  "images/logoFS.png"
  "images/new.png" 
  "images/NL.png"
  "images/oog.png"
  "images/sluiten.png"
  "images/taal.png"
  
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
