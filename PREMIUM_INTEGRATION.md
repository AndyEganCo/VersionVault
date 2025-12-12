# Premium Subscription Integration Guide

## Current Setup

The premium user system is already implemented and ready for payment integration.

### Database Schema
- **Table**: `premium_users`
- **Columns**:
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `created_at` (timestamp)
- **Unique constraint** on `user_id` to prevent duplicates

### How It Works Now
- Admins can toggle premium status via the User Management page
- Premium users don't see ads on dashboard or home page
- Status is tracked in real-time via auth context

---

## Payment Integration (Stripe/Paddle/etc.)

### Option 1: Webhook Approach (Recommended)

When a user completes payment, your payment provider sends a webhook:

```typescript
// Example webhook handler (create in supabase/functions/handle-payment)
import { supabase } from '@/lib/supabase'

export async function handlePaymentWebhook(event) {
  if (event.type === 'checkout.session.completed') {
    const userId = event.data.customer_metadata.user_id

    // Add user to premium_users table
    const { error } = await supabase
      .from('premium_users')
      .upsert([{ user_id: userId }], {
        onConflict: 'user_id',
        ignoreDuplicates: true
      })

    if (error) {
      console.error('Failed to grant premium:', error)
      return { success: false }
    }

    return { success: true }
  }
}
```

### Option 2: Direct After Payment

After successful payment in your frontend:

```typescript
import { supabase } from '@/lib/supabase'

async function grantPremiumAfterPayment(userId: string) {
  const { error } = await supabase
    .from('premium_users')
    .upsert([{ user_id: userId }], {
      onConflict: 'user_id',
      ignoreDuplicates: true
    })

  if (!error) {
    // Ads will disappear immediately
    // User's isPremium will update on next auth check
    window.location.reload() // Force refresh to update auth context
  }
}
```

---

## Adding Subscription Expiry (Future Enhancement)

If you want annual renewals ($20/year), add an expiry date:

### Migration
```sql
-- Add expiry column
ALTER TABLE premium_users ADD COLUMN expires_at timestamptz;

-- Optional: Add index for efficient expiry checks
CREATE INDEX idx_premium_users_expires_at ON premium_users(expires_at);
```

### Update Auth Check
```typescript
// In auth-context.tsx, modify checkPremium:
const { data } = await supabase
  .from('premium_users')
  .select('user_id, expires_at')
  .eq('user_id', userId)
  .maybeSingle();

const isExpired = data?.expires_at && new Date(data.expires_at) < new Date();
setIsPremium(!!data && !isExpired);
```

### On Payment
```typescript
// Set expiry to 1 year from now
const expiresAt = new Date()
expiresAt.setFullYear(expiresAt.getFullYear() + 1)

await supabase
  .from('premium_users')
  .upsert([{
    user_id: userId,
    expires_at: expiresAt.toISOString()
  }], {
    onConflict: 'user_id'
  })
```

---

## Testing Premium Status

### Manual Testing
1. Go to Admin → User Management
2. Click the crown icon next to any user
3. Log in as that user
4. Verify ads don't appear on dashboard

### Simulating Payment Flow
```typescript
// In your payment success page:
const { data: { user } } = await supabase.auth.getUser()

if (user) {
  await supabase
    .from('premium_users')
    .upsert([{ user_id: user.id }])

  // Redirect to dashboard
  window.location.href = '/dashboard'
}
```

---

## Key Points

✅ **Ready Now**: System is fully functional for premium features
✅ **Simple Integration**: Just insert into `premium_users` table after payment
✅ **Instant Effect**: Ads disappear immediately after premium grant
✅ **Upsert Safe**: Won't error if user is already premium
✅ **Scalable**: Easy to add subscription management later

---

## Example: Stripe Integration

```typescript
// pages/api/create-checkout.ts
export async function createCheckout(userId: string) {
  const session = await stripe.checkout.sessions.create({
    mode: 'payment', // or 'subscription' for recurring
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: 'VersionVault Premium' },
        unit_amount: 2000, // $20.00
      },
      quantity: 1,
    }],
    customer_email: user.email,
    metadata: {
      user_id: userId, // IMPORTANT: Pass this to webhook
    },
    success_url: `${YOUR_URL}/premium/success`,
    cancel_url: `${YOUR_URL}/dashboard`,
  })

  return session.url
}

// supabase/functions/stripe-webhook/index.ts
const event = stripe.webhooks.constructEvent(
  request.body,
  signature,
  process.env.STRIPE_WEBHOOK_SECRET
)

if (event.type === 'checkout.session.completed') {
  const userId = event.data.object.metadata.user_id

  await supabase
    .from('premium_users')
    .upsert([{ user_id: userId }])
}
```

The system is already built to handle this - just connect your payment processor! 🚀
