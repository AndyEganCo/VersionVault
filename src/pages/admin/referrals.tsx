import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { LoadingPage } from '@/components/loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { invokeEdgeFunction } from '@/lib/supabase';
import { formatDate } from '@/lib/date';
import { toast } from 'sonner';
import { Users, UserPlus, CheckCircle2, Crown, Gift } from 'lucide-react';

interface ReferralRow {
  referrer_id: string;
  referrer_email: string;
  code: string | null;
  total: number;
  verified: number;
  paid: number;
  last_referral_at: string | null;
}

export function AdminReferrals() {
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeReferrers: 0,
    totalReferrals: 0,
    verifiedReferrals: 0,
    paidReferrals: 0,
  });

  // Manual grant form state
  const [grantEmail, setGrantEmail] = useState('');
  const [grantMonths, setGrantMonths] = useState('1');
  const [grantSubmitting, setGrantSubmitting] = useState(false);

  // Manual referral form state
  const [referrerEmail, setReferrerEmail] = useState('');
  const [referredEmail, setReferredEmail] = useState('');
  const [referralGrantRewards, setReferralGrantRewards] = useState(true);
  const [referralSubmitting, setReferralSubmitting] = useState(false);

  useEffect(() => {
    fetchReferrals();
  }, []);

  const handleGrantPremium = async (e: React.FormEvent) => {
    e.preventDefault();
    const months = parseInt(grantMonths, 10);
    if (!grantEmail.trim() || !Number.isInteger(months) || months < 1) {
      toast.error('Enter a valid email and a positive number of months');
      return;
    }
    setGrantSubmitting(true);
    try {
      await invokeEdgeFunction('admin-grant-premium', {
        email: grantEmail.trim(),
        months,
      });
      toast.success(`Granted ${months} month${months === 1 ? '' : 's'} of Pro to ${grantEmail}`);
      setGrantEmail('');
      setGrantMonths('1');
    } catch (err: any) {
      toast.error(err.message || 'Failed to grant premium');
    } finally {
      setGrantSubmitting(false);
    }
  };

  const handleRecordReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referrerEmail.trim() || !referredEmail.trim()) {
      toast.error('Enter both referrer and referred emails');
      return;
    }
    setReferralSubmitting(true);
    try {
      await invokeEdgeFunction('admin-record-referral', {
        referrerEmail: referrerEmail.trim(),
        referredEmail: referredEmail.trim(),
        grantRewards: referralGrantRewards,
      });
      toast.success(
        referralGrantRewards
          ? `Recorded referral and granted 1 month to each side`
          : `Recorded referral (no rewards granted)`
      );
      setReferrerEmail('');
      setReferredEmail('');
      await fetchReferrals();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record referral');
    } finally {
      setReferralSubmitting(false);
    }
  };

  const fetchReferrals = async () => {
    try {
      setLoading(true);

      const result = await invokeEdgeFunction<{
        rows: ReferralRow[];
        stats: {
          activeReferrers: number;
          totalReferrals: number;
          verifiedReferrals: number;
          paidReferrals: number;
        };
      }>('admin-list-referrals');

      setRows(result.rows || []);
      setStats(
        result.stats || {
          activeReferrers: 0,
          totalReferrals: 0,
          verifiedReferrals: 0,
          paidReferrals: 0,
        }
      );
    } catch (error) {
      console.error('Error fetching referrals:', error);
      toast.error((error as Error).message || 'Failed to load referrals');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingPage />;
  }

  return (
    <PageLayout>
      <PageHeader
        title="Referrals"
        description="Users who are sharing VersionVault and how many referrals they've brought in"
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Referrers</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeReferrers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalReferrals}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verified</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.verifiedReferrals}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid</CardTitle>
            <Crown className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{stats.paidReferrals}</div>
          </CardContent>
        </Card>
      </div>

      {/* Manual adjustments */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5" />
              Grant Pro Months
            </CardTitle>
            <CardDescription>
              Manually credit a user with Pro time. Use to backfill missed referrals or compensate for bugs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={handleGrantPremium}>
              <div className="space-y-1.5">
                <Label htmlFor="grant-email">User email</Label>
                <Input
                  id="grant-email"
                  type="email"
                  placeholder="user@example.com"
                  value={grantEmail}
                  onChange={(e) => setGrantEmail(e.target.value)}
                  disabled={grantSubmitting}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="grant-months">Months</Label>
                <Input
                  id="grant-months"
                  type="number"
                  min={1}
                  max={120}
                  value={grantMonths}
                  onChange={(e) => setGrantMonths(e.target.value)}
                  disabled={grantSubmitting}
                  required
                />
              </div>
              <Button type="submit" disabled={grantSubmitting} className="w-full">
                {grantSubmitting ? 'Granting…' : 'Grant Pro'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Record Referral
            </CardTitle>
            <CardDescription>
              Link a referrer to a user who signed up without the referral being captured. Optionally grant 1 month to each.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={handleRecordReferral}>
              <div className="space-y-1.5">
                <Label htmlFor="referrer-email">Referrer email</Label>
                <Input
                  id="referrer-email"
                  type="email"
                  placeholder="referrer@example.com"
                  value={referrerEmail}
                  onChange={(e) => setReferrerEmail(e.target.value)}
                  disabled={referralSubmitting}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="referred-email">Referred user email</Label>
                <Input
                  id="referred-email"
                  type="email"
                  placeholder="friend@example.com"
                  value={referredEmail}
                  onChange={(e) => setReferredEmail(e.target.value)}
                  disabled={referralSubmitting}
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="grant-rewards"
                  checked={referralGrantRewards}
                  onCheckedChange={(checked) => setReferralGrantRewards(checked === true)}
                  disabled={referralSubmitting}
                />
                <Label htmlFor="grant-rewards" className="text-sm font-normal cursor-pointer">
                  Grant 1 month of Pro to each side
                </Label>
              </div>
              <Button type="submit" disabled={referralSubmitting} className="w-full">
                {referralSubmitting ? 'Recording…' : 'Record Referral'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle>Top Referrers</CardTitle>
          <CardDescription>
            Sorted by total referrals
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No referrals yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Verified</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead>Last Referral</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={row.referrer_id}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-medium">
                      {row.referrer_email || (
                        <span className="text-muted-foreground">Unknown</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.code ? (
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {row.code}
                        </code>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {row.total}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.verified > 0 ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                          {row.verified}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.paid > 0 ? (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                          {row.paid}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.last_referral_at ? formatDate(row.last_referral_at) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
}
