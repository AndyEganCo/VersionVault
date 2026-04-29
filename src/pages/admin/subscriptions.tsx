import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { LoadingPage } from '@/components/loading';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/date';
import { CreditCard, TrendingUp } from 'lucide-react';

interface ActiveDiscount {
  stripe_coupon_id: string;
  promotion_code: string | null;
  coupon_name: string | null;
  percent_off: number | null;
  amount_off: number | null;
  currency: string | null;
  duration: string | null;
  duration_in_months: number | null;
  end_at: string | null;
}

interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  status: string;
  plan_type: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
  user_email?: string;
  active_discount?: ActiveDiscount | null;
}

function formatDiscount(d: ActiveDiscount): string {
  const amount = d.percent_off
    ? `${d.percent_off}% off`
    : d.amount_off
      ? `${(d.amount_off / 100).toFixed(2)} ${(d.currency ?? 'usd').toUpperCase()} off`
      : 'discount';
  const duration =
    d.duration === 'forever'
      ? 'forever'
      : d.duration === 'once'
        ? 'once'
        : d.duration === 'repeating' && d.duration_in_months
          ? `${d.duration_in_months} mo`
          : '';
  return duration ? `${amount} (${duration})` : amount;
}

export function AdminSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    canceled: 0,
    mrr: 0,
  });

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);

      // Fetch subscriptions
      const { data: subscriptionsData, error: subsError } = await supabase
        .from('subscriptions')
        .select('*')
        .order('created_at', { ascending: false });

      if (subsError) throw subsError;

      // Fetch user emails separately
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, email');

      if (usersError) throw usersError;

      // Fetch active discounts for all subscriptions in one query
      const subIds = (subscriptionsData || []).map((s: any) => s.id);
      const { data: discountsData, error: discountsError } = subIds.length
        ? await supabase
            .from('subscription_discounts')
            .select('subscription_id, stripe_coupon_id, promotion_code, coupon_name, percent_off, amount_off, currency, duration, duration_in_months, end_at, created_at')
            .in('subscription_id', subIds)
            .is('removed_at', null)
            .order('created_at', { ascending: false })
        : { data: [], error: null };

      if (discountsError) throw discountsError;

      // Map subscription_id -> first active discount
      const discountMap: Record<string, ActiveDiscount> = {};
      for (const d of discountsData || []) {
        if (!discountMap[d.subscription_id]) {
          discountMap[d.subscription_id] = d as ActiveDiscount;
        }
      }

      // Create a map of user_id to email
      const userEmailMap = (usersData || []).reduce((acc: any, user: any) => {
        acc[user.id] = user.email;
        return acc;
      }, {});

      // Transform data to include user email and active discount
      const subscriptionsWithEmail = (subscriptionsData || []).map((sub: any) => ({
        ...sub,
        user_email: userEmailMap[sub.user_id] || 'Unknown',
        active_discount: discountMap[sub.id] ?? null,
      }));

      setSubscriptions(subscriptionsWithEmail);

      // Calculate stats
      const active = subscriptionsWithEmail.filter((s: Subscription) => s.status === 'active').length;
      const canceled = subscriptionsWithEmail.filter((s: Subscription) => s.cancel_at_period_end).length;
      const mrr = active * 25 / 12; // $25/year = ~$2.08/month

      setStats({
        total: subscriptionsWithEmail.length,
        active,
        canceled,
        mrr: Math.round(mrr * 100) / 100,
      });

    } catch (error) {
      console.error('Error fetching subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingPage />;
  }

  const getStatusBadge = (status: string, cancelAtPeriodEnd: boolean) => {
    if (cancelAtPeriodEnd) {
      return <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20">Canceling</Badge>;
    }

    switch (status) {
      case 'active':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Active</Badge>;
      case 'canceled':
        return <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/20">Canceled</Badge>;
      case 'past_due':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">Past Due</Badge>;
      case 'unpaid':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">Unpaid</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <PageLayout>
      <PageHeader
        title="Subscription Management"
        description="View and manage premium subscriptions"
      />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Subscriptions</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.active}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Canceling</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{stats.canceled}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR (Est.)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.mrr}</div>
            <p className="text-xs text-muted-foreground">Monthly Recurring Revenue</p>
          </CardContent>
        </Card>
      </div>

      {/* Subscriptions Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Subscriptions</CardTitle>
          <CardDescription>
            {subscriptions.length} subscription{subscriptions.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {subscriptions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No subscriptions yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Period Start</TableHead>
                  <TableHead>Period End</TableHead>
                  <TableHead>Stripe ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">
                      {sub.user_email}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(sub.status, sub.cancel_at_period_end)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {sub.plan_type === 'premium_yearly' ? '$25/year' : sub.plan_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {sub.active_discount ? (
                        <div className="flex flex-col gap-1">
                          <Badge
                            variant="outline"
                            className="w-fit bg-purple-500/10 text-purple-500 border-purple-500/20"
                          >
                            {formatDiscount(sub.active_discount)}
                          </Badge>
                          {(sub.active_discount.promotion_code || sub.active_discount.coupon_name) && (
                            <span className="text-xs text-muted-foreground font-mono">
                              {sub.active_discount.promotion_code ?? sub.active_discount.coupon_name}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(sub.current_period_start)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(sub.current_period_end)}
                    </TableCell>
                    <TableCell className="text-sm font-mono text-muted-foreground">
                      {sub.stripe_subscription_id.substring(0, 20)}...
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
