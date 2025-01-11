import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

// Add debug logging
console.log('Supabase URL:', supabaseUrl);

// Validate URL format
function isValidUrl(url: string) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

if (!supabaseUrl || !isValidUrl(supabaseUrl)) {
  console.error('Invalid or missing Supabase URL:', supabaseUrl);
  throw new Error('Invalid or missing VITE_SUPABASE_URL');
}

if (!supabaseKey) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  },
  global: {
    headers: {
      'X-Client-Info': 'version-vault'
    }
  },
  db: {
    schema: 'public'
  },
  realtime: {
    timeout: 30000
  }
});

// Simplified connection check
export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('tracked_software')
      .select('count')
      .single();
    
    return !error;
  } catch (err) {
    console.error('Supabase connection error:', err);
    return false;
  }
}