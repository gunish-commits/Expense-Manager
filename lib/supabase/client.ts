// lib/supabase/client.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper to check if guest mode is active
export function isGuestMode(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('guest_mode') === 'true';
}

// Interface for Guest User details
export interface GuestProfile {
  id: string;
  name: string;
  avatar_url: string;
  email: string;
}

// Generate or fetch a static guest user profile
export function getGuestUser(): GuestProfile {
  const defaultGuest: GuestProfile = {
    id: '00000000-0000-0000-0000-000000000000',
    name: 'Guest Explorer',
    avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Guest',
    email: 'guest@example.com'
  };

  if (typeof window === 'undefined') return defaultGuest;

  const stored = localStorage.getItem('guest_user');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // ignore parsing error, overwrite
    }
  }

  localStorage.setItem('guest_user', JSON.stringify(defaultGuest));
  return defaultGuest;
}

// Update Guest User profile
export function updateGuestUser(name: string, avatarUrl?: string): GuestProfile {
  const currentUser = getGuestUser();
  const updated = {
    ...currentUser,
    name,
    avatar_url: avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${name}`
  };
  localStorage.setItem('guest_user', JSON.stringify(updated));
  
  // Also update in profiles list in local storage
  const profilesStr = localStorage.getItem('local_profiles');
  if (profilesStr) {
    try {
      const profiles = JSON.parse(profilesStr) as any[];
      const idx = profiles.findIndex(p => p.id === currentUser.id);
      if (idx !== -1) {
        profiles[idx] = { ...profiles[idx], name, avatar_url: updated.avatar_url };
        localStorage.setItem('local_profiles', JSON.stringify(profiles));
      }
    } catch {}
  }
  
  return updated;
}

export function enableGuestMode(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('guest_mode', 'true');
}

export function disableGuestMode(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('guest_mode');
}

