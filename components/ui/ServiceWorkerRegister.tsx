'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
            console.log('[SW] Désenregistré en mode développement pour éviter le cache des fichiers statiques');
          }
        });
      }
      return;
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => console.log('[SW] Enregistré :', reg.scope))
        .catch((err) => console.warn('[SW] Erreur :', err));
    }
  }, []);

  return null;
}
