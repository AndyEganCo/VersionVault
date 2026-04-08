import { supabase } from '@/lib/supabase';

/**
 * Create a Stripe Checkout session for premium subscription ($25/year)
 */
export async function createPremiumCheckoutSession(userId: string): Promise<string> {
  // Check if required environment variables are set
  const priceId = import.meta.env.VITE_STRIPE_PREMIUM_PRICE_ID;
  if (!priceId) {
    throw new Error('Stripe is not configured. Please set VITE_STRIPE_PREMIUM_PRICE_ID in your .env file.');
  }

  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: {
      userId,
      mode: 'subscription',
      priceId,
    },
  });

  if (error) {
    // supabase-js wraps non-2xx Edge Function responses in FunctionsHttpError with
    // a generic message. The actual error body is on error.context (a Response).
    // Pull the real Stripe error out so the user sees something useful.
    const detail = await readFunctionErrorDetail(error);
    console.error('Error creating checkout session:', error, detail);
    throw new Error(detail || error.message || 'Failed to create checkout session.');
  }

  if (!data?.url) {
    throw new Error('No checkout URL returned. Please check Edge Function logs.');
  }

  return data.url;
}

/**
 * Pull the real error message out of a supabase-js FunctionsHttpError.
 * The Edge Function returns { error, code, param, type } in the body, but
 * supabase-js only surfaces a generic "non-2xx" string on error.message.
 */
async function readFunctionErrorDetail(error: unknown): Promise<string | null> {
  try {
    const ctx = (error as { context?: Response }).context;
    if (!ctx || typeof ctx.json !== 'function') return null;
    const body = await ctx.clone().json();
    if (!body) return null;
    const parts = [body.error, body.code && `(${body.code})`, body.param && `param=${body.param}`]
      .filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : null;
  } catch {
    return null;
  }
}

/**
 * Create a Stripe Checkout session for one-time donation
 */
export async function createDonationCheckoutSession(
  userId: string,
  amount: number,
  donorName?: string,
  donorMessage?: string,
  isPublic?: boolean
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: {
      userId,
      mode: 'payment',
      amount,
      donorName,
      donorMessage,
      isPublic,
    },
  });

  if (error) {
    console.error('Error creating donation checkout session:', error);
    throw new Error('Failed to create checkout session');
  }

  return data.url;
}

/**
 * Create a Stripe Customer Portal session for managing subscription
 */
export async function createCustomerPortalSession(userId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('create-portal-session', {
    body: { userId },
  });

  if (error) {
    console.error('Error creating portal session:', error);
    throw new Error('Failed to create portal session');
  }

  return data.url;
}

/**
 * Get user's subscription status
 */
export async function getSubscriptionStatus(userId: string) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    console.error('Error fetching subscription:', error);
    return null;
  }

  return data;
}

/**
 * Get user's donation history
 */
export async function getUserDonations(userId: string) {
  const { data, error } = await supabase
    .from('donations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching donations:', error);
    return [];
  }

  return data;
}

/**
 * Generate or retrieve user's referral code
 */
export async function getReferralCode(userId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('generate-referral-code', {
    body: { userId },
  });

  if (error) {
    console.error('Error generating referral code:', error);
    throw new Error('Failed to generate referral code');
  }

  return data.code;
}

/**
 * Get user's referral stats
 */
export async function getReferralStats(userId: string) {
  const { data: referrals, error: refError } = await supabase
    .from('referrals')
    .select('*')
    .eq('referrer_id', userId)
    .order('created_at', { ascending: false });

  if (refError) {
    console.error('Error fetching referrals:', refError);
    return { referrals: [], grants: [], totalReferrals: 0, verifiedReferrals: 0, paidReferrals: 0 };
  }

  const { data: grants, error: grantError } = await supabase
    .from('premium_grants')
    .select('*')
    .eq('user_id', userId)
    .order('granted_at', { ascending: false });

  if (grantError) {
    console.error('Error fetching grants:', grantError);
  }

  return {
    referrals: referrals || [],
    grants: grants || [],
    totalReferrals: referrals?.length || 0,
    verifiedReferrals: referrals?.filter(r => r.status === 'verified' || r.status === 'paid').length || 0,
    paidReferrals: referrals?.filter(r => r.status === 'paid').length || 0,
  };
}

/**
 * Get user's active premium grant expiration
 */
export async function getGrantedUntil(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('premium_users')
    .select('granted_until')
    .eq('user_id', userId)
    .maybeSingle();

  return data?.granted_until || null;
}

/**
 * Get public donors for supporters page
 */
export async function getPublicDonors(limit = 50) {
  const { data, error } = await supabase
    .from('donations')
    .select('donor_name, amount_cents, donor_message, created_at')
    .eq('is_public', true)
    .eq('status', 'succeeded')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching public donors:', error);
    return [];
  }

  return data;
}
