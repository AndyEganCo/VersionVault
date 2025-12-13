// Newsletter System - Main exports

export * from './types';
export * from './version-compare';
export * from './queue';
export * from './generate-digest';

// Constants
export const VERSIONVAULT_EMAIL = 'digest@updates.versionvault.dev';
export const VERSIONVAULT_FROM = 'VersionVault <digest@updates.versionvault.dev>';
export const VERSIONVAULT_URL = 'https://versionvault.dev';

export const DEFAULT_TIMEZONE = 'America/New_York';
export const DEFAULT_SEND_HOUR = 8; // 8am

export const MAX_UPDATES_PER_EMAIL = 20; // Limit updates shown, link to dashboard for more
export const MAX_BATCH_SIZE = 100; // Resend batch API limit
export const MAX_RETRY_ATTEMPTS = 3;

// "All Quiet" creative messages
export const ALL_QUIET_MESSAGES = [
  "Your software is suspiciously stable this week. We're keeping an eye on it.",
  "Nothing to report. Your apps are quietly doing their jobs.",
  "Zero updates. Either everything's perfect, or the calm before the storm.",
  "All quiet on the version front. Enjoy it while it lasts.",
  "No updates detected. Time to grab a coffee instead of reading release notes.",
  "Your tracked apps are taking a well-deserved break this week.",
  "The update fairy took the week off. Check back soon!",
  "Silence in the changelog. Your software is vibing.",
];

/**
 * Get a random "all quiet" message
 */
export function getRandomAllQuietMessage(): string {
  const index = Math.floor(Math.random() * ALL_QUIET_MESSAGES.length);
  return ALL_QUIET_MESSAGES[index];
}

/**
 * Generate an idempotency key for a newsletter send
 * Prevents duplicate sends if the function is retried
 */
export function generateIdempotencyKey(
  userId: string,
  emailType: string,
  date: Date = new Date()
): string {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  return `${userId}-${emailType}-${dateStr}`;
}

/**
 * Generate unsubscribe URL with token
 */
export function generateUnsubscribeUrl(userId: string, token: string): string {
  return `${VERSIONVAULT_URL}/unsubscribe?uid=${userId}&token=${token}`;
}

/**
 * Generate preferences URL
 */
export function generatePreferencesUrl(): string {
  return `${VERSIONVAULT_URL}/user/notifications`;
}

/**
 * Generate dashboard URL
 */
export function generateDashboardUrl(): string {
  return `${VERSIONVAULT_URL}/dashboard`;
}

/**
 * Get email subject based on type and content
 */
export function getEmailSubject(
  emailType: string,
  updateCount: number = 0
): string {
  switch (emailType) {
    case 'weekly_digest':
      return updateCount > 0
        ? `${updateCount} update${updateCount === 1 ? '' : 's'} for your tracked software`
        : 'Your weekly Version Digest';
    case 'daily_digest':
      return updateCount > 0
        ? `${updateCount} update${updateCount === 1 ? '' : 's'} today`
        : 'Your daily Version Digest';
    case 'monthly_digest':
      return updateCount > 0
        ? `${updateCount} update${updateCount === 1 ? '' : 's'} this month`
        : 'Your monthly Version Digest';
    case 'all_quiet':
      return 'All quiet on the version front';
    case 'welcome':
      return 'Welcome to VersionVault notifications';
    case 'instant_alert':
      return 'New version detected!';
    default:
      return 'VersionVault Update';
  }
}

/**
 * Check if current hour matches target hour in user's timezone
 */
export function isTargetHourInTimezone(
  timezone: string,
  targetHour: number = DEFAULT_SEND_HOUR
): boolean {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    });
    const currentHour = parseInt(formatter.format(now), 10);
    return currentHour === targetHour;
  } catch {
    // Invalid timezone, default to false
    return false;
  }
}

/**
 * Get day of week in user's timezone
 */
export function getDayOfWeekInTimezone(timezone: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long',
    });
    return formatter.format(now).toLowerCase();
  } catch {
    // Invalid timezone, return current day in UTC
    return new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  }
}

/**
 * Format date for display in emails
 */
export function formatDateForEmail(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/**
 * Get update type badge color
 */
export function getUpdateTypeColor(type: 'major' | 'minor' | 'patch'): string {
  switch (type) {
    case 'major':
      return '#ef4444'; // Red
    case 'minor':
      return '#3b82f6'; // Blue
    case 'patch':
      return '#22c55e'; // Green
    default:
      return '#6b7280'; // Gray
  }
}

/**
 * Get update type label
 */
export function getUpdateTypeLabel(type: 'major' | 'minor' | 'patch'): string {
  switch (type) {
    case 'major':
      return 'Major Update';
    case 'minor':
      return 'Minor Update';
    case 'patch':
      return 'Patch';
    default:
      return 'Update';
  }
}
