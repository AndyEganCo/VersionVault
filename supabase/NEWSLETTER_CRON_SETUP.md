# Newsletter Cron Jobs Setup

This document describes how to configure cron jobs for the VersionVault newsletter system.

## Required Cron Jobs

### 1. Queue Weekly Digest (Sunday Night)

Runs on Sunday at 11:00 PM UTC to prepare Monday's digest emails.

**Supabase Dashboard → Database → Extensions → pg_cron**

```sql
-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Queue weekly digest every Sunday at 11:00 PM UTC
SELECT cron.schedule(
  'queue-weekly-digest',
  '0 23 * * 0',  -- Sunday at 11:00 PM UTC
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/queue-weekly-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object('frequency', 'weekly')
  );
  $$
);
```

### 2. Queue Daily Digest (Every Night)

Runs every night at 11:00 PM UTC to prepare daily digest emails.

```sql
SELECT cron.schedule(
  'queue-daily-digest',
  '0 23 * * *',  -- Every day at 11:00 PM UTC
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/queue-weekly-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object('frequency', 'daily')
  );
  $$
);
```

### 3. Queue Monthly Digest (1st of Month)

Runs on the 1st of each month at 11:00 PM UTC.

```sql
SELECT cron.schedule(
  'queue-monthly-digest',
  '0 23 1 * *',  -- 1st of month at 11:00 PM UTC
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/queue-weekly-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object('frequency', 'monthly')
  );
  $$
);
```

### 4. Process Newsletter Queue (Every Hour)

Runs every hour to send emails to users where it's currently 8 AM in their timezone.

```sql
SELECT cron.schedule(
  'process-newsletter-queue',
  '0 * * * *',  -- Every hour at :00
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/process-newsletter-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### 5. Queue Cleanup (Weekly)

Cleans up old sent/failed queue items to keep the table performant.

```sql
SELECT cron.schedule(
  'cleanup-newsletter-queue',
  '0 4 * * 0',  -- Sunday at 4:00 AM UTC
  $$
  DELETE FROM newsletter_queue
  WHERE status IN ('sent', 'failed', 'cancelled')
  AND created_at < now() - interval '30 days';
  $$
);
```

## Alternative: External Cron Service

If you prefer to use an external cron service (like cron-job.org, EasyCron, or GitHub Actions):

### GitHub Actions Example

Create `.github/workflows/newsletter-cron.yml`:

```yaml
name: Newsletter Cron Jobs

on:
  schedule:
    # Queue weekly digest - Sunday 11 PM UTC
    - cron: '0 23 * * 0'
    # Process queue - Every hour
    - cron: '0 * * * *'

jobs:
  queue-weekly:
    if: github.event.schedule == '0 23 * * 0'
    runs-on: ubuntu-latest
    steps:
      - name: Queue Weekly Digest
        run: |
          curl -X POST \
            "${{ secrets.SUPABASE_URL }}/functions/v1/queue-weekly-digest" \
            -H "Content-Type: application/json" \
            -H "X-Cron-Secret: ${{ secrets.CRON_SECRET }}" \
            -d '{"frequency": "weekly"}'

  process-queue:
    if: github.event.schedule == '0 * * * *'
    runs-on: ubuntu-latest
    steps:
      - name: Process Newsletter Queue
        run: |
          curl -X POST \
            "${{ secrets.SUPABASE_URL }}/functions/v1/process-newsletter-queue" \
            -H "Content-Type: application/json" \
            -H "X-Cron-Secret: ${{ secrets.CRON_SECRET }}"
```

## Required Secrets

Make sure these secrets are configured in Supabase:

1. **CRON_SECRET** - Used to authenticate cron job requests
2. **RESEND_API_KEY** - Your Resend API key for sending emails

To set secrets:
```bash
supabase secrets set CRON_SECRET=your-secure-random-string
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
```

## Verifying Cron Jobs

Check scheduled jobs:
```sql
SELECT * FROM cron.job;
```

Check job history:
```sql
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;
```

## Webhook Configuration

Configure Resend webhooks in the Resend dashboard:

1. Go to https://resend.com/webhooks
2. Add webhook URL: `https://your-project.supabase.co/functions/v1/handle-email-webhook`
3. Select events:
   - `email.delivered`
   - `email.opened`
   - `email.clicked`
   - `email.bounced`
   - `email.complained`

## Manual Triggers (Admin)

Admins can manually trigger functions via the admin panel or directly:

```bash
# Queue all weekly digests now
curl -X POST \
  "https://your-project.supabase.co/functions/v1/queue-weekly-digest" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -d '{"frequency": "weekly"}'

# Process queue immediately
curl -X POST \
  "https://your-project.supabase.co/functions/v1/process-newsletter-queue" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```
