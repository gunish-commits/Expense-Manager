// lib/utils/sync.ts
import { useState, useEffect } from 'react';
import { isGuestMode } from '../supabase/client';

/**
 * Custom React hook to check the online/offline status of the browser.
 * This is useful for displaying status banners and enabling local-first logic.
 */
export function useOfflineStatus() {
  const [isOffline, setIsOffline] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Set initial status
    setIsOffline(!window.navigator.onLine);

    const handleOnline = () => {
      setIsOffline(false);
      // Trigger a sync of background data if needed
      console.log('App is back online. Syncing database caches...');
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Return whether the browser is offline
  return {
    isOffline,
    isLocalGuest: isGuestMode()
  };
}

/**
 * Helper to check online status outside React components
 */
export function isBrowserOffline(): boolean {
  if (typeof window === 'undefined') return false;
  return !window.navigator.onLine;
}
