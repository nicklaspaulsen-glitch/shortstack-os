const CACHE_NAME = "shortstack-os-v3";
const OFFLINE_URL = "/dashboard";

// Only cache truly static assets — NOT pages or JS bundles
const PRECACHE_URLS = [
  "/icons/shortstack-logo.png",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Delete ALL old caches to force fresh content
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // API calls: network-only (never cache)
  if (url.pathname.startsWith("/api/")) return;

  // Navigation (page loads): ALWAYS go to network, no caching
  // This ensures Electron/PWA always gets the latest deployed code
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL) || new Response("Offline", { status: 503 }))
    );
    return;
  }

  // Next.js JS/CSS bundles: network-first (never serve stale bundles)
  if (url.pathname.startsWith("/_next/")) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Static assets (images, fonts only): stale-while-revalidate
  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".woff2")
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          const fetchPromise = fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          }).catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
  }
});
