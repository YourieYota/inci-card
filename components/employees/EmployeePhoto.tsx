'use client';

import React, { useState, useEffect } from 'react';
import { ImageIcon } from 'lucide-react';
import { getEmployeesPhotos } from '@/app/actions/employees';

// Les actions serveur sont exécutées une par une : une requête par carte (24 par page)
// faisait attendre tout le reste de la page. Les demandes faites au même moment sont
// regroupées en un seul appel.
let pendingIds = new Map<string, ((url: string | null) => void)[]>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function loadPhoto(employeeId: string): Promise<string | null> {
  return new Promise((resolve) => {
    const waiters = pendingIds.get(employeeId) || [];
    waiters.push(resolve);
    pendingIds.set(employeeId, waiters);
    if (!flushTimer) {
      flushTimer = setTimeout(async () => {
        const batch = pendingIds;
        pendingIds = new Map();
        flushTimer = null;
        let photos: Record<string, string | null> = {};
        try {
          photos = await getEmployeesPhotos(Array.from(batch.keys()));
        } catch (err) {
          console.warn('Failed to fetch employee photos:', err);
        }
        batch.forEach((resolvers, id) => resolvers.forEach((r) => r(photos[id] ?? null)));
      }, 30);
    }
  });
}

interface EmployeePhotoProps {
  employeeId: string;
  hasPhoto: boolean;
  className?: string;
  photoFit?: 'cover' | 'contain';
}

export default function EmployeePhoto({
  employeeId,
  hasPhoto,
  className,
  photoFit = 'cover',
}: EmployeePhotoProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hasPhoto) {
      setPhotoUrl(null);
      return;
    }

    // Check session storage cache to avoid redundant requests
    const cacheKey = `emp-photo:${employeeId}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setPhotoUrl(cached);
        return;
      }
    } catch (e) {
      console.warn("Failed to read from sessionStorage:", e);
    }

    let isMounted = true;
    setLoading(true);

    loadPhoto(employeeId)
      .then((url) => {
        if (isMounted && url) {
          setPhotoUrl(url);
          try {
            sessionStorage.setItem(cacheKey, url);
          } catch (e) {
            console.warn("Failed to write to sessionStorage:", e);
            try {
              Object.keys(sessionStorage).forEach(k => {
                if (k.startsWith('emp-photo:')) sessionStorage.removeItem(k);
              });
            } catch (err) {}
          }
        }
      })
      .catch((err) => console.warn("Failed to fetch employee photo:", err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [employeeId, hasPhoto]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 animate-pulse">
        <ImageIcon className="w-4 h-4 text-neutral-400 opacity-50" />
      </div>
    );
  }

  if (photoUrl) {
    return (
      <img 
        src={photoUrl} 
        alt="" 
        className={className || `w-full h-full bg-white dark:bg-neutral-900 ${photoFit === 'contain' ? 'object-contain' : 'object-cover'}`} 
      />
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-900">
      <ImageIcon className="w-4 h-4 text-neutral-400 opacity-40" />
    </div>
  );
}
