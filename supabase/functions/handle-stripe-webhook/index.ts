// Supabase Edge Function for handling Stripe webhooks
// Processes payment events: checkout completion, subscriptions, donations
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

serve(async (req) => {
  console.log(`📥 Received ${req.method} request to handle-stripe-webhook`)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get Stripe signature for webhook verification
    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      console.error('❌ Missing stripe-signature header')
      return new Response(
        JSON.stringify({ error: 'Missing stripe-signature header' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

    if (!stripeSecretKey || !webhookSecret) {
      console.error('❌ Missing Stripe configuration')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Get raw body for signature verification
    const body = await req.text()

    // Verify webhook signature
    let event: Stripe.Event
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret
      )
    } catch (err) {
      console.error(`❌ Webhook signature verification failed: ${err.message}`)
      return new Response(
        JSON.stringify({ error: `Webhook signature verification failed: ${err.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`✅ Verified webhook event: ${event.type}`)

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        console.log(`💳 Checkout completed: ${session.id}`)
        await handleCheckoutCompleted(session, stripe, supabase)
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        console.log(`📋 Subscription ${event.type}: ${subscription.id}`)
        await handleSubscriptionChange(subscription, supabase)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        console.log(`🗑️ Subscription deleted: ${subscription.id}`)
        await handleSubscriptionDeleted(subscription, supabase)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        console.log(`✅ Invoice paid: ${invoice.id}`)
        await handleInvoicePaymentSucceeded(invoice, supabase)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        console.log(`❌ Invoice payment failed: ${invoice.id}`)
        await handleInvoicePaymentFailed(invoice, supabase)
        break
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        // Only handle one-time donations (not subscription payments)
        if (!paymentIntent.invoice) {
          console.log(`💰 One-time payment succeeded: ${paymentIntent.id}`)
          await handleDonationPaymentSucceeded(paymentIntent, supabase)
        }
        break
      }

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`)
    }

    return new Response(
      JSON.stringify({ success: true, event: event.type }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error in handle-stripe-webhook:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ============================================
// Helper Functions
// ============================================

/**
 * Safely convert Unix timestamp to ISO string
 * Handles null, undefined, and invalid timestamps
 */
function toISOString(unixTimestamp: number | null | undefined): string | null {
  if (!unixTimestamp || unixTimestamp <= 0) {
    return null
  }

  try {
    const date = new Date(unixTimestamp * 1000)
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return null
    }
    return date.toISOString()
  } catch (error) {
    console.error(`❌ Error converting timestamp ${unixTimestamp}:`, error)
    return null
  }
}

// ============================================
// Handler Functions
// ============================================

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  stripe: Stripe,
  supabase: any
) {
  const userId = session.metadata?.user_id
  if (!userId) {
    console.error('❌ No user_id in checkout session metadata')
    return
  }

  const customerId = session.customer as string
  const mode = session.mode // 'subscription' or 'payment'

  if (mode === 'subscription') {
    // Premium subscription checkout
    const subscriptionId = session.subscription as string

    // Fetch full subscription details from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)

    // Create subscription record
    const { error } = await supabase
      .from('subscriptions')
      .upsert([{
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        stripe_checkout_session_id: session.id,
        status: subscription.status,
        plan_type: 'premium_yearly',
        current_period_start: toISOString(subscription.current_period_start),
        current_period_end: toISOString(subscription.current_period_end),
        cancel_at_period_end: subscription.cancel_at_period_end,
      }], {
        onConflict: 'stripe_subscription_id',
      })

    if (error) {
      console.error('❌ Error creating subscription:', error)
      throw error
    }

    console.log(`✅ Created subscription for user ${userId}`)

    // Check if this user was referred — grant referrer paid conversion reward
    await processReferralPaidReward(userId, supabase)

    // Send welcome email
    await sendSubscriptionWelcomeEmail(userId, supabase)

  } else if (mode === 'payment') {
    // One-time donation checkout
    const paymentIntentId = session.payment_intent as string
    const amount = session.amount_total || 0

    const donorName = session.metadata?.donor_name || null
    const donorMessage = session.metadata?.donor_message || null
    const isPublic = session.metadata?.is_public === 'true'

    // Create donation record
    const { error } = await supabase
      .from('donations')
      .insert([{
        user_id: userId,
        stripe_payment_intent_id: paymentIntentId,
        stripe_checkout_session_id: session.id,
        amount_cents: amount,
        currency: session.currency || 'usd',
        donor_name: donorName,
        donor_email: session.customer_details?.email,
        donor_message: donorMessage,
        is_public: isPublic,
        status: 'succeeded',
      }])

    if (error) {
      console.error('❌ Error creating donation:', error)
      throw error
    }

    console.log(`✅ Recorded donation of ${amount / 100} ${session.currency} from user ${userId}`)

    // Send thank you email
    await sendDonationThankYouEmail(userId, amount, supabase)
  }
}

async function handleSubscriptionChange(
  subscription: Stripe.Subscription,
  supabase: any
) {
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: subscription.status,
      current_period_start: toISOString(subscription.current_period_start),
      current_period_end: toISOString(subscription.current_period_end),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: toISOString(subscription.canceled_at),
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    console.error('❌ Error updating subscription:', error)
    throw error
  }

  console.log(`✅ Updated subscription ${subscription.id} status to ${subscription.status}`)
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  supabase: any
) {
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: toISOString(subscription.canceled_at) || new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    console.error('❌ Error marking subscription as deleted:', error)
    throw error
  }

  console.log(`✅ Marked subscription ${subscription.id} as canceled`)
}

async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
  supabase: any
) {
  const subscriptionId = invoice.subscription as string
  if (!subscriptionId) return

  // Ensure subscription status is active
  const { error } = await supabase
    .from('subscriptions')
    .update({ status: 'active' })
    .eq('stripe_subscription_id', subscriptionId)

  if (error) {
    console.error('❌ Error updating subscription status:', error)
  } else {
    console.log(`✅ Confirmed subscription ${subscriptionId} is active`)
  }
}

async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  supabase: any
) {
  const subscriptionId = invoice.subscription as string
  if (!subscriptionId) return

  // Mark subscription as past_due
  const { error } = await supabase
    .from('subscriptions')
    .update({ status: 'past_due' })
    .eq('stripe_subscription_id', subscriptionId)

  if (error) {
    console.error('❌ Error updating subscription status:', error)
  } else {
    console.log(`⚠️ Marked subscription ${subscriptionId} as past_due`)
  }
}

async function handleDonationPaymentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
  supabase: any
) {
  // Update donation status if it exists
  const { error } = await supabase
    .from('donations')
    .update({ status: 'succeeded' })
    .eq('stripe_payment_intent_id', paymentIntent.id)

  if (error) {
    console.error('❌ Error updating donation status:', error)
  } else {
    console.log(`✅ Confirmed donation payment ${paymentIntent.id}`)
  }
}

// ============================================
// Email Helper Functions
// ============================================

async function sendSubscriptionWelcomeEmail(userId: string, supabase: any) {
  // TODO: Queue welcome email via Resend
  // This will be implemented when we create the email templates
  console.log(`📧 TODO: Send welcome email to user ${userId}`)
}

async function sendDonationThankYouEmail(userId: string, amount: number, supabase: any) {
  // TODO: Queue thank you email via Resend
  // This will be implemented when we create the email templates
  console.log(`📧 TODO: Send thank you email to user ${userId} for ${amount / 100}`)
}

// ============================================
// Referral Helper Functions
// ============================================

async function processReferralPaidReward(subscriberId: string, supabase: any) {
  try {
    // Check if this subscriber was referred by someone
    const { data: referral } = await supabase
      .from('referrals')
      .select('*')
      .eq('referred_user_id', subscriberId)
      .eq('paid_rewarded', false)
      .maybeSingle()

    if (!referral) {
      console.log('ℹ️ No unrewarded referral found for subscriber')
      return
    }

    // Grant 3 months to referrer for paid conversion
    const expiry = new Date()
    expiry.setMonth(expiry.getMonth() + 3)

    const { error: grantError } = await supabase
      .from('premium_grants')
      .insert({
        user_id: referral.referrer_id,
        months_granted: 3,
        source: 'referral_paid',
        referral_id: referral.id,
        expires_at: expiry.toISOString(),
      })

    if (grantError) {
      console.error('❌ Error granting referral paid reward:', grantError)
      return
    }

    // Mark referral as paid
    await supabase
      .from('referrals')
      .update({ status: 'paid', paid_rewarded: true })
      .eq('id', referral.id)

    console.log(`✅ Granted 3 months to referrer ${referral.referrer_id} for paid conversion`)
  } catch (error) {
    console.error('❌ Error processing referral paid reward:', error)
  }
}
