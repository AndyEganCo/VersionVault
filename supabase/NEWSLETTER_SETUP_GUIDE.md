# Newsletter System Setup Guide

This guide walks you through setting up the VersionVault newsletter system from scratch.

## Prerequisites

- Supabase project with database access
- Service role key from Supabase dashboard
- Resend API key for sending emails

## Step 1: Deploy Database Migrations

Run all migrations to set up the newsletter tables, cron jobs, and configuration:

```bash
supabase db push
```

This will create:
- Newsletter tables (queue, logs, bounces, sponsors)
- App settings infrastructure
- Helper functions for configuration
- All 5 cron jobs (disabled until configured)

## Step 2: Configure Supabase URL and Service Role Key

The cron jobs need to know your Supabase URL and service role key to call edge functions.

### Option A: SQL Editor (Recommended)

Go to **Supabase Dashboard → SQL Editor** and run:

```sql
-- 1. Update Supabase URL
UPDATE app_settings
SET value = 'https://your-project-ref.supabase.co'
WHERE key = 'supabase_url';

-- 2. Store service role key in Vault (most secure)
SELECT vault.create_secret(
  'eyJhbGc...your-actual-service-role-key',
  'service_role_key',
  'Service role key for cron job authentication'
);
```

**Find your values:**
- **Supabase URL**: Dashboard → Settings → API → Project URL
- **Service Role Key**: Dashboard → Settings → API → Service Role Key (secret)

### Option B: Edit Migration File

1. Open `supabase/migrations/20241210000002_update_app_settings_values.sql`
2. Replace the placeholder values
3. Run `supabase db push`

## Step 3: Configure Edge Function Secrets

Set required secrets for the edge functions:

```bash
# From your project root
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
supabase secrets set CRON_SECRET=your-secure-random-string
```

**Get your Resend API key:**
1. Go to https://resend.com
2. Dashboard → API Keys
3. Create a new API key

## Step 4: Deploy Edge Functions

Deploy the newsletter edge functions:

```bash
# Deploy all functions
supabase functions deploy queue-weekly-digest
supabase functions deploy process-newsletter-queue
supabase functions deploy handle-email-webhook
```

## Step 5: Configure Resend Webhooks

To track email delivery and engagement:

1. Go to https://resend.com/webhooks
2. Add webhook URL: `https://your-project-ref.supabase.co/functions/v1/handle-email-webhook`
3. Select events:
   - ✅ email.delivered
   - ✅ email.opened
   - ✅ email.clicked
   - ✅ email.bounced
   - ✅ email.complained

## Step 6: Verify Setup

Run these SQL queries to verify everything is configured:

```sql
-- Check cron jobs were created
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname LIKE '%newsletter%' OR jobname LIKE '%digest%'
ORDER BY jobname;

-- Verify app settings
SELECT key,
       CASE
         WHEN key = 'service_role_key' THEN '***REDACTED***'
         ELSE value
       END as value,
       description
FROM app_settings;

-- Check if service role key is accessible
SELECT CASE
  WHEN length(get_service_role_key()) > 20 THEN 'Service role key configured ✓'
  ELSE 'Service role key NOT configured ✗'
END as status;

-- View recent cron job runs
SELECT job_name, status, return_message, start_time, end_time
FROM cron.job_run_details
WHERE job_name IN ('queue-weekly-digest', 'queue-daily-digest', 'queue-monthly-digest', 'process-newsletter-queue')
ORDER BY start_time DESC
LIMIT 10;
```

## Step 7: Test the System

### Manual Test Queue

Test by manually triggering a digest generation:

```bash
curl -X POST \
  "https://your-project-ref.supabase.co/functions/v1/queue-weekly-digest" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -d '{"frequency": "weekly"}'
```

Check the queue:

```sql
SELECT * FROM newsletter_queue
ORDER BY created_at DESC
LIMIT 5;
```

### Manual Test Processing

Process any queued emails immediately:

```bash
curl -X POST \
  "https://your-project-ref.supabase.co/functions/v1/process-newsletter-queue" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -d '{"force": true}'
```

Check the logs:

```sql
SELECT * FROM newsletter_logs
ORDER BY sent_at DESC
LIMIT 5;
```

## Cron Schedule Summary

The following cron jobs run automatically:

| Job Name | Schedule | Description |
|----------|----------|-------------|
| `queue-weekly-digest` | Sun 11 PM UTC | Generate weekly digests |
| `queue-daily-digest` | Every day 11 PM UTC | Generate daily digests |
| `queue-monthly-digest` | 1st of month 11 PM UTC | Generate monthly digests |
| `process-newsletter-queue` | Every hour | Send emails to users at 8 AM local time |
| `cleanup-newsletter-queue` | Sun 4 AM UTC | Delete old queue items (30+ days) |

## Troubleshooting

### Cron jobs failing with "unrecognized configuration parameter"

The `app_settings` table is not configured. Run:

```sql
UPDATE app_settings
SET value = 'https://your-project-ref.supabase.co'
WHERE key = 'supabase_url';
```

### Edge function calls failing with 401

The service role key is not set or incorrect. Check vault or app_settings:

```sql
-- Check if key exists
SELECT CASE
  WHEN get_service_role_key() IS NOT NULL THEN 'Key found'
  ELSE 'Key missing'
END;
```

### No emails being sent

Check:
1. `RESEND_API_KEY` is set in edge function secrets
2. Queue has pending items: `SELECT * FROM newsletter_queue WHERE status = 'pending'`
3. Cron job is running: Check `cron.job_run_details` for errors
4. Users have `notifications_enabled = true` in their settings

### Cron jobs not running

Check if cron extension is enabled:

```sql
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```

Enable if missing:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

## Admin Panel

Access the newsletter admin panel at `/admin/newsletter` to:
- View queue status
- Send test emails
- Preview digest content
- Manually trigger queue processing
- View send statistics

## Need Help?

- Check cron job logs: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20`
- Check newsletter logs: `SELECT * FROM newsletter_logs ORDER BY sent_at DESC LIMIT 20`
- Review edge function logs in Supabase Dashboard → Edge Functions
