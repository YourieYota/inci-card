'use client';

import React, { useState, useEffect } from 'react';
import { ImageIcon } from 'lucide-react';
import { getEmployeePhoto } from '@/app/actions/employees';

interface EmployeePhotoProps {
  employeeId: string;
  hasPhoto: boolean;
  className?: string;
}

export default function EmployeePhoto({
  employeeId,
  hasPhoto,
  className = "w-full h-full object-cover",
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

    getEmployeePhoto(employeeId)
      .then((url) => {
        if (isMounted && url) {
          setPhotoUrl(url);
          try {
            sessionStorage.setItem(cacheKey, url);
          } catch (e) {
            console.warn("Failed to write to sessionStorage:", e);
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
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt="" className={className} />;
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-900">
      <ImageIcon className="w-4 h-4 text-neutral-400 opacity-40" />
    </div>
  );
}
