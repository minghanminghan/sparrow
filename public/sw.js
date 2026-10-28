const STATIC = "sparrow-static";
const PAGES = "sparrow-pages";
const CURRENT = [STATIC, PAGES];
const ASSET = /\/_next\/static\/[^"'\\\s)]+/g;

self.addEventListener("install", (event) => {
  event.waitUntil(
    cacheShell("/")
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

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

function assetsOf(html) {
  return [...new Set(html.match(ASSET) ?? [])];
}

let shellQueue = Promise.resolve();

// Stores a page only once every /_next/static asset it references is cached,
// so an offline open never loads HTML whose scripts are missing. Runs one at
// a time so a prune never drops assets another page is still collecting.
function cacheShell(url, res) {
  const run = shellQueue.then(() => storeShell(url, res));
  shellQueue = run.catch(() => {});
  return run;
}

async function storeShell(url, res) {
  res = res ?? (await fetch(url));
  if (!res.ok || res.redirected) return;
  const html = await res.clone().text();
  const statics = await caches.open(STATIC);
  await Promise.all(
    assetsOf(html).map(async (a) => (await statics.match(a)) || statics.add(a)),
  );
  await (await caches.open(PAGES)).put(url, res);
  await prune();
}

async function prune() {
  const pages = await caches.open(PAGES);
  const used = new Set();
  for (const req of await pages.keys()) {
    const res = await pages.match(req);
    if (!res?.headers.get("content-type")?.includes("text/html")) continue;
    for (const a of assetsOf(await res.text())) used.add(a);
  }
  const statics = await caches.open(STATIC);
  for (const req of await statics.keys()) {
    const { pathname, search } = new URL(req.url);
    if (!used.has(pathname + search)) await statics.delete(req);
  }
}

async function cacheFirst(event) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(event.request);
  if (hit) return hit;
  const res = await fetch(event.request);
  if (res.ok) event.waitUntil(cache.put(event.request, res.clone()).catch(() => {}));
  return res;
}

async function navigate(event) {
  const { request } = event;
  const cache = await caches.open(PAGES);
  const hit = await cache.match(request);
  if (hit) {
    event.waitUntil(cacheShell(request.url).catch(() => {}));
    return hit;
  }
  try {
    const res = await fetch(request);
    event.waitUntil(cacheShell(request.url, res.clone()).catch(() => {}));
    return res;
  } catch (err) {
    const shell = await cache.match("/");
    if (shell) return shell;
    throw err;
  }
}

async function staleWhileRevalidate(event) {
  const { request } = event;
  const cache = await caches.open(PAGES);
  const hit = await cache.match(request);
  const fresh = fetch(request);
  event.waitUntil(
    fresh
      .then((res) => res.ok && !res.redirected && cache.put(request, res.clone()))
      .catch(() => {}),
  );
  return hit ?? fresh;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/cli/")) return;
  if (request.headers.has("RSC") || url.searchParams.has("_rsc")) return;

  if (url.pathname.startsWith("/_next/static/")) event.respondWith(cacheFirst(event));
  else if (request.mode === "navigate") event.respondWith(navigate(event));
  else event.respondWith(staleWhileRevalidate(event));
});
