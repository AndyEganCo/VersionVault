import { supabase } from '@/lib/supabase';

/**
 * Create a Stripe Checkout session for premium subscription ($50/year)
 */
export async function createPremiumCheckoutSession(userId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: {
      userId,
      mode: 'subscription',
      priceId: import.meta.env.VITE_STRIPE_PREMIUM_PRICE_ID,
    },
  });

  if (error) {
    console.error('Error creating checkout session:', error);
    throw new Error('Failed to create checkout session');
  }

  return data.url;
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
