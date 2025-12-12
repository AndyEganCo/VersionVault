# Resend Contact Sync - Supabase Integration Guide

This guide explains how VersionVault syncs contacts from Supabase to Resend.

## Overview

VersionVault uses **two approaches** for managing email contacts with Resend:

1. **Dynamic Contact Sync** (Default) - Pulls contacts from Supabase at send time
2. **Resend Audience Sync** (Optional) - Syncs contacts to Resend's contact management

---

## Approach 1: Dynamic Contact Sync (Current Implementation)

### How It Works

The newsletter system already pulls contacts dynamically from your Supabase database:

**Location:** `supabase/functions/queue-weekly-digest/index.ts`

```typescript
// 1. Get user settings (who wants emails and at what frequency)
const { data: userSettings } = await supabase
  .from('user_settings')
  .select('user_id, timezone')
  .eq('email_notifications', true)
  .eq('notification_frequency', 'weekly')

// 2. Get email addresses from auth.users
const { data: authUsers } = await supabase.auth.admin.listUsers()

// 3. Combine settings with emails
const subscribers = userSettings
  .map(settings => ({
    user_id: settings.user_id,
    timezone: settings.timezone,
    email: userEmailMap.get(settings.user_id)
  }))
  .filter(sub => sub.email)
```

### Data Flow

```
Supabase Tables                Newsletter System              Resend
┌──────────────┐              ┌─────────────────┐           ┌──────────┐
│ auth.users   │──email──────>│                 │           │          │
│              │              │ Queue Generator │───────────>│ Send API │
│              │              │                 │           │          │
│user_settings │──prefs──────>│                 │           └──────────┘
└──────────────┘              └─────────────────┘
                                      │
                                      v
                              ┌─────────────────┐
                              │newsletter_queue │
                              │                 │
                              └─────────────────┘
```

### Advantages

✅ **Real-time accuracy** - Always uses latest data from Supabase
✅ **Single source of truth** - User preferences in one place
✅ **Privacy-friendly** - Email addresses stay in your database
✅ **Already implemented** - No additional setup needed

### User Data Sources

| Data | Source Table | Column |
|------|--------------|--------|
| Email | `auth.users` | `email` |
| Notifications enabled | `user_settings` | `email_notifications` |
| Frequency | `user_settings` | `notification_frequency` |
| Timezone | `user_settings` | `timezone` |
| Bounce tracking | `email_bounces` | `bounce_type` |

---

## Approach 2: Resend Audience Sync (Optional Enhancement)

If you want to use Resend's built-in **contact management features** (audiences, segmentation, contact analytics), you can sync contacts to Resend.

### Benefits

✅ Use Resend's contact dashboard
✅ Segment audiences in Resend
✅ Track engagement per contact
✅ Use Resend's unsubscribe management

### Setup Steps

#### 1. Create Resend Audience

1. Go to https://resend.com/audiences
2. Click "Create Audience"
3. Name it (e.g., "VersionVault Users")
4. Copy the Audience ID

#### 2. Configure Environment Variables

Add to your Supabase Edge Function secrets:

```bash
supabase secrets set RESEND_AUDIENCE_ID=aud_xxxxxxxxxxxxxxxx
```

#### 3. Deploy the Sync Function

The sync function has been created at:
```
supabase/functions/sync-resend-contacts/index.ts
```

Deploy it:

```bash
supabase functions deploy sync-resend-contacts
```

#### 4. Run Database Migration

Apply the contact sync migration:

```bash
supabase db push
```

This creates:
- `resend_contact_sync` table to track sync status
- Triggers to mark users for sync when they sign up or update settings
- Helper functions

#### 5. Initial Sync

Trigger the initial sync manually:

