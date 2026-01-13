import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Send,
  Eye,
  Save,
  FileText,
  Users,
  RefreshCw,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

interface NewsletterDraft {
  id: string;
  name: string | null;
  subject: string;
  content: string;
  content_type: 'html' | 'markdown';
  notes: string | null;
  is_template: boolean;
  created_at: string;
  updated_at: string;
}

type RecipientType = 'test' | 'all' | 'segment';

interface Sponsor {
  name: string;
  tagline: string | null;
  description: string | null;
  cta_url: string;
  cta_text: string;
}

export function NewsletterCompose() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  // Form state
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [draftName, setDraftName] = useState('');
  const [notes, setNotes] = useState('');
  const [recipientType, setRecipientType] = useState<RecipientType>('test');
  const [testEmail, setTestEmail] = useState(user?.email || '');

  // UI state
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [drafts, setDrafts] = useState<NewsletterDraft[]>([]);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);

  // Stats
  const [totalUsers, setTotalUsers] = useState(0);
  const [activeSponsor, setActiveSponsor] = useState<Sponsor | null>(null);

  useEffect(() => {
    if (user && isAdmin) {
      loadDrafts();
      loadStats();
    }
  }, [user, isAdmin]);

  const loadDrafts = async () => {
    try {
      const { data } = await supabase
        .from('newsletter_drafts')
        .select('*')
        .is('sent_at', null) // Only unsent drafts
        .order('updated_at', { ascending: false })
        .limit(10);

      if (data) {
        setDrafts(data);
      }
    } catch (error) {
      console.error('Error loading drafts:', error);
    }
  };

  const loadStats = async () => {
    try {
      // Get total active users with email notifications enabled
      const { count } = await supabase
        .from('user_settings')
        .select('*', { count: 'exact', head: true })
        .eq('email_notifications', true);

      setTotalUsers(count || 0);

      // Get active sponsor
      const { data: sponsorData } = await supabase
        .from('newsletter_sponsors')
        .select('name, tagline, description, cta_url, cta_text')
        .eq('is_active', true)
        .single();

      if (sponsorData) {
        setActiveSponsor(sponsorData);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleSaveDraft = async () => {
    if (!subject || !content) {
      toast.error('Subject and content are required');
      return;
    }

    setSaving(true);
    try {
      if (currentDraftId) {
        // Update existing draft
        const { error } = await supabase
          .from('newsletter_drafts')
          .update({
            name: draftName || null,
            subject,
            content,
            content_type: 'html',
            notes: notes || null,
          })
          .eq('id', currentDraftId);

        if (error) throw error;
        toast.success('Draft updated');
      } else {
        // Create new draft
        const { data, error } = await supabase
          .from('newsletter_drafts')
          .insert({
            created_by: user!.id,
            name: draftName || null,
            subject,
            content,
            content_type: 'html',
            notes: notes || null,
          })
          .select()
          .single();

        if (error) throw error;
        setCurrentDraftId(data.id);
        toast.success('Draft saved');
      }

      loadDrafts();
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error('Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handleLoadDraft = (draft: NewsletterDraft) => {
    setCurrentDraftId(draft.id);
    setDraftName(draft.name || '');
    setSubject(draft.subject);
    setContent(draft.content);
    setNotes(draft.notes || '');
    toast.success('Draft loaded');
  };

  const handlePreview = () => {
    setPreviewLoading(true);
    setPreviewOpen(true);

    try {
      const html = generateNewsletterHtml({
        subject,
        content,
        userName: user?.email?.split('@')[0] || 'there',
        userId: user?.id || '',
        sponsor: activeSponsor,
      });
      setPreviewHtml(html);
    } catch (error) {
      console.error('Error generating preview:', error);
      toast.error('Failed to generate preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSend = async () => {
    if (!subject || !content) {
      toast.error('Subject and content are required');
      return;
    }

    if (recipientType === 'test' && !testEmail) {
      toast.error('Test email address is required');
      return;
    }

    if (recipientType === 'all') {
      const confirmed = confirm(
        `Are you sure you want to send this newsletter to ${totalUsers} users? This cannot be undone.`
      );
      if (!confirmed) return;
    }

    setSending(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-custom-newsletter`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            subject,
            content,
            recipientType,
            testEmail: recipientType === 'test' ? testEmail : undefined,
            draftId: currentDraftId,
            includeSponsor: true,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send newsletter');
      }

      const result = await response.json();

      toast.success(
        `Newsletter sent successfully! ${result.sent_count} emails sent${result.failed_count > 0 ? `, ${result.failed_count} failed` : ''}`
      );

      // Mark draft as sent if it exists
      if (currentDraftId) {
        await supabase
          .from('newsletter_drafts')
          .update({ sent_at: new Date().toISOString() })
          .eq('id', currentDraftId);
      }

      // Reset form
      setSubject('');
      setContent('');
      setDraftName('');
      setNotes('');
      setCurrentDraftId(null);
      loadDrafts();
    } catch (error: any) {
      console.error('Error sending newsletter:', error);
      toast.error(error.message || 'Failed to send newsletter');
    } finally {
      setSending(false);
    }
  };

  if (!isAdmin) {
    return (
      <PageLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Access denied. Admin only.</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/admin/newsletter')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Newsletter Management
        </Button>
      </div>

      <PageHeader
        title="Compose Custom Newsletter"
        description="Create and send custom newsletters to your users"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Composer */}
        <div className="lg:col-span-2 space-y-6">
          {/* Email Content */}
          <Card>
            <CardHeader>
              <CardTitle>Email Content</CardTitle>
              <CardDescription>
                Write your newsletter content below
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Subject Line *</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="January Product Updates - VersionVault"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Email Content (HTML) *</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="<h2>What's New</h2>&#10;<p>Here's what we shipped this month...</p>"
                  rows={16}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Use HTML for formatting. The content will be wrapped in the VersionVault email template automatically.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handlePreview}
                  disabled={!subject || !content}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={!subject || !content || saving}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Draft'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recipients */}
          <Card>
            <CardHeader>
              <CardTitle>Recipients</CardTitle>
              <CardDescription>Choose who will receive this newsletter</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recipient-type">Send To</Label>
                <Select
                  value={recipientType}
                  onValueChange={(value) => setRecipientType(value as RecipientType)}
                >
                  <SelectTrigger id="recipient-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="test">Test Email Only</SelectItem>
                    <SelectItem value="all">All Users ({totalUsers})</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {recipientType === 'test' && (
                <div className="space-y-2">
                  <Label htmlFor="test-email">Test Email Address</Label>
                  <Input
                    id="test-email"
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="your@email.com"
                  />
                </div>
              )}

              {recipientType === 'all' && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-500">Warning</p>
                      <p className="text-sm text-muted-foreground">
                        This will send the newsletter to {totalUsers} users. Make sure to preview and test first!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Button
                onClick={handleSend}
                disabled={!subject || !content || sending}
                className="w-full"
              >
                <Send className="h-4 w-4 mr-2" />
                {sending ? 'Sending...' : `Send Newsletter${recipientType === 'all' ? ` to ${totalUsers} users` : ''}`}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Draft Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Draft Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="draft-name">Draft Name (optional)</Label>
                <Input
                  id="draft-name"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="January Newsletter"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal notes about this newsletter..."
                  rows={4}
                />
              </div>

              {currentDraftId && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Draft saved</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Saved Drafts */}
          {drafts.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Recent Drafts</CardTitle>
                  <Button variant="ghost" size="sm" onClick={loadDrafts}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {drafts.map((draft) => (
                    <button
                      key={draft.id}
                      onClick={() => handleLoadDraft(draft)}
                      className="w-full text-left p-3 rounded-lg border hover:bg-muted transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {draft.name || draft.subject}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {new Date(draft.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                        {draft.id === currentDraftId && (
                          <Badge variant="secondary" className="text-xs">Current</Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>Template Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">VersionVault Styling</p>
                  <p className="text-xs text-muted-foreground">
                    Your content will be wrapped in the VersionVault email template with dark theme and branding.
                  </p>
                </div>
              </div>

              {activeSponsor && (
                <div className="flex items-start gap-2">
                  <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Active Sponsor</p>
                    <p className="text-xs text-muted-foreground">
                      {activeSponsor.name} will be included in the email
                    </p>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t">
                <p className="text-xs text-muted-foreground">
                  Tip: Use the Preview button to see how your newsletter will look before sending.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Newsletter Preview</DialogTitle>
            <DialogDescription>
              Preview of your custom newsletter
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
                title="Newsletter Preview"
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}

// Helper function to generate newsletter HTML
function generateNewsletterHtml(params: {
  subject: string;
  content: string;
  userName: string;
  userId: string;
  sponsor: Sponsor | null;
}): string {
  const { content, userName, userId, sponsor } = params;

  const sponsorHtml = sponsor
    ? `
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
  `
    : '';

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
        Newsletter
      </div>
    </div>

    <!-- Greeting -->
    <div style="padding: 24px;">
      <div style="font-size: 16px; color: #ffffff; margin-bottom: 12px;">Hey ${userName},</div>
    </div>

    <!-- Main Content -->
    <div style="padding: 0 24px 24px 24px;">
      <div style="color: #a3a3a3; line-height: 1.6;">
        ${content}
      </div>
    </div>

    ${sponsorHtml}

    <!-- Footer -->
    <div style="padding: 24px; border-top: 1px solid #262626;">
      <div style="font-size: 13px; color: #a3a3a3; text-align: center; margin-bottom: 16px;">
        <a href="https://versionvault.dev/user/notifications" style="color: #a3a3a3; text-decoration: underline;">Manage Preferences</a>
        <span style="margin: 0 12px; color: #525252;">•</span>
        <a href="https://versionvault.dev/unsubscribe?uid=${userId}" style="color: #a3a3a3; text-decoration: underline;">Unsubscribe</a>
        <span style="margin: 0 12px; color: #525252;">•</span>
        <a href="https://versionvault.dev/dashboard" style="color: #a3a3a3; text-decoration: underline;">Dashboard</a>
      </div>
      <div style="font-size: 12px; color: #525252; text-align: center; margin-bottom: 8px;">VersionVault • Software Version Tracking</div>
      <div style="font-size: 12px; color: #404040; text-align: center;">© ${new Date().getFullYear()} VersionVault. All rights reserved.</div>
    </div>
  </div>
</body>
</html>
  `;
}
