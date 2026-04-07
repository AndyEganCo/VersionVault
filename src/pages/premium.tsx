import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { createPremiumCheckoutSession, getSubscriptionStatus, createCustomerPortalSession } from '@/lib/api/stripe';
import { Check, X, Sparkles, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FREE_TIER_TRACKING_LIMIT } from '@/lib/software/utils/tracking';

export function Premium() {
  const { user, isPremium } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    if (user) {
      checkSubscription();
    } else {
      setCheckingStatus(false);
    }
  }, [user]);

  const checkSubscription = async () => {
    if (!user) return;

    try {
      const sub = await getSubscriptionStatus(user.id);
      setSubscription(sub);
    } catch (error) {
      console.error('Error checking subscription:', error);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleUpgrade = async () => {
    if (!user) {
      toast.error('Please sign in to upgrade');
      navigate('/login');
      return;
    }

    setLoading(true);
    try {
      const checkoutUrl = await createPremiumCheckoutSession(user.id);
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast.error('Failed to start checkout. Please try again.');
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const portalUrl = await createCustomerPortalSession(user.id);
      window.location.href = portalUrl;
    } catch (error) {
      console.error('Error opening portal:', error);
      toast.error('Failed to open subscription portal');
      setLoading(false);
    }
  };

  if (checkingStatus) {
    return (
      <div className="container max-w-5xl mx-auto py-12">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  const features = [
    { name: 'Track software apps', free: `Up to ${FREE_TIER_TRACKING_LIMIT}`, pro: 'Unlimited' },
    { name: 'Email notifications', free: 'Weekly only', pro: 'Daily, Weekly, Monthly' },
    { name: 'Version tracking', free: true, pro: true },
    { name: 'Release notes', free: true, pro: true },
    { name: 'Referral rewards', free: true, pro: true },
    { name: 'Priority support', free: false, pro: true },
  ];

  return (
    <div className="container max-w-5xl mx-auto py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">
          Choose Your Plan
        </h1>
        <p className="text-xl text-muted-foreground">
          Track software updates your way. Upgrade for unlimited power.
        </p>
      </div>

      {/* Subscription Status */}
      {isPremium && subscription && (
        <div className="bg-primary/10 border border-primary rounded-lg p-4 mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Check className="h-5 w-5 text-primary" />
            <span className="font-medium">Active Pro Subscription</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Renews on {new Date(subscription.current_period_end).toLocaleDateString()}
          </p>
          <Button
            onClick={handleManageSubscription}
            disabled={loading}
            variant="outline"
            size="sm"
            className="mt-3"
          >
            {loading ? 'Loading...' : 'Manage Subscription'}
          </Button>
        </div>
      )}

      {isPremium && !subscription && (
        <div className="bg-primary/10 border border-primary rounded-lg p-4 mb-8 text-center">
          <div className="flex items-center justify-center gap-2">
            <Check className="h-5 w-5 text-primary" />
            <span className="font-medium">Legacy Premium Member</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            You have lifetime premium access
          </p>
        </div>
      )}

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-2 gap-8 mb-12">
        {/* Free Tier */}
        <Card>
          <CardHeader className="text-center pb-8">
            <CardTitle className="text-2xl mb-2">Free</CardTitle>
            <CardDescription>Get started tracking software</CardDescription>
            <div className="mt-6">
              <span className="text-5xl font-bold">$0</span>
              <span className="text-muted-foreground">/forever</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {features.map((feature) => (
              <div key={feature.name} className="flex items-center gap-3 text-sm">
                {feature.free === false ? (
                  <X className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                ) : (
                  <Check className="h-4 w-4 text-primary flex-shrink-0" />
                )}
                <span className={feature.free === false ? 'text-muted-foreground/50' : ''}>
                  {feature.name}
                  {typeof feature.free === 'string' && (
                    <span className="text-muted-foreground"> — {feature.free}</span>
                  )}
                </span>
              </div>
            ))}
          </CardContent>
          <CardFooter>
            {!user ? (
              <Button variant="outline" className="w-full" onClick={() => navigate('/signup')}>
                Sign Up Free
              </Button>
            ) : (
              <Button variant="outline" className="w-full" disabled>
                Current Plan
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* Pro Tier */}
        <Card className="border-2 border-primary shadow-lg relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
              Most Popular
            </span>
          </div>
          <CardHeader className="text-center pb-8">
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl mb-2">Pro</CardTitle>
            <CardDescription>For power users who track everything</CardDescription>
            <div className="mt-6">
              <span className="text-5xl font-bold">$25</span>
              <span className="text-muted-foreground">/year</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">~$2/month</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {features.map((feature) => (
              <div key={feature.name} className="flex items-center gap-3 text-sm">
                <Check className="h-4 w-4 text-primary flex-shrink-0" />
                <span>
                  {feature.name}
                  {typeof feature.pro === 'string' && (
                    <span className="text-muted-foreground"> — {feature.pro}</span>
                  )}
                </span>
              </div>
            ))}
          </CardContent>
          <CardFooter>
            {!isPremium ? (
              <Button
                onClick={handleUpgrade}
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? 'Loading...' : 'Upgrade to Pro'}
              </Button>
            ) : (
              <Button className="w-full" disabled>
                Current Plan
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>

      {/* Referral CTA */}
      {!isPremium && (
        <Card className="mb-12">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Earn Pro for free</h3>
                <p className="text-sm text-muted-foreground">
                  Invite friends to VersionVault. You both get 1 month of Pro when they sign up.
                </p>
              </div>
              <Button variant="outline" onClick={() => navigate('/user/referrals')}>
                Invite Friends
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* FAQ */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-center">Frequently Asked Questions</h2>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Can I cancel anytime?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Yes! You can cancel your subscription at any time. You'll continue to have Pro access until the end of your billing period.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">What happens when I downgrade?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                If you're tracking more than {FREE_TIER_TRACKING_LIMIT} apps, you'll need to choose which {FREE_TIER_TRACKING_LIMIT} to keep. Your data is never deleted.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Is payment secure?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Absolutely. All payments are processed securely through Stripe. We never see or store your payment information.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">How do referral rewards work?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Share your referral link with friends. When they sign up, you both get 1 month of Pro free. If they subscribe, you get 3 more months.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="text-xs text-center text-muted-foreground mt-8">
        Secure payment processing by Stripe. Cancel anytime.
      </p>
    </div>
  );
}
