# Newsletter Cron Jobs Setup

This document describes how to configure cron jobs for the VersionVault newsletter system.

## Automated Setup (Recommended)

The newsletter cron jobs are now **automatically created** by database migrations. You only need to configure your Supabase URL and service role key.

### Quick Setup Steps

1. **Run the migrations** (if not already done):
   ```bash
   supabase db push
   ```

2. **Configure your Supabase URL and Service Role Key**:

   Option A - **Using SQL Editor** (Supabase Dashboard):
   ```sql
   -- Update Supabase URL
   UPDATE app_settings
   SET value = 'https://your-project-ref.supabase.co'
   WHERE key = 'supabase_url';

   -- Store service role key in Vault (RECOMMENDED - most secure)
   SELECT vault.create_secret(
     'eyJhbGc...your-service-role-key',
     'service_role_key',
     'Service role key for cron job authentication'
   );

   -- OR store in app_settings (LESS SECURE)
   INSERT INTO app_settings (key, value, description)
   VALUES (
     'service_role_key',
     'eyJhbGc...your-service-role-key',
     'Service role key for edge function authentication'
   )
   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
   ```

   Option B - **Edit migration file** `20241210000002_update_app_settings_values.sql`:
   - Replace the placeholder values
   - Run: `supabase db push`

3. **Verify the cron jobs were created**:
   ```sql
   -- Check all scheduled jobs
   SELECT jobid, jobname, schedule, command
   FROM cron.job
   WHERE jobname LIKE '%newsletter%' OR jobname LIKE '%digest%';

   -- Check recent job runs
   SELECT jobid, job_name, status, return_message, start_time
   FROM cron.job_run_details
   ORDER BY start_time DESC
   LIMIT 20;
   ```

### What Gets Created Automatically

The migrations create these 5 cron jobs:

1. **queue-weekly-digest** - Runs Sunday at 11 PM UTC
2. **queue-daily-digest** - Runs every day at 11 PM UTC
3. **queue-monthly-digest** - Runs 1st of month at 11 PM UTC
4. **process-newsletter-queue** - Runs every hour
5. **cleanup-newsletter-queue** - Runs Sunday at 4 AM UTC

## Manual Cron Job Setup (Legacy)

> ⚠️ **Not Recommended**: The manual setup below is kept for reference only. Use the automated migration-based setup above instead.

<details>
<summary>Click to expand manual setup instructions</summary>

### 1. Queue Weekly Digest (Sunday Night)

```sql
SELECT cron.schedule(
  'queue-weekly-digest',
  '0 23 * * 0',
  $$
  DO $$
  DECLARE
    supabase_url TEXT;
    service_key TEXT;
  BEGIN
    supabase_url := get_app_setting('supabase_url');
    service_key := get_service_role_key();

    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/queue-weekly-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object('frequency', 'weekly')
    );
  END $$;
  $$
);
```

### 2. Queue Daily Digest

```sql
SELECT cron.schedule(
  'queue-daily-digest',
  '0 23 * * *',
  $$
  DO $$
  DECLARE
    supabase_url TEXT;
    service_key TEXT;
  BEGIN
    supabase_url := get_app_setting('supabase_url');
    service_key := get_service_role_key();

    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/queue-weekly-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object('frequency', 'daily')
    );
  END $$;
  $$
);
```

### 3. Queue Monthly Digest

```sql
SELECT cron.schedule(
  'queue-monthly-digest',
  '0 23 1 * *',
  $$
  DO $$
  DECLARE
    supabase_url TEXT;
    service_key TEXT;
  BEGIN
    supabase_url := get_app_setting('supabase_url');
    service_key := get_service_role_key();

    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/queue-weekly-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object('frequency', 'monthly')
    );
  END $$;
  $$
);
```

### 4. Process Newsletter Queue

```sql
SELECT cron.schedule(
  'process-newsletter-queue',
  '0 * * * *',
  $$
  DO $$
  DECLARE
    supabase_url TEXT;
    service_key TEXT;
  BEGIN
    supabase_url := get_app_setting('supabase_url');
    service_key := get_service_role_key();

    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/process-newsletter-queue',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := '{}'::jsonb
    );
  END $$;
  $$
);
```

### 5. Queue Cleanup

```sql
SELECT cron.schedule(
  'cleanup-newsletter-queue',
  '0 4 * * 0',
  $$
  DELETE FROM newsletter_queue
  WHERE status IN ('sent', 'failed', 'cancelled')
  AND created_at < now() - interval '30 days';
  $$
);
```

</details>

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
