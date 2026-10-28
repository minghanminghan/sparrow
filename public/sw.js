const STATIC = "sparrow-static";
const PAGES = "sparrow-pages";
const CURRENT = [STATIC, PAGES];

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((n) => !CURRENT.includes(n)).map((n) => caches.delete(n))),
      )
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(request, fallbackUrl) {
  const cache = await caches.open(PAGES);
  const hit = await cache.match(request);
  const fresh = fetch(request).then((res) => {
    if (res.ok && !res.redirected) cache.put(request, res.clone());
    return res;
  });
  if (hit) {
    fresh.catch(() => {});
    return hit;
  }
  try {
    return await fresh;
  } catch (err) {
    const shell = fallbackUrl && (await cache.match(fallbackUrl));
    if (shell) return shell;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/cli/")) return;
  if (request.headers.has("RSC") || url.searchParams.has("_rsc")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(
      staleWhileRevalidate(request, request.mode === "navigate" ? "/" : null),
    );
  }
});
