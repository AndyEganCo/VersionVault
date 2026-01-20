// Newsletter Shared Types
// TypeScript interfaces used across newsletter functions

export type EmailType =
  | 'daily_digest'
  | 'weekly_digest'
  | 'monthly_digest'
  | 'all_quiet'
  | 'welcome'
  | 'instant_alert'
  | 'no_tracking_reminder'

export type QueueStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled'

export type NotificationFrequency = 'daily' | 'weekly' | 'monthly'

export type AllQuietPreference = 'always' | 'new_software_only'

export interface SoftwareUpdateSummary {
  software_id: string
  name: string
  manufacturer: string
  category: string
  old_version: string
  new_version: string
  release_date: string
  release_notes?: string[]
  update_type?: 'major' | 'minor' | 'patch'
}

export interface NewSoftwareSummary {
  software_id: string
  name: string
  manufacturer: string
  category: string
  initial_version: string
  added_date: string
}

export interface SponsorData {
  id: string
  name: string
  tagline: string
  description: string
  image_url: string
  cta_url: string
  cta_text: string
}

export interface NewsletterPayload {
  updates: SoftwareUpdateSummary[]
  newSoftware?: NewSoftwareSummary[]
  sponsor?: SponsorData | null
  all_quiet_message?: string
  unsubscribe_token?: string
  tracked_count?: number
  frequency?: string
}

export interface QueueEntry {
  id: string
  user_id: string
  email: string
  email_type: EmailType
  payload: NewsletterPayload
  status: QueueStatus
  scheduled_for: string
  timezone: string
  priority: number
  attempts: number
  max_attempts: number
  last_error?: string
  resend_id?: string
  idempotency_key: string
  created_at: string
  updated_at: string
  sent_at?: string
}

export interface UserSettings {
  user_id: string
  email_notifications: boolean
  notification_frequency: NotificationFrequency
  timezone: string
  all_quiet_preference: AllQuietPreference
}

export interface TrackedSoftware {
  software_id: string
  last_notified_version: string | null
  last_notified_at: string | null
}

export interface CurrentVersion {
  software_id: string
  current_version: string
  release_date: string | null
  detected_at: string
  notes: string[] | null
  type: string | null
}

export interface SoftwareDetails {
  id: string
  name: string
  manufacturer: string
  category: string
}

export interface QueueSummary {
  totalUsers: number
  queued: number
  withUpdates: number
  allQuiet: number
  skipped: number
  errors: QueueResult[]
}

export interface QueueResult {
  user_id: string
  email: string
  error?: string
  success?: boolean
}

export interface ProcessSummary {
  totalProcessed: number
  sent: number
  failed: number
  errors: Array<{
    queue_id: string
    email: string
    error: string
  }>
}
