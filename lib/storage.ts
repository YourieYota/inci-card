'use client';

/**
 * Safely sets an item in localStorage.
 * If QuotaExceededError is thrown, it attempts to evict other non-critical caches
 * (like old employee caches, templates, and dashboard stats for other companies)
 * and retries the operation.
 * Logs via console.warn/info instead of console.error to prevent triggering Next.js dev overlay.
 */
export function safeSetItem(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error: any) {
    const isQuotaError =
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error.code === 22 ||
      error.code === 1014 ||
      (error.message && error.message.toLowerCase().includes('quota'));

    if (isQuotaError) {
      console.warn(`[Storage] LocalStorage quota exceeded when writing key "${key}". Attempting cache eviction...`);
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k !== key && k.startsWith('inci-cache:')) {
            // Retain critical structure/offline queue data; remove bulky transient caches
            if (
              k.startsWith('inci-cache:employees:') ||
              k.startsWith('inci-cache:stats:') ||
              k.startsWith('inci-cache:template:') ||
              k.startsWith('inci-cache:fields:') ||
              k.startsWith('inci-cache:dashboard-activities') ||
              k.startsWith('inci-cache:dashboard-stats')
            ) {
              keysToRemove.push(k);
            }
          }
        }

        if (keysToRemove.length > 0) {
          keysToRemove.forEach((k) => {
            localStorage.removeItem(k);
          });
          console.warn(`[Storage] Evicted ${keysToRemove.length} transient items from cache to free space.`);

          // Retry
          localStorage.setItem(key, value);
          console.info(`[Storage] Successfully wrote key "${key}" after cache eviction.`);
          return true;
        }
      } catch (retryError) {
        console.warn(`[Storage] Cache eviction failed to free enough space for key "${key}":`, retryError);
      }
    }

    console.warn(`[Storage] Failed to set item in localStorage for key "${key}":`, error);
    return false;
  }
}

/**
 * Safely retrieves an item from localStorage.
 */
export function safeGetItem(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn(`[Storage] Failed to read key "${key}" from localStorage:`, error);
    return null;
  }
}

/**
 * Safely removes an item from localStorage.
 */
export function safeRemoveItem(key: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`[Storage] Failed to remove key "${key}" from localStorage:`, error);
    return false;
  }
}
