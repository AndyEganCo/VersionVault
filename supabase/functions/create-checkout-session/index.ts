// Supabase Edge Function for creating Stripe Checkout sessions
// Handles both premium subscriptions and one-time donations
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log(`📥 Received ${req.method} request to create-checkout-session`)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the JWT token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error('Authentication error:', authError)
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { userId, mode, priceId, amount, donorName, donorMessage, isPublic } = await req.json()

    if (userId !== user.id) {
      return new Response(
        JSON.stringify({ error: 'User ID mismatch' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user email
    const userEmail = user.email
    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: 'User email not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) {
      console.error('❌ Missing Stripe secret key')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Check if user already has a Stripe customer ID
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .maybeSingle()

    let customerId = existingSubscription?.stripe_customer_id

    // Create or retrieve Stripe customer
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          user_id: userId,
        },
      })
      customerId = customer.id
      console.log(`✅ Created Stripe customer: ${customerId}`)
    }

    // Get the site URL for redirects
    const siteUrl = Deno.env.get('SITE_URL') || 'http://localhost:5173'

    let session: Stripe.Checkout.Session

    if (mode === 'subscription') {
      // Premium subscription checkout
      if (!priceId) {
        return new Response(
          JSON.stringify({ error: 'Price ID is required for subscriptions' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        allow_promotion_codes: true, // Enable discount/promo code field
        success_url: `${siteUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}&premium=success`,
        cancel_url: `${siteUrl}/premium?canceled=true`,
        metadata: {
          user_id: userId,
        },
        subscription_data: {
          metadata: {
            user_id: userId,
          },
        },
      })

      console.log(`✅ Created subscription checkout session: ${session.id}`)

    } else if (mode === 'payment') {
      // One-time donation checkout
      if (!amount || amount < 100) {
        return new Response(
          JSON.stringify({ error: 'Amount must be at least $1.00' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'VersionVault Donation',
                description: 'Support VersionVault development',
              },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],
        allow_promotion_codes: true, // Enable discount/promo code field
        success_url: `${siteUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}&donation=success`,
        cancel_url: `${siteUrl}/donate?canceled=true`,
        metadata: {
          user_id: userId,
          donor_name: donorName || '',
          donor_message: donorMessage || '',
          is_public: isPublic ? 'true' : 'false',
        },
      })

      console.log(`✅ Created donation checkout session: ${session.id}`)

    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid mode. Must be "subscription" or "payment"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error in create-checkout-session:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
