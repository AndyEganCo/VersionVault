// Supabase Edge Function for handling Resend webhooks
// Processes email events: delivered, opened, clicked, bounced, complained
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, svix-id, svix-signature, svix-timestamp',
}

// Resend webhook event types
type ResendEventType =
  | 'email.sent'
  | 'email.delivered'
  | 'email.opened'
  | 'email.clicked'
  | 'email.bounced'
  | 'email.complained'

interface ResendWebhookPayload {
  type: ResendEventType
  created_at: string
  data: {
    email_id: string
    from: string
    to: string[]
    subject: string
    created_at: string
    // Bounce-specific fields
    bounce?: {
      type: 'hard' | 'soft'
      message: string
    }
    // Click-specific fields
    click?: {
      link: string
      timestamp: string
    }
  }
}

serve(async (req) => {
  console.log(`📥 Received ${req.method} request to handle-email-webhook`)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify webhook signature (optional but recommended)
    const svixId = req.headers.get('svix-id')
    const svixSignature = req.headers.get('svix-signature')
    const svixTimestamp = req.headers.get('svix-timestamp')

    // For production, verify the signature using Resend's webhook secret
    // const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET')
    // ... signature verification logic ...

    const payload: ResendWebhookPayload = await req.json()
    console.log(`📧 Processing ${payload.type} event for email ${payload.data.email_id}`)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const emailId = payload.data.email_id
    const recipientEmail = payload.data.to[0]

    switch (payload.type) {
      case 'email.delivered': {
        // Update newsletter log status
        await supabase
          .from('newsletter_logs')
          .update({ status: 'delivered' })
          .eq('resend_id', emailId)

        console.log(`✅ Marked as delivered: ${emailId}`)
        break
      }

      case 'email.opened': {
        // Update newsletter log with open timestamp
        await supabase
          .from('newsletter_logs')
          .update({
            status: 'opened',
            opened_at: new Date().toISOString(),
          })
          .eq('resend_id', emailId)

        console.log(`👀 Marked as opened: ${emailId}`)
        break
      }

      case 'email.clicked': {
        // Update newsletter log with click timestamp
        await supabase
          .from('newsletter_logs')
          .update({
            status: 'clicked',
            clicked_at: new Date().toISOString(),
          })
          .eq('resend_id', emailId)

        // Track sponsor clicks if it's a sponsor link
        const clickedLink = payload.data.click?.link
        if (clickedLink) {
          // Check if this is a sponsor link and increment click count
          const { data: sponsor } = await supabase
            .from('newsletter_sponsors')
            .select('id, cta_url')
            .eq('is_active', true)
            .single()

          if (sponsor && clickedLink.includes(sponsor.cta_url)) {
            await supabase
              .from('newsletter_sponsors')
              .update({ click_count: supabase.sql`click_count + 1` })
              .eq('id', sponsor.id)

            console.log(`📊 Sponsor click tracked`)
          }
        }

        console.log(`🖱️ Marked as clicked: ${emailId}`)
        break
      }

      case 'email.bounced': {
        const bounceType = payload.data.bounce?.type || 'soft'
        const bounceMessage = payload.data.bounce?.message || 'Unknown reason'

        // Get user ID from newsletter log
        const { data: logEntry } = await supabase
          .from('newsletter_logs')
          .select('user_id')
          .eq('resend_id', emailId)
          .single()

        if (logEntry) {
          // Record bounce
          await supabase
            .from('email_bounces')
            .insert({
              user_id: logEntry.user_id,
              email: recipientEmail,
              bounce_type: bounceType,
              reason: bounceMessage,
              resend_id: emailId,
            })

          // Update newsletter log
          await supabase
            .from('newsletter_logs')
            .update({
              status: 'bounced',
              bounced_at: new Date().toISOString(),
            })
            .eq('resend_id', emailId)

          // Check if we should disable notifications for this user (3+ hard bounces)
          if (bounceType === 'hard') {
            const { count } = await supabase
              .from('email_bounces')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', logEntry.user_id)
              .eq('bounce_type', 'hard')
              .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

            if ((count || 0) >= 3) {
              // Disable email notifications for this user
              await supabase
                .from('user_settings')
                .update({ email_notifications: false })
                .eq('user_id', logEntry.user_id)

              console.log(`🚫 Disabled notifications for user ${logEntry.user_id} due to repeated bounces`)
            }
          }
        }

        console.log(`📛 Recorded ${bounceType} bounce: ${emailId}`)
        break
      }

      case 'email.complained': {
        // User marked as spam - similar handling to hard bounce
        const { data: logEntry } = await supabase
          .from('newsletter_logs')
          .select('user_id')
          .eq('resend_id', emailId)
          .single()

        if (logEntry) {
          // Record as hard bounce (spam complaint is serious)
          await supabase
            .from('email_bounces')
            .insert({
              user_id: logEntry.user_id,
              email: recipientEmail,
              bounce_type: 'hard',
              reason: 'Spam complaint',
              resend_id: emailId,
            })

          // Update newsletter log
          await supabase
            .from('newsletter_logs')
            .update({ status: 'complained' })
            .eq('resend_id', emailId)

          // Immediately disable notifications (spam complaint is serious)
          await supabase
            .from('user_settings')
            .update({ email_notifications: false })
            .eq('user_id', logEntry.user_id)

          console.log(`⚠️ Disabled notifications for user ${logEntry.user_id} due to spam complaint`)
        }

        console.log(`🚨 Recorded spam complaint: ${emailId}`)
        break
      }

      default:
        console.log(`ℹ️ Unhandled event type: ${payload.type}`)
    }

    return new Response(
      JSON.stringify({ success: true, event: payload.type }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in handle-email-webhook:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
