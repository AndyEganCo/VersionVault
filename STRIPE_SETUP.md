# Stripe Integration Setup Guide

This guide walks you through setting up Stripe payments for VersionVault's premium subscriptions and donations.

## Overview

**What you're implementing:**
- **Premium Subscription**: $50/year removes ads and supports development
- **One-time Donations**: $5, $10, $25, $50, custom amounts
- **Stripe Checkout**: Secure, PCI-compliant payment processing
- **Customer Portal**: Let users manage their subscriptions
- **Webhooks**: Automatic premium status updates

---

## Step 1: Create Stripe Account

1. Go to https://stripe.com/register
2. Sign up for a Stripe account
3. Complete business information (can start with personal details)
4. Activate your account (you'll start in test mode)

---

## Step 2: Get Your Stripe API Keys

### Test Mode Keys (for development)

1. In Stripe Dashboard, go to **Developers → API keys**
2. You'll see two keys in test mode:
   - **Publishable key**: `pk_test_...` (safe to expose in frontend)
   - **Secret key**: `sk_test_...` (keep private, server-side only)
3. Copy both keys

### Where to add them:

#### Option A: Local Development (.env file)
```bash
# Frontend (.env in root directory)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
VITE_STRIPE_PREMIUM_PRICE_ID=price_xxx  # Created in Step 3

# Backend (Supabase secrets - see Step 4)
```

#### Option B: Vercel (Production)
1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Add:
   - `VITE_STRIPE_PUBLISHABLE_KEY` = `pk_test_...`
   - `VITE_STRIPE_PREMIUM_PRICE_ID` = (from Step 3)

---

## Step 3: Create Premium Subscription Product in Stripe

### Create the Product

1. In Stripe Dashboard, go to **Products**
2. Click **+ Add Product**
3. Fill in:
   - **Name**: `VersionVault Premium`
   - **Description**: `Ad-free experience + support development`
   - **Pricing**:
     - **Price**: `$50.00`
     - **Billing period**: `Yearly`
     - **Currency**: `USD`
4. Click **Save product**

### Get the Price ID

1. After creating, click on the product
2. Find the **Pricing** section
3. Copy the **Price ID** (starts with `price_...`)
4. Add this to your environment variables as `VITE_STRIPE_PREMIUM_PRICE_ID`

Example:
```bash
VITE_STRIPE_PREMIUM_PRICE_ID=price_1ABC123xyz456
```

---

## Step 4: Configure Supabase Secrets

Your Stripe secret key and webhook secret need to be stored in Supabase (not in your `.env` file).

### Install Supabase CLI (if not already installed)

```bash
npm install -g supabase
```

### Link to your project

```bash
supabase link --project-ref your-project-ref
```

### Set the secrets

```bash
# Stripe secret key (from Step 2)
supabase secrets set STRIPE_SECRET_KEY=sk_test_your_secret_key_here

# Webhook secret (from Step 5 - come back to this)
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Site URL (your frontend URL)
supabase secrets set SITE_URL=https://your-domain.com
# For local dev:
supabase secrets set SITE_URL=http://localhost:5173
```

---

## Step 5: Set Up Stripe Webhooks

Webhooks notify your backend when payments succeed, subscriptions are canceled, etc.

### Deploy Your Edge Functions First

```bash
# Deploy all three Stripe-related functions
supabase functions deploy handle-stripe-webhook
supabase functions deploy create-checkout-session
supabase functions deploy create-portal-session
```

### Get Your Webhook URL

Your webhook URL will be:
```
https://[your-supabase-project-ref].supabase.co/functions/v1/handle-stripe-webhook
```

### Configure in Stripe Dashboard

1. Go to **Developers → Webhooks**
2. Click **+ Add endpoint**
3. Enter your webhook URL (from above)
4. Click **Select events**
5. Select these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `payment_intent.succeeded`
6. Click **Add events** then **Add endpoint**

### Get Webhook Signing Secret

1. After creating the webhook, click on it
2. Find **Signing secret** (starts with `whsec_...`)
3. Click **Reveal**
4. Copy the secret
5. Add it to Supabase secrets:
   ```bash
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your_secret_here
   ```

---

## Step 6: Run Database Migration

Apply the subscriptions and donations schema:

```bash
# If using Supabase CLI
supabase db push

# Or manually in Supabase SQL Editor:
# Run the contents of: supabase/migrations/20260113000000_add_subscriptions_and_donations.sql
```

This creates:
- `subscriptions` table
- `donations` table
- Triggers to sync premium status
- RLS policies

---

## Step 7: Test the Integration

### Test Premium Subscription

1. Go to `/premium` page
2. Click **Upgrade to Premium**
3. Use Stripe test card:
   - **Card number**: `4242 4242 4242 4242`
   - **Expiry**: Any future date
   - **CVC**: Any 3 digits
   - **ZIP**: Any 5 digits
4. Complete checkout
5. Verify:
   - Redirected to dashboard with success message
   - User shows as premium (no ads)
   - Subscription appears in `/admin/subscriptions`
   - Entry in `subscriptions` table
   - Entry in `premium_users` table

### Test Donation

1. Go to `/donate` page
2. Select an amount ($10)
3. Fill in optional donor name and message
4. Toggle "Public Recognition" if desired
5. Click **Donate**
6. Use same test card as above
7. Verify:
   - Redirected to dashboard
   - Donation appears in `/admin/donations`
   - Entry in `donations` table

### Test Webhook Events

1. In Stripe Dashboard, go to **Developers → Webhooks**
2. Click on your webhook endpoint
3. Click **Send test webhook**
4. Select `checkout.session.completed`
5. Click **Send test webhook**
6. Check that webhook received successfully (200 response)

### Test Subscription Management

1. As a premium user, go to `/premium`
2. Click **Manage Subscription**
3. Verify Stripe Customer Portal opens
4. Test updating payment method
5. Test canceling subscription (it will cancel at period end)

---

## Step 8: Switch to Live Mode (Production)

Once testing is complete and you're ready to accept real payments:

### Enable Live Mode in Stripe

1. Complete Stripe account activation (business verification)
2. Provide tax information
3. Add bank account for payouts

### Get Live API Keys

1. In Stripe Dashboard, toggle to **Live mode** (top right)
2. Go to **Developers → API keys**
3. Copy your **live** keys:
   - Publishable key: `pk_live_...`
   - Secret key: `sk_live_...`

### Update Environment Variables

#### Vercel (Production)
```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_live_key
VITE_STRIPE_PREMIUM_PRICE_ID=price_xxx  # Live price ID from live product
```

#### Supabase Secrets
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_your_live_key
```

### Create Live Product & Webhook

1. Recreate the Premium product in **live mode** (same as Step 3)
2. Get the new **live** price ID
3. Create a new webhook endpoint in **live mode** (same as Step 5)
4. Update webhook secret:
   ```bash
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your_live_secret
   ```

---

## Environment Variables Checklist

### Frontend (.env or Vercel)
- ✅ `VITE_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- ✅ `VITE_STRIPE_PREMIUM_PRICE_ID` - Premium subscription price ID

### Backend (Supabase Secrets)
- ✅ `STRIPE_SECRET_KEY` - Stripe secret key (server-side)
- ✅ `STRIPE_WEBHOOK_SECRET` - Webhook signing secret
- ✅ `SITE_URL` - Your frontend URL (for redirects)

### Verify Supabase Secrets
```bash
supabase secrets list
```

---

## Troubleshooting

### Payment not working

**Check:**
1. Are you using the correct test card? (`4242 4242 4242 4242`)
2. Is `VITE_STRIPE_PUBLISHABLE_KEY` set correctly?
3. Is the price ID correct in your `.env`?

### Webhook not triggering

**Check:**
1. Is the webhook URL correct?
2. Did you deploy the `handle-stripe-webhook` function?
3. Check webhook logs in Stripe Dashboard → Developers → Webhooks
4. Is `STRIPE_WEBHOOK_SECRET` set in Supabase secrets?
5. Check Edge Function logs: `supabase functions logs handle-stripe-webhook`

### Premium status not updating

**Check:**
1. Webhook events being received (Stripe Dashboard → Webhooks)
2. Check Edge Function logs for errors
3. Verify subscription record in `subscriptions` table
4. Check if trigger is working (should auto-update `premium_users`)

### User can't manage subscription

**Check:**
1. Does user have a `stripe_customer_id` in `subscriptions` table?
2. Is `create-portal-session` function deployed?
3. Check browser console for errors

---

## Security Notes

🔒 **Never commit these to version control:**
- Stripe secret keys (`sk_test_...` or `sk_live_...`)
- Webhook secrets (`whsec_...`)

✅ **Safe to commit:**
- Publishable keys (`pk_test_...` or `pk_live_...`)
- Price IDs (`price_...`)

🛡️ **Best practices:**
- Use test mode for development
- Only switch to live mode when ready for production
- Regularly check webhook logs for failed events
- Monitor failed payments in Stripe Dashboard

---

## Support & Resources

- **Stripe Documentation**: https://stripe.com/docs
- **Test Cards**: https://stripe.com/docs/testing
- **Webhook Events**: https://stripe.com/docs/api/events/types
- **Supabase Edge Functions**: https://supabase.com/docs/guides/functions

---

## Quick Start Checklist

- [ ] Create Stripe account
- [ ] Get test API keys
- [ ] Create Premium product ($50/year)
- [ ] Get price ID
- [ ] Set environment variables (`.env` + Supabase secrets)
- [ ] Deploy Edge Functions
- [ ] Create webhook endpoint
- [ ] Set webhook secret
- [ ] Run database migration
- [ ] Test premium subscription
- [ ] Test donation
- [ ] Test webhook events
- [ ] Verify premium status updates
- [ ] Switch to live mode (when ready)

That's it! You're now ready to accept payments. 🎉
