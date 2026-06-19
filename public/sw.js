/**
 * Service Worker — Imprimerie Nationale PWA  (v3 — sécurisé)
 *
 * RÈGLE ABSOLUE : Ne jamais intercepter les navigations HTML.
 * L'app Next.js est SSR → chaque page doit toujours atteindre le serveur.
 *
 * Seuls les assets statiques sont mis en cache (Cache First) :
 *   /_next/static/**  JS/CSS compilés par Next.js
 *   /_next/image      Images optimisées
 *   *.png/jpg/...     Images publiques
 *   *.woff2/ttf       Fonts
 */

const CACHE_NAME = 'inci-static-v3';

const PRECACHE = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/logo-imprimerie.png',
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE).catch((err) =>
        console.warn('[SW] pré-cache partiel :', err)
      )
    )
  );
  self.skipWaiting();
});

// ─── Activate : supprime tous les anciens caches (v1, v2…) ───────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Ignorer tout ce qui n'est pas GET
  if (request.method !== 'GET') return;

  // 2. Ignorer les schémas non-http (chrome-extension:// etc.)
  if (!request.url.startsWith('http')) return;

  // 3. ⚠️ JAMAIS intercepter les navigations HTML → SSR doit répondre
  if (request.mode === 'navigate') return;

  // 4. ⚠️ JAMAIS intercepter les API routes
  if (url.pathname.startsWith('/api/')) return;

  // 5. ⚠️ JAMAIS intercepter les requêtes cross-origin
  if (url.origin !== self.location.origin) return;

  // 6. Cache First uniquement pour les assets statiques
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/image') ||
    /\.(png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|otf)$/.test(url.pathname);

  if (isStaticAsset) {
    event.respondWith(cacheFirst(request));
  }

  // Tout le reste : laisser passer sans interception
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    console.warn('[SW] asset hors ligne :', request.url);
    return new Response('', { status: 503 });
  }
}
