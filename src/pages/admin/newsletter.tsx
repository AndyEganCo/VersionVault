import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Navigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { LoadingPage } from '@/components/loading';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Mail,
  Send,
  Pause,
  Play,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  MousePointer,
  AlertTriangle,
} from 'lucide-react';

interface QueueSummary {
  pending: number;
  processing: number;
  sent: number;
  failed: number;
}

interface NewsletterStats {
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  totalBounced: number;
  openRate: number;
  clickRate: number;
}

interface RecentLog {
  id: string;
  email: string;
  email_type: string;
  status: string;
  created_at: string;
  opened_at: string | null;
  clicked_at: string | null;
}

interface Sponsor {
  id: string;
  name: string;
  tagline: string | null;
  cta_url: string;
  is_active: boolean;
  impression_count: number;
  click_count: number;
}

export function AdminNewsletter() {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [queueSummary, setQueueSummary] = useState<QueueSummary>({
    pending: 0,
    processing: 0,
    sent: 0,
    failed: 0,
  });
  const [stats, setStats] = useState<NewsletterStats>({
    totalSent: 0,
    totalOpened: 0,
    totalClicked: 0,
    totalBounced: 0,
    openRate: 0,
    clickRate: 0,
  });
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([]);
  const [activeSponsor, setActiveSponsor] = useState<Sponsor | null>(null);
  const [autoSendEnabled, setAutoSendEnabled] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (user && isAdmin) {
      loadData();
    }
  }, [user, isAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load queue summary
      const { data: queueData } = await supabase
        .from('newsletter_queue')
        .select('status');

      if (queueData) {
        const summary = {
          pending: queueData.filter((q) => q.status === 'pending').length,
          processing: queueData.filter((q) => q.status === 'processing').length,
          sent: queueData.filter((q) => q.status === 'sent').length,
          failed: queueData.filter((q) => q.status === 'failed').length,
        };
        setQueueSummary(summary);
      }

      // Load newsletter stats (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: logsData } = await supabase
        .from('newsletter_logs')
        .select('status, opened_at, clicked_at')
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (logsData) {
        const totalSent = logsData.length;
        const totalOpened = logsData.filter((l) => l.opened_at).length;
        const totalClicked = logsData.filter((l) => l.clicked_at).length;
        const totalBounced = logsData.filter((l) => l.status === 'bounced').length;

        setStats({
          totalSent,
          totalOpened,
          totalClicked,
          totalBounced,
          openRate: totalSent > 0 ? (totalOpened / totalSent) * 100 : 0,
          clickRate: totalSent > 0 ? (totalClicked / totalSent) * 100 : 0,
        });
      }

      // Load recent logs
      const { data: recentData } = await supabase
        .from('newsletter_logs')
        .select('id, email, email_type, status, created_at, opened_at, clicked_at')
        .order('created_at', { ascending: false })
        .limit(10);

      if (recentData) {
        setRecentLogs(recentData);
      }

      // Load active sponsor
      const { data: sponsorData } = await supabase
        .from('newsletter_sponsors')
        .select('*')
        .eq('is_active', true)
        .single();

      setActiveSponsor(sponsorData || null);

      // Load auto-send setting
      const { data: settingData } = await supabase
        .from('newsletter_settings')
        .select('setting_value')
        .eq('setting_key', 'auto_send_enabled')
        .single();

      if (settingData) {
        setAutoSendEnabled(settingData.setting_value === 'true');
      }
    } catch (error) {
      console.error('Error loading newsletter data:', error);
      toast.error('Failed to load newsletter data');
    } finally {
      setLoading(false);
    }
  };

  const handleQueueDigest = async (frequency: 'daily' | 'weekly' | 'monthly') => {
    setActionLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/queue-weekly-digest`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ frequency }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to queue digest');
      }

      const result = await response.json();
      toast.success(`Queued ${result.queued} ${frequency} digest emails`);
      loadData();
    } catch (error) {
      console.error('Error queuing digest:', error);
      toast.error('Failed to queue digest');
    } finally {
      setActionLoading(false);
    }
  };

  const handleProcessQueue = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-newsletter-queue`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to process queue');
      }

      const result = await response.json();
      toast.success(`Processed ${result.processed} emails (${result.sent} sent, ${result.failed} failed)`);
      loadData();
    } catch (error) {
      console.error('Error processing queue:', error);
      toast.error('Failed to process queue');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelQueue = async () => {
    if (!confirm('Are you sure you want to cancel all pending emails?')) {
      return;
    }

    setActionLoading(true);
    try {
      const { data, error } = await supabase
        .from('newsletter_queue')
        .update({ status: 'cancelled' })
        .eq('status', 'pending')
        .select('id');

      if (error) throw error;

      toast.success(`Cancelled ${data?.length || 0} pending emails`);
      loadData();
    } catch (error) {
      console.error('Error cancelling queue:', error);
      toast.error('Failed to cancel queue');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleAutoSend = async (enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('newsletter_settings')
        .upsert({
          setting_key: 'auto_send_enabled',
          setting_value: enabled.toString(),
        });

      if (error) throw error;

      setAutoSendEnabled(enabled);
      toast.success(`Auto-send ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error updating auto-send setting:', error);
      toast.error('Failed to update setting');
    }
  };

  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return <LoadingPage />;
  }

  return (
    <PageLayout>
      <PageHeader
        title="Newsletter Management"
        description="Manage email digests, queue, and analytics"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sent (30d)</p>
                <p className="text-2xl font-bold">{stats.totalSent}</p>
              </div>
              <Mail className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open Rate</p>
                <p className="text-2xl font-bold">{stats.openRate.toFixed(1)}%</p>
              </div>
              <Eye className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Click Rate</p>
                <p className="text-2xl font-bold">{stats.clickRate.toFixed(1)}%</p>
              </div>
              <MousePointer className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bounced</p>
                <p className="text-2xl font-bold">{stats.totalBounced}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Queue Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Queue Status
            </CardTitle>
            <CardDescription>Current email queue state</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-3xl font-bold text-yellow-500">{queueSummary.pending}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-3xl font-bold text-blue-500">{queueSummary.processing}</p>
                <p className="text-sm text-muted-foreground">Processing</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-3xl font-bold text-green-500">{queueSummary.sent}</p>
                <p className="text-sm text-muted-foreground">Sent</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-3xl font-bold text-red-500">{queueSummary.failed}</p>
                <p className="text-sm text-muted-foreground">Failed</p>
              </div>
            </div>

            <div className="flex items-center justify-between mb-4 p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Label>Auto-send</Label>
                <span className="text-xs text-muted-foreground">(Emails send automatically at 8am user time)</span>
              </div>
              <Switch
                checked={autoSendEnabled}
                onCheckedChange={handleToggleAutoSend}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => handleQueueDigest('weekly')}
                disabled={actionLoading}
              >
                <Send className="h-4 w-4 mr-1" />
                Queue Weekly
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleProcessQueue}
                disabled={actionLoading || queueSummary.pending === 0}
              >
                <Play className="h-4 w-4 mr-1" />
                Process Now
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleCancelQueue}
                disabled={actionLoading || queueSummary.pending === 0}
              >
                <Pause className="h-4 w-4 mr-1" />
                Cancel Pending
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={loadData}
                disabled={actionLoading}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Active Sponsor */}
        <Card>
          <CardHeader>
            <CardTitle>Active Sponsor</CardTitle>
            <CardDescription>Current sponsor shown in emails</CardDescription>
          </CardHeader>
          <CardContent>
            {activeSponsor ? (
              <div className="space-y-4">
                <div>
                  <p className="font-semibold">{activeSponsor.name}</p>
                  {activeSponsor.tagline && (
                    <p className="text-sm text-muted-foreground">{activeSponsor.tagline}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-xl font-bold">{activeSponsor.impression_count}</p>
                    <p className="text-xs text-muted-foreground">Impressions</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-xl font-bold">{activeSponsor.click_count}</p>
                    <p className="text-xs text-muted-foreground">Clicks</p>
                  </div>
                </div>
                <a
                  href={activeSponsor.cta_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-500 hover:underline"
                >
                  {activeSponsor.cta_url}
                </a>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No active sponsor</p>
                <p className="text-sm mt-2">Add a sponsor in the database to show ads in emails</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Sends */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Sends</CardTitle>
          <CardDescription>Last 10 emails sent</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Opened</TableHead>
                <TableHead>Clicked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No emails sent yet
                  </TableCell>
                </TableRow>
              ) : (
                recentLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-sm">{log.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.email_type.replace('_', ' ')}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          log.status === 'sent' || log.status === 'delivered'
                            ? 'default'
                            : log.status === 'bounced'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {log.opened_at ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>
                      {log.clicked_at ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageLayout>
  );
}
