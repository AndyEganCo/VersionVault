// Newsletter Queue Management
// Handles adding jobs to queue and tracking status

import { supabase } from '@/lib/supabase';
import type {
  NewsletterQueueRow,
  NewsletterPayload,
  EmailType,
  QueueStatus,
  QueueSummary,
} from './types';
import { generateIdempotencyKey } from './index';

/**
 * Add a newsletter job to the queue
 */
export async function addToQueue(params: {
  userId: string;
  email: string;
  emailType: EmailType;
  payload: NewsletterPayload;
  scheduledFor: Date;
  timezone: string;
}): Promise<{ success: boolean; queueId?: string; error?: string }> {
  const { userId, email, emailType, payload, scheduledFor, timezone } = params;

  // Generate idempotency key to prevent duplicates
  const idempotencyKey = generateIdempotencyKey(userId, emailType, scheduledFor);

  try {
    const { data, error } = await supabase
      .from('newsletter_queue')
      .upsert(
        {
          user_id: userId,
          email,
          email_type: emailType,
          payload,
          status: 'pending',
          scheduled_for: scheduledFor.toISOString(),
          timezone,
          idempotency_key: idempotencyKey,
        },
        {
          onConflict: 'idempotency_key',
          ignoreDuplicates: true,
        }
      )
      .select('id')
      .single();

    if (error) {
      // Duplicate key is expected and okay
      if (error.code === '23505') {
        return { success: true };
      }
      throw error;
    }

    return { success: true, queueId: data?.id };
  } catch (error) {
    console.error('Failed to add to queue:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get pending queue items ready to send
 * Filters by users whose local time matches the target hour
 */
export async function getPendingQueueItems(
  targetHour: number = 8,
  limit: number = 100
): Promise<NewsletterQueueRow[]> {
  const now = new Date();

  // Get items that are scheduled for now or earlier
  const { data, error } = await supabase
    .from('newsletter_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', now.toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Failed to get pending queue items:', error);
    return [];
  }

  // Filter to only include users where it's currently the target hour in their timezone
  return (data || []).filter(item => {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: item.timezone,
        hour: 'numeric',
        hour12: false,
      });
      const currentHour = parseInt(formatter.format(now), 10);
      return currentHour === targetHour;
    } catch {
      // Invalid timezone, include it anyway
      return true;
    }
  });
}

/**
 * Update queue item status
 */
export async function updateQueueStatus(
  queueId: string,
  status: QueueStatus,
  additionalData?: {
    resendId?: string;
    lastError?: string;
    sentAt?: Date;
  }
): Promise<boolean> {
  const updateData: Record<string, unknown> = { status };

  if (additionalData?.resendId) {
    updateData.resend_id = additionalData.resendId;
  }
  if (additionalData?.lastError) {
    updateData.last_error = additionalData.lastError;
  }
  if (additionalData?.sentAt) {
    updateData.sent_at = additionalData.sentAt.toISOString();
  }

  const { error } = await supabase
    .from('newsletter_queue')
    .update(updateData)
    .eq('id', queueId);

  if (error) {
    console.error('Failed to update queue status:', error);
    return false;
  }

  return true;
}

/**
 * Mark queue item as processing and increment attempts
 */
export async function markAsProcessing(queueId: string): Promise<boolean> {
  const { error } = await supabase.rpc('increment_queue_attempts', {
    queue_id: queueId,
  });

  // Fallback if RPC doesn't exist
  if (error) {
    const { error: updateError } = await supabase
      .from('newsletter_queue')
      .update({
        status: 'processing',
        attempts: supabase.rpc('increment', { x: 1 }),
      })
      .eq('id', queueId);

    if (updateError) {
      // Simple fallback
      const { error: simpleError } = await supabase
        .from('newsletter_queue')
        .update({ status: 'processing' })
        .eq('id', queueId);

      return !simpleError;
    }
  }

  return true;
}

/**
 * Mark failed items for retry or permanent failure
 */
export async function markAsFailed(
  queueId: string,
  error: string,
  currentAttempts: number,
  maxAttempts: number = 3
): Promise<void> {
  const isFinalFailure = currentAttempts >= maxAttempts;

  await supabase
    .from('newsletter_queue')
    .update({
      status: isFinalFailure ? 'failed' : 'pending',
      last_error: error,
    })
    .eq('id', queueId);
}

/**
 * Get queue summary for admin dashboard
 */
export async function getQueueSummary(): Promise<QueueSummary> {
  const { data, error } = await supabase
    .from('newsletter_queue')
    .select('status, scheduled_for')
    .order('scheduled_for', { ascending: true });

  if (error || !data) {
    return {
      pending: 0,
      processing: 0,
      sent: 0,
      failed: 0,
      scheduledFor: null,
    };
  }

  const summary: QueueSummary = {
    pending: 0,
    processing: 0,
    sent: 0,
    failed: 0,
    scheduledFor: null,
  };

  for (const item of data) {
    switch (item.status) {
      case 'pending':
        summary.pending++;
        if (!summary.scheduledFor && item.scheduled_for) {
          summary.scheduledFor = item.scheduled_for;
        }
        break;
      case 'processing':
        summary.processing++;
        break;
      case 'sent':
        summary.sent++;
        break;
      case 'failed':
        summary.failed++;
        break;
    }
  }

  return summary;
}

/**
 * Cancel all pending queue items (admin action)
 */
export async function cancelPendingQueue(): Promise<number> {
  const { data, error } = await supabase
    .from('newsletter_queue')
    .update({ status: 'cancelled' })
    .eq('status', 'pending')
    .select('id');

  if (error) {
    console.error('Failed to cancel pending queue:', error);
    return 0;
  }

  return data?.length || 0;
}

/**
 * Clear old completed/failed items from queue (cleanup)
 */
export async function cleanupQueue(daysOld: number = 30): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);

  const { data, error } = await supabase
    .from('newsletter_queue')
    .delete()
    .in('status', ['sent', 'failed', 'cancelled'])
    .lt('created_at', cutoff.toISOString())
    .select('id');

  if (error) {
    console.error('Failed to cleanup queue:', error);
    return 0;
  }

  return data?.length || 0;
}
