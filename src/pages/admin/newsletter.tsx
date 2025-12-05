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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Plus,
  Pencil,
  Trash2,
  TestTube,
  FileText,
  Check,
  Package,
  ExternalLink,
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
  description: string | null;
  image_url: string | null;
  cta_url: string;
  cta_text: string;
  is_active: boolean;
  impression_count: number;
  click_count: number;
  start_date: string | null;
  end_date: string | null;
}

interface UnverifiedVersion {
  id: string;
  software_id: string;
  version: string;
  detected_at: string;
  type: 'major' | 'minor' | 'patch';
  notes: string[];
  release_date: string | null;
  software_name: string;
  software_manufacturer: string;
}

type SponsorFormData = Omit<Sponsor, 'id' | 'impression_count' | 'click_count'>;

const defaultSponsorForm: SponsorFormData = {
  name: '',
  tagline: '',
  description: '',
  image_url: '',
  cta_url: '',
  cta_text: 'Learn More',
  is_active: false,
  start_date: null,
  end_date: null,
};

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
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [autoSendEnabled, setAutoSendEnabled] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Sponsor modal state
  const [sponsorModalOpen, setSponsorModalOpen] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null);
  const [sponsorForm, setSponsorForm] = useState<SponsorFormData>(defaultSponsorForm);
  const [sponsorSaving, setSponsorSaving] = useState(false);

  // Preview modal state
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  // Test email state
  const [testEmailLoading, setTestEmailLoading] = useState(false);

  // Unverified versions state
  const [unverifiedVersions, setUnverifiedVersions] = useState<UnverifiedVersion[]>([]);
  const [verifyingVersions, setVerifyingVersions] = useState<Set<string>>(new Set());

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

      // Load all sponsors
      const { data: sponsorsData } = await supabase
        .from('newsletter_sponsors')
        .select('*')
        .order('created_at', { ascending: false });

      if (sponsorsData) {
        setSponsors(sponsorsData);
      }

      // Load auto-send setting
      const { data: settingData } = await supabase
        .from('newsletter_settings')
        .select('setting_value')
        .eq('setting_key', 'auto_send_enabled')
        .single();

      if (settingData) {
        setAutoSendEnabled(settingData.setting_value === 'true');
      }

      // Load unverified versions
      const { data: versionsData } = await supabase
        .from('software_version_history')
        .select('id, software_id, version, detected_at, type, notes, release_date')
        .eq('newsletter_verified', false)
        .order('detected_at', { ascending: false })
        .limit(20);

      if (versionsData && versionsData.length > 0) {
        const softwareIds = [...new Set(versionsData.map(v => v.software_id))];
        const { data: softwareData } = await supabase
          .from('software')
          .select('id, name, manufacturer')
          .in('id', softwareIds);

        const softwareMap = new Map(
          (softwareData || []).map(s => [s.id, { name: s.name, manufacturer: s.manufacturer }])
        );

        setUnverifiedVersions(
          versionsData.map(v => ({
            ...v,
            notes: v.notes || [],
            software_name: softwareMap.get(v.software_id)?.name || 'Unknown',
            software_manufacturer: softwareMap.get(v.software_id)?.manufacturer || 'Unknown',
          }))
        );
      } else {
        setUnverifiedVersions([]);
      }
    } catch (error) {
      console.error('Error loading newsletter data:', error);
      toast.error('Failed to load newsletter data');
    } finally {
      setLoading(false);
    }
  };

  // Verify a version for newsletter
  const handleVerifyVersion = async (versionId: string) => {
    setVerifyingVersions(prev => new Set(prev).add(versionId));
    try {
      const { error } = await supabase
        .from('software_version_history')
        .update({
          newsletter_verified: true,
          verified_at: new Date().toISOString(),
          verified_by: user?.id,
        })
        .eq('id', versionId);

      if (error) throw error;

      toast.success('Version verified');
      setUnverifiedVersions(prev => prev.filter(v => v.id !== versionId));
    } catch (error) {
      console.error('Error verifying version:', error);
      toast.error('Failed to verify version');
    } finally {
      setVerifyingVersions(prev => {
        const next = new Set(prev);
        next.delete(versionId);
        return next;
      });
    }
  };

  // Verify all versions
  const handleVerifyAll = async () => {
    if (unverifiedVersions.length === 0) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('software_version_history')
        .update({
          newsletter_verified: true,
          verified_at: new Date().toISOString(),
          verified_by: user?.id,
        })
        .eq('newsletter_verified', false);

      if (error) throw error;

      toast.success(`Verified ${unverifiedVersions.length} versions`);
      setUnverifiedVersions([]);
    } catch (error) {
      console.error('Error verifying versions:', error);
      toast.error('Failed to verify versions');
    } finally {
      setActionLoading(false);
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
          body: JSON.stringify({ force: true }),
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

  // Sponsor management functions
  const openSponsorModal = (sponsor?: Sponsor) => {
    if (sponsor) {
      setEditingSponsor(sponsor);
      setSponsorForm({
        name: sponsor.name,
        tagline: sponsor.tagline || '',
        description: sponsor.description || '',
        image_url: sponsor.image_url || '',
        cta_url: sponsor.cta_url,
        cta_text: sponsor.cta_text,
        is_active: sponsor.is_active,
        start_date: sponsor.start_date,
        end_date: sponsor.end_date,
      });
    } else {
      setEditingSponsor(null);
      setSponsorForm(defaultSponsorForm);
    }
    setSponsorModalOpen(true);
  };

  const handleSaveSponsor = async () => {
    if (!sponsorForm.name || !sponsorForm.cta_url) {
      toast.error('Name and CTA URL are required');
      return;
    }

    setSponsorSaving(true);
    try {
      // If setting this sponsor as active, deactivate others first
      if (sponsorForm.is_active && editingSponsor?.id) {
        await supabase
          .from('newsletter_sponsors')
          .update({ is_active: false })
          .neq('id', editingSponsor.id);
      } else if (sponsorForm.is_active) {
        // New sponsor being set as active - deactivate all
        await supabase
          .from('newsletter_sponsors')
          .update({ is_active: false });
      }

      if (editingSponsor) {
        // Update existing
        const { error } = await supabase
          .from('newsletter_sponsors')
          .update({
            name: sponsorForm.name,
            tagline: sponsorForm.tagline || null,
            description: sponsorForm.description || null,
            image_url: sponsorForm.image_url || null,
            cta_url: sponsorForm.cta_url,
            cta_text: sponsorForm.cta_text || 'Learn More',
            is_active: sponsorForm.is_active,
            start_date: sponsorForm.start_date || null,
            end_date: sponsorForm.end_date || null,
          })
          .eq('id', editingSponsor.id);

        if (error) throw error;
        toast.success('Sponsor updated');
      } else {
        // Create new
        const { error } = await supabase
          .from('newsletter_sponsors')
          .insert({
            name: sponsorForm.name,
            tagline: sponsorForm.tagline || null,
            description: sponsorForm.description || null,
            image_url: sponsorForm.image_url || null,
            cta_url: sponsorForm.cta_url,
            cta_text: sponsorForm.cta_text || 'Learn More',
            is_active: sponsorForm.is_active,
            start_date: sponsorForm.start_date || null,
            end_date: sponsorForm.end_date || null,
          });

        if (error) throw error;
        toast.success('Sponsor created');
      }

      setSponsorModalOpen(false);
      loadData();
    } catch (error) {
      console.error('Error saving sponsor:', error);
      toast.error('Failed to save sponsor');
    } finally {
      setSponsorSaving(false);
    }
  };

  const handleDeleteSponsor = async (sponsor: Sponsor) => {
    if (!confirm(`Are you sure you want to delete "${sponsor.name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('newsletter_sponsors')
        .delete()
        .eq('id', sponsor.id);

      if (error) throw error;
      toast.success('Sponsor deleted');
      loadData();
    } catch (error) {
      console.error('Error deleting sponsor:', error);
      toast.error('Failed to delete sponsor');
    }
  };

  const handleToggleSponsorActive = async (sponsor: Sponsor) => {
    try {
      if (!sponsor.is_active) {
        // Deactivate all others first
        await supabase
          .from('newsletter_sponsors')
          .update({ is_active: false })
          .neq('id', sponsor.id);
      }

      const { error } = await supabase
        .from('newsletter_sponsors')
        .update({ is_active: !sponsor.is_active })
        .eq('id', sponsor.id);

      if (error) throw error;
      toast.success(sponsor.is_active ? 'Sponsor deactivated' : 'Sponsor activated');
      loadData();
    } catch (error) {
      console.error('Error toggling sponsor:', error);
      toast.error('Failed to update sponsor');
    }
  };

  // Send test email to current user
  const handleSendTestEmail = async () => {
    if (!user?.email) {
      toast.error('No email address found');
      return;
    }

    setTestEmailLoading(true);
    try {
      // Get user's tracked software for a realistic test
      const { data: trackedSoftware } = await supabase
        .from('tracked_software')
        .select('software_id')
        .eq('user_id', user.id)
        .limit(5);

      // Get software details separately to avoid join issues
      let sampleUpdates: any[] = [];
      if (trackedSoftware && trackedSoftware.length > 0) {
        const softwareIds = trackedSoftware.map(t => t.software_id);
        const { data: softwareData } = await supabase
          .from('software')
          .select('id, name, manufacturer, category, current_version')
          .in('id', softwareIds)
          .limit(3);

        sampleUpdates = (softwareData || []).map((s: any) => ({
          software_id: s.id,
          name: s.name || 'Test Software',
          manufacturer: s.manufacturer || 'Test Co',
          category: s.category || 'Test',
          old_version: '1.0.0',
          new_version: s.current_version || '2.0.0',
          release_date: new Date().toISOString(),
          release_notes: ['New feature added', 'Bug fixes', 'Performance improvements'],
          update_type: 'minor',
        }));
      }

      // Default sample if no tracked software
      if (sampleUpdates.length === 0) {
        sampleUpdates = [
          {
            software_id: 'test-1',
            name: 'Sample App',
            manufacturer: 'Test Company',
            category: 'Productivity',
            old_version: '2.4.0',
            new_version: '2.5.0',
            release_date: new Date().toISOString(),
            release_notes: ['New dark mode', 'Performance improvements'],
            update_type: 'minor',
          },
        ];
      }

      // Get active sponsor
      const activeSponsor = sponsors.find(s => s.is_active);

      // Add to queue
      const { error: queueError } = await supabase
        .from('newsletter_queue')
        .insert({
          user_id: user.id,
          email: user.email,
          email_type: 'weekly_digest',
          payload: {
            updates: sampleUpdates,
            sponsor: activeSponsor ? {
              name: activeSponsor.name,
              tagline: activeSponsor.tagline,
              description: activeSponsor.description,
              image_url: activeSponsor.image_url,
              cta_url: activeSponsor.cta_url,
              cta_text: activeSponsor.cta_text,
            } : null,
          },
          status: 'pending',
          scheduled_for: new Date().toISOString(),
          timezone: 'UTC',
          idempotency_key: `test-${user.id}-${Date.now()}`,
        });

      if (queueError) throw queueError;

      toast.success(`Test email queued for ${user.email}. Click "Process Now" to send.`);
      loadData();
    } catch (error) {
      console.error('Error queuing test email:', error);
      toast.error('Failed to queue test email');
    } finally {
      setTestEmailLoading(false);
    }
  };

  // Preview email
  const handlePreviewEmail = async () => {
    setPreviewLoading(true);
    setPreviewModalOpen(true);

    try {
      // Get user's tracked software
      const { data: trackedSoftware } = await supabase
        .from('tracked_software')
        .select('software_id')
        .eq('user_id', user?.id)
        .limit(5);

      let sampleUpdates: any[] = [];
      if (trackedSoftware && trackedSoftware.length > 0) {
        const softwareIds = trackedSoftware.map(t => t.software_id);
        const { data: softwareData } = await supabase
          .from('software')
          .select('id, name, manufacturer, category, current_version')
          .in('id', softwareIds)
          .limit(3);

        sampleUpdates = (softwareData || []).map((s: any) => ({
          name: s.name || 'Test Software',
          manufacturer: s.manufacturer || 'Test Co',
          category: s.category || 'Test',
          old_version: '1.0.0',
          new_version: s.current_version || '2.0.0',
          release_date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          release_notes: ['New feature added', 'Bug fixes'],
          update_type: 'minor',
        }));
      }

      // Default sample if no tracked software
      if (sampleUpdates.length === 0) {
        sampleUpdates = [
          {
            name: 'Sample App',
            manufacturer: 'Test Company',
            category: 'Productivity',
            old_version: '2.4.0',
            new_version: '2.5.0',
            release_date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            release_notes: ['New dark mode', 'Performance improvements'],
            update_type: 'minor',
          },
        ];
      }

      const activeSponsor = sponsors.find(s => s.is_active);
      const userName = user?.email?.split('@')[0] || 'User';

      // Generate preview HTML (simplified version of the actual template)
      const html = generatePreviewHtml(userName, sampleUpdates, activeSponsor);
      setPreviewHtml(html);
    } catch (error) {
      console.error('Error generating preview:', error);
      toast.error('Failed to generate preview');
      setPreviewModalOpen(false);
    } finally {
      setPreviewLoading(false);
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

      {/* Version Verification */}
      {unverifiedVersions.length > 0 && (
        <Card className="mb-6 border-yellow-500/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-yellow-500" />
                  Verify New Versions
                  <Badge variant="secondary" className="ml-2">{unverifiedVersions.length}</Badge>
                </CardTitle>
                <CardDescription>
                  Review detected versions before they go out in newsletters
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={handleVerifyAll}
                disabled={actionLoading}
              >
                <Check className="h-4 w-4 mr-1" />
                Verify All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Software</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Detected</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unverifiedVersions.map((version) => (
                  <TableRow key={version.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{version.software_name}</p>
                        <p className="text-xs text-muted-foreground">{version.software_manufacturer}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">{version.version}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          version.type === 'major' ? 'default' :
                          version.type === 'minor' ? 'secondary' : 'outline'
                        }
                      >
                        {version.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(version.detected_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        asChild
                      >
                        <a href={`/admin/software?id=${version.software_id}`} target="_blank" rel="noopener">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-green-500 hover:text-green-600 hover:bg-green-500/10"
                        onClick={() => handleVerifyVersion(version.id)}
                        disabled={verifyingVersions.has(version.id)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
                <span className="text-xs text-muted-foreground">(8am user time)</span>
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
                Cancel
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

            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
              <Button
                size="sm"
                variant="secondary"
                onClick={handlePreviewEmail}
                disabled={previewLoading}
              >
                <FileText className="h-4 w-4 mr-1" />
                Preview Email
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleSendTestEmail}
                disabled={testEmailLoading}
              >
                <TestTube className="h-4 w-4 mr-1" />
                {testEmailLoading ? 'Sending...' : 'Send Test to Me'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Active Sponsor */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Sponsors</CardTitle>
                <CardDescription>Manage newsletter sponsors</CardDescription>
              </div>
              <Button size="sm" onClick={() => openSponsorModal()}>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {sponsors.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No sponsors yet</p>
                <p className="text-sm mt-2">Add a sponsor to show ads in emails</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sponsors.map((sponsor) => (
                  <div
                    key={sponsor.id}
                    className={`p-3 rounded-lg border ${sponsor.is_active ? 'border-green-500 bg-green-500/10' : 'bg-muted'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{sponsor.name}</p>
                          {sponsor.is_active && (
                            <Badge variant="default" className="bg-green-500">Active</Badge>
                          )}
                        </div>
                        {sponsor.tagline && (
                          <p className="text-sm text-muted-foreground">{sponsor.tagline}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>{sponsor.impression_count} impressions</span>
                          <span>{sponsor.click_count} clicks</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleSponsorActive(sponsor)}
                        >
                          {sponsor.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openSponsorModal(sponsor)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => handleDeleteSponsor(sponsor)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
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

      {/* Sponsor Modal */}
      <Dialog open={sponsorModalOpen} onOpenChange={setSponsorModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSponsor ? 'Edit Sponsor' : 'Add Sponsor'}</DialogTitle>
            <DialogDescription>
              {editingSponsor ? 'Update sponsor details' : 'Create a new sponsor for your newsletters'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={sponsorForm.name}
                onChange={(e) => setSponsorForm({ ...sponsorForm, name: e.target.value })}
                placeholder="Company Name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tagline">Tagline</Label>
              <Input
                id="tagline"
                value={sponsorForm.tagline || ''}
                onChange={(e) => setSponsorForm({ ...sponsorForm, tagline: e.target.value })}
                placeholder="Short catchy phrase"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={sponsorForm.description || ''}
                onChange={(e) => setSponsorForm({ ...sponsorForm, description: e.target.value })}
                placeholder="Brief description of the product/service"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cta_url">CTA URL *</Label>
              <Input
                id="cta_url"
                value={sponsorForm.cta_url}
                onChange={(e) => setSponsorForm({ ...sponsorForm, cta_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cta_text">CTA Button Text</Label>
              <Input
                id="cta_text"
                value={sponsorForm.cta_text}
                onChange={(e) => setSponsorForm({ ...sponsorForm, cta_text: e.target.value })}
                placeholder="Learn More"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="image_url">Image URL (optional)</Label>
              <Input
                id="image_url"
                value={sponsorForm.image_url || ''}
                onChange={(e) => setSponsorForm({ ...sponsorForm, image_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={sponsorForm.is_active}
                onCheckedChange={(checked) => setSponsorForm({ ...sponsorForm, is_active: checked })}
              />
              <Label htmlFor="is_active">Active (shown in emails)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSponsorModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSponsor} disabled={sponsorSaving}>
              {sponsorSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              Preview of the weekly digest email
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-[#0a0a0a] rounded-lg">
            {previewLoading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <iframe
                srcDoc={previewHtml}
                className="w-full h-[500px] border-0"
                title="Email Preview"
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewModalOpen(false)}>
              Close
            </Button>
            <Button onClick={handleSendTestEmail} disabled={testEmailLoading}>
              <TestTube className="h-4 w-4 mr-1" />
              {testEmailLoading ? 'Sending...' : 'Send Test to Me'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}

// Helper function to generate preview HTML
function generatePreviewHtml(
  userName: string,
  updates: any[],
  sponsor: Sponsor | null | undefined
): string {
  const updateCards = updates.map((u) => `
    <div style="background-color: #171717; border: 1px solid #262626; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 16px; font-weight: 600; color: #ffffff;">${u.name}</span>
        <span style="font-size: 10px; font-weight: 600; color: #ffffff; background-color: #2563eb; padding: 3px 8px; border-radius: 4px;">${(u.update_type || 'MINOR').toUpperCase()}</span>
      </div>
      <div style="font-size: 13px; color: #a3a3a3; margin: 4px 0 12px 0;">${u.manufacturer} • ${u.category}</div>
      <div style="font-size: 14px; font-family: monospace;">
        <span style="color: #737373;">${u.old_version}</span>
        <span style="color: #525252;"> → </span>
        <span style="color: #22c55e; font-weight: 600;">${u.new_version}</span>
      </div>
      <div style="font-size: 12px; color: #525252; margin-top: 4px;">Released ${u.release_date}</div>
      ${u.release_notes && u.release_notes.length > 0 ? `
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #262626;">
          ${u.release_notes.slice(0, 2).map((note: string) => `<div style="font-size: 12px; color: #a3a3a3; margin-bottom: 4px;">• ${note}</div>`).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');

  const sponsorHtml = sponsor ? `
    <div style="padding: 24px;">
      <div style="font-size: 10px; font-weight: 600; color: #525252; text-align: center; margin-bottom: 8px; letter-spacing: 1px;">SPONSOR</div>
      <a href="${sponsor.cta_url}" style="text-decoration: none;">
        <div style="background-color: #171717; border: 1px solid #262626; border-radius: 8px; padding: 16px;">
          <div style="font-size: 14px; font-weight: 600; color: #ffffff;">${sponsor.name}</div>
          ${sponsor.tagline ? `<div style="font-size: 13px; color: #3b82f6; margin-top: 4px;">${sponsor.tagline}</div>` : ''}
          ${sponsor.description ? `<div style="font-size: 13px; color: #a3a3a3; margin-top: 8px; line-height: 1.5;">${sponsor.description}</div>` : ''}
          <div style="display: inline-block; font-size: 12px; font-weight: 600; color: #ffffff; background-color: #2563eb; padding: 8px 16px; border-radius: 6px; margin-top: 12px;">${sponsor.cta_text}</div>
        </div>
      </a>
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #0a0a0a;">
    <!-- Header -->
    <div style="padding: 32px 24px 24px 24px; border-bottom: 1px solid #262626;">
      <a href="https://versionvault.dev" style="text-decoration: none;">
        <div style="font-size: 20px; font-weight: 600; color: #ffffff; font-family: monospace;">
          <span style="color: #a3a3a3;">&gt;_</span> VersionVault
        </div>
      </a>
      <div style="font-size: 14px; color: #a3a3a3; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 8px;">
        Weekly Digest
      </div>
    </div>

    <!-- Greeting -->
    <div style="padding: 24px;">
      <div style="font-size: 16px; color: #ffffff; margin-bottom: 12px;">Hey ${userName},</div>
      <div style="font-size: 14px; color: #a3a3a3; line-height: 1.6;">
        Here's what changed in the <strong>${updates.length}</strong> app${updates.length === 1 ? '' : 's'} you're tracking this week:
      </div>
    </div>

    <!-- Updates -->
    <div style="padding: 0 24px 24px 24px;">
      ${updateCards}
      <div style="text-align: center; margin-top: 16px;">
        <a href="https://versionvault.dev/dashboard" style="font-size: 13px; color: #3b82f6; text-decoration: none;">View all in dashboard →</a>
      </div>
    </div>

    ${sponsorHtml}

    <!-- Footer -->
    <div style="padding: 24px; border-top: 1px solid #262626;">
      <div style="font-size: 13px; color: #a3a3a3; text-align: center; margin-bottom: 16px;">
        <a href="#" style="color: #a3a3a3; text-decoration: underline;">Manage Preferences</a>
        <span style="margin: 0 12px; color: #525252;">•</span>
        <a href="#" style="color: #a3a3a3; text-decoration: underline;">Unsubscribe</a>
        <span style="margin: 0 12px; color: #525252;">•</span>
        <a href="#" style="color: #a3a3a3; text-decoration: underline;">Open Dashboard</a>
      </div>
      <div style="font-size: 12px; color: #525252; text-align: center; margin-bottom: 8px;">VersionVault • Software Version Tracking</div>
      <div style="font-size: 12px; color: #404040; text-align: center;">© ${new Date().getFullYear()} VersionVault. All rights reserved.</div>
    </div>
  </div>
</body>
</html>
  `;
}
