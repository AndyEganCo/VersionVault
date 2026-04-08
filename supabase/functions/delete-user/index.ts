// Supabase Edge Function for hard-deleting users
// Allows admins to delete any user, and users to delete their own accounts.
// Cascades through all related tables via existing ON DELETE CASCADE foreign keys.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function jsonResponse(body: unknown, status: number) {
  return new Response(
    JSON.stringify(body),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

serve(async (req) => {
  console.log(`📥 Received ${req.method} request to delete-user`)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401)
    }

    // Initialize Supabase admin client (service role)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the JWT token and get the caller
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !caller) {
      console.error('Authentication error:', authError)
      return jsonResponse({ error: 'Invalid authentication' }, 401)
    }

    // Parse request body. Malformed JSON should be a 400, not a 500.
    let userId: unknown
    try {
      const body = await req.json()
      userId = body?.userId
    } catch (_parseError) {
      return jsonResponse({ error: 'Invalid request body' }, 400)
    }

    if (typeof userId !== 'string' || !UUID_RE.test(userId)) {
      return jsonResponse({ error: 'Missing or invalid userId' }, 400)
    }

    // Authorization: caller must be either deleting themselves or be an admin
    const isSelfDelete = userId === caller.id

    if (!isSelfDelete) {
      const { data: adminRow, error: adminError } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', caller.id)
        .maybeSingle()

      if (adminError) {
        console.error('Admin check failed:', adminError)
        return jsonResponse({ error: 'Authorization check failed' }, 500)
      }

      if (!adminRow) {
        console.warn(`⚠️ Non-admin user ${caller.id} attempted to delete user ${userId}`)
        return jsonResponse({ error: 'Forbidden' }, 403)
      }
    }

    // Atomically protect against deleting the last remaining admin. The RPC
    // takes an EXCLUSIVE lock on admin_users, verifies the count, and removes
    // the target's admin row inside the lock. This serializes concurrent
    // delete-user calls so two admins cannot simultaneously delete each other
    // and leave the system with zero admins.
    const { error: prepError } = await supabase.rpc('prepare_user_deletion', {
      target_user_id: userId,
    })

    if (prepError) {
      // P0001 = our own RAISE EXCEPTION for the last-admin guard
      if (prepError.code === 'P0001' || /last remaining admin/i.test(prepError.message ?? '')) {
        return jsonResponse({ error: 'Cannot delete the last remaining admin' }, 400)
      }
      console.error('❌ prepare_user_deletion failed:', prepError)
      return jsonResponse({ error: 'Failed to prepare user deletion' }, 500)
    }

    // Hard delete the user from auth.users -- cascades through all related tables
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.error('❌ Failed to delete user:', deleteError)
      return jsonResponse({ error: 'Failed to delete user' }, 500)
    }

    console.log(`✅ Deleted user ${userId} (initiated by ${caller.id}, self=${isSelfDelete})`)

    return jsonResponse({ success: true }, 200)

  } catch (error) {
    console.error('❌ Error in delete-user:', error)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
})
