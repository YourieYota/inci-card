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
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k !== key && k.startsWith('inci-cache:')) {
            keysToRemove.push(k);
          }
        }

        if (keysToRemove.length > 0) {
          keysToRemove.forEach((k) => {
            localStorage.removeItem(k);
          });

          // Retry after eviction
          localStorage.setItem(key, value);
          return true;
        }
      } catch (retryError) {
        // Silently handle if quota remains full for transient cache
      }
    }
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

/**
 * Strips bulky base64 data URLs or long image strings from employee objects before storing them in localStorage cache.
 * This prevents QuotaExceededError while retaining metadata for offline support.
 */
export function cleanEmployeesForCache(employees: any[]): any[] {
  if (!Array.isArray(employees)) return [];
  return employees.map((emp) => {
    let cleanEmp = { ...emp };
    
    const stripIfLarge = (val: any) => {
      if (typeof val === 'string' && (val.startsWith('data:') || val.length > 300)) {
        return null;
      }
      return val;
    };

    cleanEmp.photoUrl = stripIfLarge(cleanEmp.photoUrl);
    cleanEmp.idCardRectoUrl = stripIfLarge(cleanEmp.idCardRectoUrl);
    cleanEmp.idCardVersoUrl = stripIfLarge(cleanEmp.idCardVersoUrl);
    cleanEmp.signatureUrl = stripIfLarge(cleanEmp.signatureUrl);
    
    // Deep strip data: URIs in customFields
    if (cleanEmp.customFields) {
      try {
        const fields = typeof cleanEmp.customFields === 'string' ? JSON.parse(cleanEmp.customFields) : cleanEmp.customFields;
        let modified = false;
        for (const k in fields) {
          if (typeof fields[k] === 'string' && (fields[k].startsWith('data:') || fields[k].length > 300)) {
            fields[k] = '[omitted_for_cache]';
            modified = true;
          }
        }
        if (modified) {
          cleanEmp.customFields = typeof cleanEmp.customFields === 'string' ? JSON.stringify(fields) : fields;
        }
      } catch(e) {}
    }
    return cleanEmp;
  });
}

/**
 * Strips bulky base64 data URLs from template elements (like huge background images)
 * before storing them in localStorage cache.
 */
export function cleanTemplateForCache(template: any): any {
  if (!template) return template;
  try {
    let cleanTpl = { ...template };
    let config = cleanTpl.layoutConfig;
    if (typeof config === 'string') {
      config = JSON.parse(config);
    }
    if (config) {
      const processElements = (elements: any[]) => {
        if (!Array.isArray(elements)) return;
        elements.forEach(el => {
          if (el.type === 'image' && el.src && (el.src.startsWith('data:') || el.src.length > 300)) {
            el.src = ''; // Clear heavy image source for offline cache
          }
        });
      };
      
      if (Array.isArray(config)) {
        processElements(config);
      } else if (typeof config === 'object') {
        processElements(config.elements);
        processElements(config.recto?.elements);
        processElements(config.verso?.elements);
      }
      
      cleanTpl.layoutConfig = typeof cleanTpl.layoutConfig === 'string' ? JSON.stringify(config) : config;
    }
    return cleanTpl;
  } catch (e) {
    return template;
  }
}
