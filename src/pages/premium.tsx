import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { createPremiumCheckoutSession, getSubscriptionStatus, createCustomerPortalSession } from '@/lib/api/stripe';
import { Check, Sparkles, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Premium() {
  const { user, isPremium } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    if (user) {
      checkSubscription();
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
      // Redirect to Stripe Checkout
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
      <div className="container max-w-4xl mx-auto py-12">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">
          Upgrade to Premium
        </h1>
        <p className="text-xl text-muted-foreground">
          Support VersionVault and enjoy an ad-free experience
        </p>
      </div>

      {/* Premium Plan Card */}
      <Card className="border-2 border-primary shadow-lg">
        <CardHeader className="text-center pb-8">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-3xl mb-2">Premium</CardTitle>
          <CardDescription className="text-lg">
            One simple plan, unlimited value
          </CardDescription>
          <div className="mt-6">
            <span className="text-5xl font-bold">$25</span>
            <span className="text-muted-foreground">/year</span>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Features */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Ad-Free Experience</p>
                <p className="text-sm text-muted-foreground">
                  No more distractions - enjoy VersionVault without any advertisements
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Support Development</p>
                <p className="text-sm text-muted-foreground">
                  Help keep VersionVault running and fund new features
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">All Features Included</p>
                <p className="text-sm text-muted-foreground">
                  Track unlimited software, custom notifications, and more
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Zap className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Priority Support</p>
                <p className="text-sm text-muted-foreground">
                  Get faster responses to your questions and feature requests
                </p>
              </div>
            </div>
          </div>

          {/* Status */}
          {isPremium && subscription && (
            <div className="bg-primary/10 border border-primary rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Check className="h-5 w-5 text-primary" />
                <span className="font-medium">Active Subscription</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Your premium subscription renews on{' '}
                {new Date(subscription.current_period_end).toLocaleDateString()}
              </p>
            </div>
          )}

          {isPremium && !subscription && (
            <div className="bg-primary/10 border border-primary rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5 text-primary" />
                <span className="font-medium">Legacy Premium Member</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                You have lifetime premium access
              </p>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          {!isPremium ? (
            <Button
              onClick={handleUpgrade}
              disabled={loading}
              size="lg"
              className="w-full text-lg py-6"
            >
              {loading ? 'Loading...' : 'Upgrade to Premium'}
            </Button>
          ) : subscription ? (
            <Button
              onClick={handleManageSubscription}
              disabled={loading}
              variant="outline"
              size="lg"
              className="w-full"
            >
              {loading ? 'Loading...' : 'Manage Subscription'}
            </Button>
          ) : null}

          <p className="text-xs text-center text-muted-foreground">
            Secure payment processing by Stripe. Cancel anytime.
          </p>
        </CardFooter>
      </Card>

      {/* FAQ / Additional Info */}
      <div className="mt-12 space-y-6">
        <h2 className="text-2xl font-bold text-center">Frequently Asked Questions</h2>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Can I cancel anytime?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Yes! You can cancel your subscription at any time. You'll continue to have premium access until the end of your billing period.
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
              <CardTitle className="text-lg">What happens to my data?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Nothing changes! All your tracked software and settings remain exactly the same, regardless of your subscription status.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Want to support differently?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Prefer a one-time donation? Visit our{' '}
                <a href="/donate" className="text-primary hover:underline">
                  donation page
                </a>{' '}
                to make a one-time contribution.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