```bash
curl -X POST \
  "https://your-project-ref.supabase.co/functions/v1/sync-resend-contacts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

#### 6. Set Up Automatic Sync (Optional)

Create a cron job to sync contacts periodically:

```sql
-- Sync contacts to Resend daily at 3 AM UTC
SELECT cron.schedule(
  'sync-resend-contacts',
  '0 3 * * *',
  $$
  SELECT
    net.http_post(
      url := get_supabase_url() || '/functions/v1/sync-resend-contacts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || get_service_role_key()
      ),
      body := '{}'::jsonb
    );
  $$
);
```

### Sync Behavior

The system automatically marks users for sync when:

1. **New user signs up** - Trigger: `on_auth_user_created_sync_resend`
2. **Email changes** - Trigger: `on_auth_user_updated_sync_resend`
3. **Notification settings change** - Trigger: `on_user_settings_changed_sync_resend`

### Monitor Sync Status

Check pending syncs:

```sql
-- View sync status
SELECT
  user_id,
  email,
  sync_status,
  last_synced_at,
  last_error
FROM resend_contact_sync
ORDER BY updated_at DESC
LIMIT 20;

-- Count pending syncs
SELECT get_pending_resend_sync_count();
```

### Resync Failed Contacts

To retry failed syncs, run the sync function again. It will process all users marked as `pending` or `failed`.

---

## Comparison: Dynamic vs Audience Sync

| Feature | Dynamic Sync | Audience Sync |
|---------|-------------|---------------|
| **Setup complexity** | None (already done) | Moderate |
| **Real-time accuracy** | ✅ Always current | Eventual consistency |
| **Data privacy** | ✅ In your database | Shared with Resend |
| **Resend features** | Send API only | Full contact management |
| **Maintenance** | None | Periodic sync needed |
| **Recommended for** | Most use cases | Advanced analytics needs |

---

## Best Practices

### For Dynamic Sync (Current System)

1. **Keep `user_settings` updated** - This controls who receives emails
2. **Monitor bounce rate** - Check `email_bounces` table regularly
3. **Respect timezone preferences** - Already handled in queue generator
4. **Test with small batches** - Use the admin panel to test

### For Audience Sync

1. **Sync regularly** - Daily or after significant user activity
2. **Handle failures gracefully** - Check `last_error` in sync table
3. **Respect unsubscribes** - The sync function marks contacts as unsubscribed if `email_notifications = false`
4. **Monitor Resend limits** - Be aware of contact limits on your Resend plan

---

## Troubleshooting

### Dynamic Sync Issues

**Problem:** Users not receiving emails

```sql
-- Check user settings
SELECT * FROM user_settings WHERE user_id = 'user-uuid';

-- Check if email exists
SELECT email FROM auth.users WHERE id = 'user-uuid';

-- Check bounce count
SELECT * FROM email_bounces WHERE user_id = 'user-uuid';
```

**Problem:** Queue is empty

```sql
-- Check queue
SELECT * FROM newsletter_queue
WHERE status = 'pending'
ORDER BY scheduled_for DESC;

-- Manually trigger queue generation
-- See docs/setup/newsletter-cron.md
```

### Audience Sync Issues

**Problem:** Contacts not syncing to Resend

```sql
-- Check sync status
SELECT * FROM resend_contact_sync
WHERE sync_status = 'failed'
ORDER BY updated_at DESC;

-- Reset failed syncs to retry
UPDATE resend_contact_sync
SET sync_status = 'pending'
WHERE sync_status = 'failed';
```

**Problem:** Duplicate contacts in Resend

- Resend uses email as the unique identifier
- Updates are handled automatically
- Check `resend_contact_id` in sync table

---

## API Reference

### Sync Resend Contacts Function

**Endpoint:** `POST /functions/v1/sync-resend-contacts`

**Authentication:** Service role key or admin JWT

**Response:**
```json
{
  "totalUsers": 100,
  "synced": 98,
  "failed": 2,
  "errors": [
    {
      "email": "user@example.com",
      "error": "Invalid email format"
    }
  ]
}
```

---

## Related Documentation

- [Newsletter System Setup](./newsletter.md)
- [Newsletter Cron Jobs](./newsletter-cron.md)
- [Resend API Documentation](https://resend.com/docs)
- [Supabase Auth Users](https://supabase.com/docs/guides/auth/managing-user-data)

---

## Need Help?

- Check Edge Function logs: Supabase Dashboard → Edge Functions
- Check cron job logs: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC`
- Check newsletter logs: `SELECT * FROM newsletter_logs ORDER BY created_at DESC`
