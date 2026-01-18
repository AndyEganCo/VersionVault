// Newsletter Authentication Utility
// Shared auth logic for all newsletter edge functions

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Authorize newsletter cron requests
 * Checks CRON_SECRET header or JWT + admin status
 */
export async function authorizeRequest(req: Request): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  // Check CRON_SECRET first (preferred for cron jobs)
  const cronSecret = getCronSecret(req)
  const expectedSecret = Deno.env.get('CRON_SECRET')

  if (cronSecret && cronSecret === expectedSecret) {
    return // Authorized via cron secret
  }

  // Fallback: Check JWT and admin status
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Unauthorized: Missing or invalid authorization')
  }

  const token = authHeader.replace('Bearer ', '')

  // Verify JWT
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    throw new Error('Unauthorized: Invalid token')
  }

  // Check if user is admin
  const { data: adminUser, error: adminError } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', user.id)
    .single()

  if (adminError || !adminUser) {
    throw new Error('Unauthorized: Admin access required')
  }

  // User is authorized admin
  return
}

/**
 * Extract cron secret from request headers
 * Checks both X-Cron-Secret and Authorization Bearer
 */
function getCronSecret(req: Request): string | null {
  // Check custom header first
  const headerSecret = req.headers.get('X-Cron-Secret')
  if (headerSecret) return headerSecret

  // Check Authorization Bearer (cron can send as bearer token)
  const authHeader = req.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '')
    // If it's not a JWT (no dots), treat as cron secret
    if (!token.includes('.')) {
      return token
    }
  }

  return null
}

/**
 * Get CORS headers for responses
 */
export function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  }
}
