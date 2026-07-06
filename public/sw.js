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

const CACHE_NAME = 'inci-static-v5';

const PRECACHE = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/logo-imprimerie.png',
];

// --- Install ------------------------------------------------------------------
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

// --- Activate : supprime tous les anciens caches (v1, v2…) --------------------
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

// --- Fetch --------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Ignorer tout ce qui n'est pas GET
  if (request.method !== 'GET') return;

  // 2. Ignorer les schémas non-http (chrome-extension:// etc.)
  if (!request.url.startsWith('http')) return;

  // 3. Stratégie Network-First pour les navigations HTML (pour le mode PWA autonome)
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

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

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    console.warn('[SW] Navigation hors-ligne détectée, récupération du cache pour :', request.url);
    
    // Essayer de trouver la page en cache (en ignorant les paramètres de recherche type companyId)
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;

    // Fallback à la racine si elle est présente
    const rootCached = await caches.match('/', { ignoreSearch: true });
    if (rootCached) return rootCached;

    // Si aucune version en cache n'existe pour cette page, on sert un HTML hors-ligne propre plutôt que de lever une exception
    return new Response(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Imprimerie Nationale — Hors connexion</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #f9fafb;
            color: #1f2937;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            text-align: center;
            padding: 20px;
          }
          .card {
            background: white;
            padding: 40px;
            border-radius: 24px;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
            max-width: 400px;
            border: 1px solid #f3f4f6;
          }
          .icon {
            font-size: 48px;
            margin-bottom: 20px;
          }
          h1 {
            font-size: 18px;
            font-weight: 800;
            margin: 0 0 10px 0;
            color: #111827;
          }
          p {
            font-size: 13px;
            color: #6b7280;
            margin: 0 0 24px 0;
            line-height: 1.5;
          }
          .btn {
            background: #4f46e5;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 12px;
            font-size: 13px;
            font-weight: bold;
            cursor: pointer;
            transition: background 0.2s;
            text-decoration: none;
            display: inline-block;
          }
          .btn:hover {
            background: #4338ca;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">🔌</div>
          <h1>Mode hors-ligne indisponible</h1>
          <p>Pour pouvoir accéder à cette page sans connexion Internet, vous devez d'abord la visiter au moins une fois en étant connecté.</p>
          <a href="javascript:window.location.reload()" class="btn">Actualiser la page</a>
        </div>
      </body>
      </html>
    `, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

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
