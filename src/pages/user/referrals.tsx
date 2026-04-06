import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { getReferralCode, getReferralStats, getGrantedUntil } from '@/lib/api/stripe';
import { Copy, Users, Gift, Trophy, Share2, Mail } from 'lucide-react';

export function UserReferrals() {
  const { user, isPremium } = useAuth();
  const [referralCode, setReferralCode] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalReferrals: 0,
    verifiedReferrals: 0,
    paidReferrals: 0,
    referrals: [] as any[],
    grants: [] as any[],
  });
  const [grantedUntil, setGrantedUntil] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [code, referralStats, granted] = await Promise.all([
        getReferralCode(user.id),
        getReferralStats(user.id),
        getGrantedUntil(user.id),
      ]);
      setReferralCode(code);
      setStats(referralStats);
      setGrantedUntil(granted);
    } catch (error) {
      console.error('Error loading referral data:', error);
      toast.error('Failed to load referral data');
    } finally {
      setLoading(false);
    }
  };

  const referralLink = referralCode
    ? `${window.location.origin}/signup?ref=${referralCode}`
    : '';

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      toast.success('Referral link copied to clipboard!');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent('Try VersionVault — we both get 1 month of Pro free!');
    const body = encodeURIComponent(
      `Hey! I've been using VersionVault to track software updates and it's been great.\n\nSign up with my link and we both get 1 month of Pro for free:\n${referralLink}\n\nIt tracks 400+ apps and notifies you when new versions drop.`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const shareViaTwitter = () => {
    const text = encodeURIComponent(
      `Never miss a software update again! Sign up for @VersionVault with my link and we both get 1 month of Pro free: ${referralLink}`
    );
    window.open(`https://x.com/intent/tweet?text=${text}`, '_blank');
  };

  const totalEarnedMonths = stats.grants.reduce((sum, g) => sum + g.months_granted, 0);

  // Milestone progress
  const milestones = [
    { threshold: 5, bonus: 2, label: '5 referrals' },
    { threshold: 10, bonus: 3, label: '10 referrals' },
    { threshold: 25, bonus: 6, label: '25 referrals' },
  ];

  if (!user) return null;

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Invite Friends</h3>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Invite Friends</h3>
        <p className="text-sm text-muted-foreground">
          Share your referral link — you both get 1 month of Pro when they sign up.
        </p>
      </div>

      {/* Referral Link */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Your Referral Link
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input value={referralLink} readOnly className="font-mono text-sm" />
            <Button onClick={copyToClipboard} variant="outline" size="icon">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={shareViaEmail}>
              <Mail className="h-4 w-4 mr-1" />
              Email
            </Button>
            <Button variant="outline" size="sm" onClick={shareViaTwitter}>
              Share on X
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.verifiedReferrals}</p>
                <p className="text-sm text-muted-foreground">Friends signed up</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Gift className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{totalEarnedMonths}</p>
                <p className="text-sm text-muted-foreground">Months earned</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.paidReferrals}</p>
                <p className="text-sm text-muted-foreground">Friends subscribed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Premium grant status */}
      {grantedUntil && new Date(grantedUntil) > new Date() && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <p className="font-medium">
              {isPremium ? 'Pro via referrals' : 'Referral premium active'}
            </p>
            <p className="text-sm text-muted-foreground">
              Expires {new Date(grantedUntil).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Milestones */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Milestones</CardTitle>
          <CardDescription>Earn bonus months as you refer more friends</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {milestones.map((milestone) => {
            const reached = stats.verifiedReferrals >= milestone.threshold;
            return (
              <div
                key={milestone.threshold}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  reached ? 'border-primary/30 bg-primary/5' : 'border-border'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Trophy className={`h-5 w-5 ${reached ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="font-medium text-sm">{milestone.label}</p>
                    <p className="text-xs text-muted-foreground">+{milestone.bonus} bonus months</p>
                  </div>
                </div>
                <div className="text-right">
                  {reached ? (
                    <Badge>Earned</Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {stats.verifiedReferrals}/{milestone.threshold}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Rewards explanation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Friend signs up + verifies email</span>
            <span className="font-medium">You both get 1 month Pro</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Friend becomes paying subscriber</span>
            <span className="font-medium">You get 3 months Pro</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">5 referrals milestone</span>
            <span className="font-medium">+2 bonus months</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">10 referrals milestone</span>
            <span className="font-medium">+3 bonus months</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">25 referrals milestone</span>
            <span className="font-medium">+6 bonus months</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
