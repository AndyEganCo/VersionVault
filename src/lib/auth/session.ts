import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

export async function getActiveSession(): Promise<Session | null> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    // Attempt to sign out via API
    await supabase.auth.signOut({ scope: 'local' });
  } catch (error) {
    // If sign out fails, just log it - we'll still clear local state
    console.warn('Sign out API call failed, forcing local clear:', error);
  }

  // Always clear all storage, even if API call failed
  // This ensures user can recover from stuck sessions
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch (storageError) {
    console.error('Error clearing storage:', storageError);
  }
}

/**
 * Force logout - clears all local auth state without making API calls.
 * Use this when the session is corrupted or the user is stuck logged in.
 * Can be called from browser console: window.forceLogout()
 */
export function forceLogout(): void {
  console.log('[Auth] Force logout initiated');

  // Clear all storage
  localStorage.clear();
  sessionStorage.clear();

  // Reload the page to reset auth state
  window.location.href = '/login';
}

export async function verifySession(): Promise<boolean> {
  try {
    const session = await getActiveSession();
    if (!session) return false;

    // Verify session with a test query
    const { error } = await supabase
      .from('tracked_software')
      .select('count', { count: 'exact', head: true });

    return !error;
  } catch (error) {
    console.error('Session verification error:', error);
    return false;
  }
}