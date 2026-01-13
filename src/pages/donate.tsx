import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { createDonationCheckoutSession } from '@/lib/api/stripe';
import { Heart, Coffee, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SUGGESTED_AMOUNTS = [5, 10, 25, 50, 100];

export function Donate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [donorName, setDonorName] = useState('');
  const [donorMessage, setDonorMessage] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  const handleDonate = async () => {
    if (!user) {
      toast.error('Please sign in to make a donation');
      navigate('/login');
      return;
    }

    const amount = selectedAmount || parseFloat(customAmount);

    if (!amount || amount < 1) {
      toast.error('Please enter a valid amount');
      return;
    }

    setLoading(true);
    try {
      const checkoutUrl = await createDonationCheckoutSession(
        user.id,
        Math.round(amount * 100), // Convert to cents
        donorName || undefined,
        donorMessage || undefined,
        isPublic
      );

      // Redirect to Stripe Checkout
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error('Error creating donation checkout:', error);
      toast.error('Failed to start checkout. Please try again.');
      setLoading(false);
    }
  };

  const getAmountToDonate = () => {
    return selectedAmount || (customAmount ? parseFloat(customAmount) : 0);
  };

  return (
    <div className="container max-w-4xl mx-auto py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 rounded-full bg-pink-500/10 flex items-center justify-center">
            <Heart className="h-8 w-8 text-pink-500" />
          </div>
        </div>
        <h1 className="text-4xl font-bold mb-4">
          Support VersionVault
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Your support helps keep VersionVault free and enables us to build new features
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 mb-12">
        {/* Donation Form */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Make a Donation</CardTitle>
              <CardDescription>
                Choose an amount or enter your own
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Suggested Amounts */}
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

              {/* Custom Amount */}
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

                {/* Donor Name */}
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

                  {/* Donor Message */}
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

                  {/* Public Recognition */}
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
                disabled={loading || getAmountToDonate() < 1}
                size="lg"
                className="w-full text-lg py-6"
              >
                {loading
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

        {/* Side Info */}
        <div className="space-y-6">
          {/* Why Donate Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Why Donate?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                VersionVault is built and maintained by a small team passionate about helping developers stay up-to-date.
              </p>
              <p>
                Your donations help cover:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Server costs</li>
                <li>Database hosting</li>
                <li>Email delivery</li>
                <li>Development time</li>
                <li>New features</li>
              </ul>
            </CardContent>
          </Card>

          {/* Premium Alternative */}
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
                onClick={() => navigate('/premium')}
              >
                View Premium
              </Button>
            </CardContent>
          </Card>

          {/* Coffee Comparison */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Coffee className="h-5 w-5" />
                <CardTitle className="text-lg">Coffee Equivalent</CardTitle>
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

      {/* Benefits of Donating */}
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-6">Every Donation Helps</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <Heart className="h-6 w-6 text-green-500" />
              </div>
              <h3 className="font-medium mb-2">Show Your Support</h3>
              <p className="text-sm text-muted-foreground">
                Let us know you value the work we're doing
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-6 w-6 text-blue-500" />
              </div>
              <h3 className="font-medium mb-2">Fund New Features</h3>
              <p className="text-sm text-muted-foreground">
                Help us build the features you want to see
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
                <Coffee className="h-6 w-6 text-purple-500" />
              </div>
              <h3 className="font-medium mb-2">Keep It Free</h3>
              <p className="text-sm text-muted-foreground">
                Help us keep VersionVault free for everyone
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
