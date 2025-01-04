import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { toast } from 'sonner';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables');
  toast.error('Please connect to Supabase using the "Connect to Supabase" button');
}

export const supabase = createClient<Database>(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: localStorage,
      storageKey: 'versionvault.auth.token'
    }
  }
);

// Verify connection and session
export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;
    
    // Verify connection with a simple query
    const { error } = await supabase.from('tracked_software').select('count');
    return !error;
  } catch {
    return false;
  }
}