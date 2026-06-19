'use client';

export interface OfflineMutation {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
  description: string;
}

const QUEUE_KEY = 'inci-offline-mutations';

export function getOfflineQueue(): OfflineMutation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to read offline mutations queue:', e);
    return [];
  }
}

export function addOfflineMutation(type: string, payload: any, description: string): string {
  if (typeof window === 'undefined') return '';
  
  const id = `mut_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const mutation: OfflineMutation = {
    id,
    type,
    payload,
    timestamp: Date.now(),
    description,
  };

  try {
    const queue = getOfflineQueue();
    queue.push(mutation);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    
    // Notify all components of queue change
    window.dispatchEvent(new CustomEvent('inci-offline-mutations-changed', { detail: queue }));
  } catch (e) {
    console.error('Failed to append to offline mutations queue:', e);
  }

  return id;
}

export function clearOfflineQueue(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(QUEUE_KEY);
    window.dispatchEvent(new CustomEvent('inci-offline-mutations-changed', { detail: [] }));
  } catch (e) {
    console.error('Failed to clear offline mutations queue:', e);
  }
}

export function removeOfflineMutation(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const queue = getOfflineQueue().filter((mut) => mut.id !== id);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent('inci-offline-mutations-changed', { detail: queue }));
  } catch (e) {
    console.error('Failed to remove from offline mutations queue:', e);
  }
}
