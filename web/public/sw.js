const VERSION = "contexa-v1";
const STATIC_CACHE = `${VERSION}-static`;
const PAGES_CACHE = `${VERSION}-pages`;
const OFFLINE_URL = "/offline";
const MAX_STATIC_ENTRIES = 200;

async function precacheOfflinePage() {
  const pages = await caches.open(PAGES_CACHE);
  const response = await fetch(OFFLINE_URL, { cache: "reload" });

  if (!response.ok) {
    throw new Error(`Offline page returned ${response.status}`);
  }

  await pages.put(OFFLINE_URL, response.clone());

  const html = await response.text();
  const assets = new Set(
    [...html.matchAll(/(?:href|src)="(\/_next\/static\/[^"]+)"/g)].map(
      (m) => m[1],
    ),
  );
  const statics = await caches.open(STATIC_CACHE);
  await Promise.all(
    [...assets].map((url) => statics.add(url).catch(() => undefined)),
  );
}

async function trimStaticCache(cache) {
  const keys = await cache.keys();

  for (let i = 0; i < keys.length - MAX_STATIC_ENTRIES; i += 1) {
    await cache.delete(keys[i]);
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);

  if (response.ok) {
    await cache.put(request, response.clone());
    void trimStaticCache(cache);
  }

  return response;
}

async function networkWithOfflineFallback(request) {
  try {
    return await fetch(request);
  } catch {
    const offline = await caches.match(OFFLINE_URL);
    return offline || Response.error();
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheOfflinePage().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(`${VERSION}-`))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkWithOfflineFallback(request));
  }
});
