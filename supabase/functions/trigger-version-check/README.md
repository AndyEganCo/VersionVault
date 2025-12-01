# Automated Version Checking

This edge function enables automated nightly version checking for all software in your database.

## 🔒 Security

This function requires a secret token to prevent unauthorized access. The token is stored as a Supabase secret called `CRON_SECRET`.

## 📋 Setup Instructions

### 1. Set the CRON_SECRET

```bash
# Generate a secure random secret
CRON_SECRET=$(openssl rand -hex 32)

# Set it in Supabase
supabase secrets set CRON_SECRET="$CRON_SECRET"

# Save it for later (you'll need it for the cron job)
echo "Your CRON_SECRET: $CRON_SECRET"
```

### 2. Deploy the Function

```bash
supabase functions deploy trigger-version-check
```

### 3. Set Up Automated Scheduling

You have two options:

#### Option A: Supabase pg_cron (Recommended)

Run this SQL in your Supabase SQL Editor:

```sql
-- Enable the pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a cron job that runs every night at 2 AM UTC
SELECT cron.schedule(
  'nightly-version-check',           -- Job name
  '0 2 * * *',                        -- Cron expression (2 AM UTC every day)
  $$
  SELECT
    net.http_post(
      url:='https://YOUR_PROJECT_ID.supabase.co/functions/v1/trigger-version-check',
      headers:=jsonb_build_object(
        'Authorization', 'Bearer YOUR_CRON_SECRET',
        'Content-Type', 'application/json'
      ),
      body:='{}'::jsonb
    ) as request_id;
  $$
);
```

**Important:** Replace:
- `YOUR_PROJECT_ID` with your actual Supabase project ID
- `YOUR_CRON_SECRET` with the secret you generated in step 1

#### Option B: External Cron Service (e.g., cron-job.org, EasyCron)

1. Go to https://cron-job.org (or similar)
2. Create a new cron job with:
   - **URL:** `https://YOUR_PROJECT_ID.supabase.co/functions/v1/trigger-version-check`
   - **Schedule:** Every day at 2 AM (or your preferred time)
   - **HTTP Method:** POST
   - **Headers:**
     - `Authorization: Bearer YOUR_CRON_SECRET`
     - `Content-Type: application/json`

## 🧪 Manual Testing

Test the function manually:

```bash
# Get your Supabase URL
SUPABASE_URL="https://YOUR_PROJECT_ID.supabase.co"
CRON_SECRET="your-secret-here"

# Trigger the version check
curl -X POST \
  "${SUPABASE_URL}/functions/v1/trigger-version-check" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "totalChecked": 15,
  "successful": 14,
  "failed": 1,
  "totalVersionsAdded": 23,
  "results": [...]
}
```

## 📊 Monitoring

View logs to see what's happening:

```bash
supabase functions logs trigger-version-check --follow
```

## ⚙️ Configuration

### Change Schedule

For pg_cron, modify the cron expression:

```sql
-- Update the schedule
SELECT cron.alter_job(
  job_id:=(SELECT jobid FROM cron.job WHERE jobname = 'nightly-version-check'),
  schedule:='0 3 * * *'  -- Change to 3 AM UTC
);
```

Common cron expressions:
- `0 2 * * *` - Every day at 2 AM UTC
- `0 */6 * * *` - Every 6 hours
- `0 0 * * 0` - Every Sunday at midnight
- `0 1 * * 1-5` - Every weekday at 1 AM

### View Scheduled Jobs

```sql
SELECT * FROM cron.job WHERE jobname = 'nightly-version-check';
```

### Delete the Cron Job

```sql
SELECT cron.unschedule('nightly-version-check');
```

## 🐛 Troubleshooting

**Issue:** Cron job not running

1. Check if pg_cron is enabled:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```

2. Check job status:
   ```sql
   SELECT * FROM cron.job_run_details
   WHERE jobname = 'nightly-version-check'
   ORDER BY start_time DESC
   LIMIT 10;
   ```

**Issue:** 401 Unauthorized

- Verify CRON_SECRET is set correctly:
  ```bash
  supabase secrets list
  ```

**Issue:** Function times out

- Reduce the number of software items checked at once
- Or increase function timeout in Supabase dashboard

## 📝 How It Works

1. Cron job triggers the edge function via HTTP POST
2. Function verifies the CRON_SECRET
3. Fetches all software with `version_website` configured
4. For each software:
   - Calls `extract-software-info` edge function
   - Updates `current_version` and `release_date`
   - Saves all versions to `software_version_history`
   - Adds 2-second delay between requests
5. Returns summary with stats

## 💰 Cost Considerations

- Each software check = 1 edge function invocation
- 15 software items × 1 check/day = 15 invocations/day ≈ 450/month
- Well within Supabase free tier (500K invocations/month)

OpenAI costs:
- Each check uses GPT-4o (more expensive but better)
- ~1,000-5,000 tokens per check
- Estimated: $0.01-0.05 per software per check
- 15 software × $0.03 avg × 30 days = ~$13.50/month
