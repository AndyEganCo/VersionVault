import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  createPremiumCheckoutSession,
  createDonationCheckoutSession,
  getSubscriptionStatus,
  createCustomerPortalSession
} from '@/lib/api/stripe';
import { Check, Sparkles, Heart, Coffee, Zap, TrendingUp, DollarSign } from 'lucide-react';

const SUGGESTED_AMOUNTS = [5, 10, 25, 50, 100];

export function Contribute() {
  const { user, isPremium } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Premium state
  const [premiumLoading, setPremiumLoading] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Donation state
  const [donationLoading, setDonationLoading] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [donorName, setDonorName] = useState('');
  const [donorMessage, setDonorMessage] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  // Get initial tab from URL or default based on premium status
  const initialTab = searchParams.get('tab') || (isPremium ? 'donate' : 'premium');
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (user) {
      checkSubscription();
    }
  }, [user]);

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    searchParams.set('tab', value);
    setSearchParams(searchParams, { replace: true });
  };

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
      return;
    }

    setPremiumLoading(true);
    try {
      const checkoutUrl = await createPremiumCheckoutSession(user.id);
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast.error('Failed to start checkout. Please try again.');
      setPremiumLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!user) return;

    setPremiumLoading(true);
    try {
      const portalUrl = await createCustomerPortalSession(user.id);
      window.location.href = portalUrl;
    } catch (error) {
      console.error('Error opening portal:', error);
      toast.error('Failed to open subscription portal');
      setPremiumLoading(false);
    }
  };

  const handleDonate = async () => {
    if (!user) {
      toast.error('Please sign in to make a donation');
      return;
    }

    const amount = selectedAmount || parseFloat(customAmount);

    if (!amount || amount < 1) {
      toast.error('Please enter a valid amount');
      return;
    }

    setDonationLoading(true);
    try {
      const checkoutUrl = await createDonationCheckoutSession(
        user.id,
        Math.round(amount * 100),
        donorName || undefined,
        donorMessage || undefined,
        isPublic
      );

      window.location.href = checkoutUrl;
    } catch (error) {
      console.error('Error creating donation checkout:', error);
      toast.error('Failed to start checkout. Please try again.');
      setDonationLoading(false);
    }
  };

  const getAmountToDonate = () => {
    return selectedAmount || (customAmount ? parseFloat(customAmount) : 0);
  };

  if (checkingStatus) {
    return (
      <div className="container max-w-5xl mx-auto py-12">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container max-w-5xl mx-auto py-12">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">
          Contribute to VersionVault
        </h1>
        <p className="text-xl text-muted-foreground">
          Help keep VersionVault running and ad-free for everyone
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="premium" className="text-base">
            <Sparkles className="h-4 w-4 mr-2" />
            Premium Subscription
          </TabsTrigger>
          <TabsTrigger value="donate" className="text-base">
            <Heart className="h-4 w-4 mr-2" />
            One-Time Donation
          </TabsTrigger>
        </TabsList>

        {/* Premium Tab */}
        <TabsContent value="premium" className="space-y-6">
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
                  disabled={premiumLoading}
                  size="lg"
                  className="w-full text-lg py-6"
                >
                  {premiumLoading ? 'Loading...' : 'Upgrade to Premium'}
                </Button>
              ) : subscription ? (
                <Button
                  onClick={handleManageSubscription}
                  disabled={premiumLoading}
                  variant="outline"
                  size="lg"
                  className="w-full"
                >
                  {premiumLoading ? 'Loading...' : 'Manage Subscription'}
                </Button>
              ) : null}

              <p className="text-xs text-center text-muted-foreground">
                Secure payment processing by Stripe. Cancel anytime.
              </p>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Donate Tab */}
        <TabsContent value="donate" className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Make a Donation</CardTitle>
                  <CardDescription>
                    Choose an amount or enter your own
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                  <div>
                    <Label className="mb-3 block">Select Amount</Label>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                      {SUGGESTED_AMOUNTS.map((amount) => (
                        <Button
                          key={amount}
                          variant={selectedAmount === amount ? 'default' : 'outline'}
                          className="h-16"
                          onClick={() => {
                            setSelectedAmount(amount);
                            setCustomAmount('');
                          }}
                        >
                          ${amount}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="custom-amount">Custom Amount ($)</Label>
                    <Input
                      id="custom-amount"
                      type="number"
                      min="1"
                      step="1"
                      placeholder="Enter amount"
                      value={customAmount}
                      onChange={(e) => {
                        setCustomAmount(e.target.value);
                        setSelectedAmount(null);
                      }}
                    />
                  </div>

                  <div className="border-t pt-6">
                    <h3 className="font-medium mb-4">Optional Information</h3>

                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="donor-name">Your Name (optional)</Label>
                        <Input
                          id="donor-name"
                          placeholder="How should we thank you?"
                          value={donorName}
                          onChange={(e) => setDonorName(e.target.value)}
                        />
                      </div>

                      <div>
                        <Label htmlFor="donor-message">Message (optional)</Label>
                        <Textarea
                          id="donor-message"
                          placeholder="Leave a note for the team"
                          value={donorMessage}
                          onChange={(e) => setDonorMessage(e.target.value)}
                          rows={3}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Public Recognition</Label>
                          <p className="text-sm text-muted-foreground">
                            Display your name on our supporters page
                          </p>
                        </div>
                        <Switch
                          checked={isPublic}
                          onCheckedChange={setIsPublic}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="flex flex-col gap-4">
                  <Button
                    onClick={handleDonate}
                    disabled={donationLoading || getAmountToDonate() < 1}
                    size="lg"
                    className="w-full text-lg py-6"
                  >
                    {donationLoading
                      ? 'Loading...'
                      : getAmountToDonate() > 0
                      ? `Donate $${getAmountToDonate()}`
                      : 'Select an Amount'}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    Secure payment processing by Stripe. One-time payment.
                  </p>
                </CardFooter>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Why Donate?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    Your donations help cover server costs, database hosting, email delivery, and development time.
                  </p>
                </CardContent>
              </Card>

              {!isPremium && (
                <Card className="border-primary/50">
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">Want More?</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Get an ad-free experience with Premium for $25/year.
                    </p>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleTabChange('premium')}
                    >
                      View Premium
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Coffee className="h-5 w-5" />
                    <CardTitle className="text-lg">Impact</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    A $5 donation is like buying us a coffee. ☕
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    A $25 donation covers a month of server costs!
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
