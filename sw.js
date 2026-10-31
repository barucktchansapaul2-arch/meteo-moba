// Mode hors ligne : l'application s'ouvre même sans connexion (la dernière météo est gardée par l'appli).
const VERSION = 'rtm-meteo-v3';
const FICHIERS = ['./', 'index.html', 'style.css', 'app.js', 'villages.json', 'normales.json', 'manifest.webmanifest',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-192-maskable.png', 'icons/icon-512-maskable.png', 'icons/favicon.png', 'icons/logo.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== VERSION).map((x) => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.hostname === 'api.open-meteo.com') return;   // la météo passe toujours par le réseau
  e.respondWith(
    fetch(e.request).then((rep) => {
      if (rep.ok && (url.origin === location.origin || url.hostname === 'cdnjs.cloudflare.com')) {
        const copie = rep.clone(); caches.open(VERSION).then((c) => c.put(e.request, copie));
      }
      return rep;
    }).catch(() => caches.match(e.request))
  );
});
