// Newsletter System Types

export type EmailType =
  | 'weekly_digest'
  | 'daily_digest'
  | 'monthly_digest'
  | 'all_quiet'
  | 'welcome'
  | 'instant_alert'
  | 'no_tracking_reminder';

export type QueueStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';

export type BounceType = 'hard' | 'soft';

export type LogStatus = 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained';

// Database row types
export interface NewsletterQueueRow {
  id: string;
  user_id: string;
  email: string;
  email_type: EmailType;
  payload: NewsletterPayload;
  status: QueueStatus;
  scheduled_for: string;
  timezone: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  resend_id: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
}

export interface NewsletterLogRow {
  id: string;
  user_id: string;
  email: string;
  email_type: string;
  subject: string | null;
  software_updates: SoftwareUpdateSummary[];
  new_software?: NewSoftwareSummary[];
  resend_id: string | null;
  status: LogStatus;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  created_at: string;
}

export interface EmailBounceRow {
  id: string;
  user_id: string;
  email: string;
  bounce_type: BounceType;
  reason: string | null;
  resend_id: string | null;
  created_at: string;
}

export interface NewsletterSponsorRow {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  image_url: string | null;
  cta_url: string;
  cta_text: string;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  impression_count: number;
  click_count: number;
  created_at: string;
  updated_at: string;
}

export interface NewsletterSettingRow {
  id: string;
  setting_key: string;
  setting_value: unknown;
  updated_at: string;
}

// Email template payload types
export interface SoftwareUpdateSummary {
  software_id: string;
  name: string;
  manufacturer: string;
  category: string;
  old_version: string;
  new_version: string;
  release_date: string;
  release_notes?: string[];
  update_type: 'major' | 'minor' | 'patch';
}

export interface NewSoftwareSummary {
  software_id: string;
  name: string;
  manufacturer: string;
  category: string;
  initial_version: string;
  added_date: string;
}

export interface SponsorData {
  name: string;
  tagline: string | null;
  description: string | null;
  image_url: string | null;
  cta_url: string;
  cta_text: string;
}

export interface NewsletterPayload {
  updates: SoftwareUpdateSummary[];
  newSoftware?: NewSoftwareSummary[];
  sponsor?: SponsorData | null;
  all_quiet_message?: string;
  unsubscribe_token?: string;
}

// Email template props
export interface WeeklyDigestProps {
  userName: string;
  userEmail: string;
  updates: SoftwareUpdateSummary[];
  newSoftware?: NewSoftwareSummary[];
  sponsor?: SponsorData | null;
  unsubscribeUrl: string;
  preferencesUrl: string;
  dashboardUrl: string;
  softwarePageUrl: string;
}

export interface AllQuietProps {
  userName: string;
  userEmail: string;
  message: string;
  trackedCount: number;
  sponsor?: SponsorData | null;
  unsubscribeUrl: string;
  preferencesUrl: string;
  dashboardUrl: string;
}

export interface WelcomeEmailProps {
  userName: string;
  userEmail: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  preferencesUrl: string;
  dashboardUrl: string;
}

export interface PopularSoftware {
  software_id: string;
  name: string;
  manufacturer: string;
  category: string;
  current_version: string;
  tracker_count: number;
}

export interface NoTrackingReminderProps {
  userName: string;
  userEmail: string;
  popularSoftware?: PopularSoftware[];
  sponsor?: SponsorData | null;
  unsubscribeUrl: string;
  preferencesUrl: string;
  dashboardUrl: string;
  softwarePageUrl: string;
}

// Queue and processing types
export interface QueueDigestParams {
  userId: string;
  email: string;
  timezone: string;
  frequency: 'daily' | 'weekly' | 'monthly';
}

export interface ProcessQueueResult {
  processed: number;
  sent: number;
  failed: number;
  errors: Array<{ userId: string; error: string }>;
}

// Admin types
export interface NewsletterStats {
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  totalBounced: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
}

export interface QueueSummary {
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  scheduledFor: string | null;
}

export interface AdminDashboardData {
  stats: NewsletterStats;
  queueSummary: QueueSummary;
  recentLogs: NewsletterLogRow[];
  activeSponsor: NewsletterSponsorRow | null;
  autoSendEnabled: boolean;
}

// Version comparison types
export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
  raw: string;
}

export type VersionCompareResult = -1 | 0 | 1;
