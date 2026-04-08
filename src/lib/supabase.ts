import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

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
    detectSessionInUrl: true
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

/**
 * Invoke a Supabase Edge Function and surface a useful error message.
 *
 * `supabase.functions.invoke` wraps non-2xx responses in a FunctionsHttpError
 * whose `message` is just "Edge Function returned a non-2xx status code". The
 * actual JSON body (with our specific error like "Cannot delete the last
 * remaining admin") sits unread on `error.context` as a Response. This helper
 * reads that body so callers see the real reason.
 */
export async function invokeEdgeFunction<TResponse = unknown>(
  name: string,
  body?: Record<string, unknown>
): Promise<TResponse> {
  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) {
    let message = error.message;
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === 'function') {
      try {
        const errBody = await context.json();
        if (errBody?.error) message = errBody.error;
      } catch {
        // body wasn't JSON; fall back to error.message
      }
    }
    throw new Error(message);
  }

  return data as TResponse;
}