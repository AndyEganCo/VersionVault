# ChatGPT Version Audit Setup

This document contains the SQL commands and cron job configuration needed to set up the ChatGPT version audit system.

## Overview

The ChatGPT version audit system provides a **safety net** to catch software versions that may have been missed by the regular scraping system. It runs every 3 days and:

1. Sends all software names + current versions to ChatGPT
2. ChatGPT identifies potentially outdated software
3. Flags are created in the database
4. Flagged software is prioritized in the next incremental version check
5. Regular scraper verifies and extracts full details
6. Admins receive email notifications of any flagged items

## Step 1: Run Database Migration

The migration file has already been created at:
```
supabase/migrations/20260103000000_version_audit_system.sql
```

**Apply the migration:**

```bash
# Using Supabase CLI (recommended)
supabase db push

# OR manually via Supabase Dashboard:
# 1. Go to SQL Editor
# 2. Copy/paste the migration file contents
# 3. Run the query
```

This creates:
- `version_audit_flags` table - Tracks flagged software
- `version_audit_runs` table - Tracks audit execution history
- `get_audit_flagged_software_ids()` function - Returns unresolved flag IDs
- Appropriate RLS policies and indexes

## Step 2: Deploy Edge Functions

Deploy the new ChatGPT audit function:

```bash
# Deploy the new function
supabase functions deploy chatgpt-version-audit

# Redeploy the updated trigger-version-check function
supabase functions deploy trigger-version-check
```

## Step 3: Configure Environment Variables

Ensure these environment variables are set in your Supabase project:

```bash
# Required for ChatGPT audit
OPENAI_API_KEY=sk-...          # Your OpenAI API key
RESEND_API_KEY=re_...          # Your Resend API key (for admin emails)
CRON_SECRET=...                # Secret for cron authentication
SUPABASE_URL=...               # Your Supabase URL
SUPABASE_SERVICE_ROLE_KEY=...  # Service role key
```

**Set via Supabase Dashboard:**
1. Go to Project Settings > Edge Functions
2. Add/verify each secret
3. Secrets are automatically available to all functions

## Step 4: Set Up Cron Job

### Option A: Using Supabase Dashboard (Recommended)

1. Go to **Database > Cron Jobs** (if available in your dashboard)
2. Click "New Cron Job"
3. Configure:
   - **Name**: `chatgpt-version-audit`
   - **Schedule**: `0 0 */3 * *` (Every 3 days at midnight)
   - **Command Type**: HTTP Request
   - **Method**: POST
   - **URL**: `https://YOUR-PROJECT.supabase.co/functions/v1/chatgpt-version-audit`
   - **Headers**:
     ```
     Authorization: Bearer YOUR_CRON_SECRET
     Content-Type: application/json
     ```
   - **Body**: `{}`
4. Save and enable

### Option B: Using SQL (pg_cron extension)

Run this SQL in the Supabase SQL Editor:

```sql
-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create the cron job for ChatGPT version audit
-- Runs every 3 days at midnight UTC
SELECT cron.schedule(
  'chatgpt-version-audit',           -- Job name
  '0 0 */3 * *',                      -- Schedule: Every 3 days at 00:00
  $$
  SELECT
    net.http_post(
      url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/chatgpt-version-audit',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_CRON_SECRET_HERE'
      ),
      body := jsonb_build_object()
    ) as request_id;
  $$
);
```

**IMPORTANT:** Replace:
- `YOUR-PROJECT-REF` with your actual Supabase project reference
- `YOUR_CRON_SECRET_HERE` with your actual CRON_SECRET value

### Verify Cron Job

Check that the job was created:

```sql
-- View all cron jobs
SELECT * FROM cron.job WHERE jobname = 'chatgpt-version-audit';

-- View recent execution history
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'chatgpt-version-audit')
ORDER BY start_time DESC
LIMIT 10;
```

## Step 5: Test the Audit (Optional)

Manually trigger an audit run to test:

```bash
# Using curl
curl -X POST \
  https://YOUR-PROJECT.supabase.co/functions/v1/chatgpt-version-audit \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'

# OR using the Supabase CLI
supabase functions invoke chatgpt-version-audit \
  --body '{}' \
  --method POST
```

Check the results:

```sql
-- View audit runs
SELECT * FROM version_audit_runs ORDER BY created_at DESC LIMIT 5;

-- View flagged software
SELECT
  vaf.*,
  s.name as software_name
FROM version_audit_flags vaf
JOIN software s ON s.id = vaf.software_id
WHERE vaf.resolved_at IS NULL
ORDER BY vaf.flagged_at DESC;
```

## How It Works

### Workflow

```
┌──────────────────────────────────────┐
│   EVERY 3 DAYS (Midnight UTC)        │
│   ├─ chatgpt-version-audit runs      │
│   ├─ Queries all software            │
│   ├─ Sends to ChatGPT (GPT-4o)       │
│   ├─ Creates flags for outdated      │
│   └─ Sends admin email notification  │
└──────────────────────────────────────┘
                ↓
┌──────────────────────────────────────┐
│   EVERY 4 HOURS                      │
│   ├─ trigger-version-check runs      │
│   ├─ Prioritizes flagged software    │
│   ├─ Runs full web scraping          │
│   ├─ Extracts detailed notes         │
│   └─ Marks flags as resolved         │
└──────────────────────────────────────┘
```

### Priority Order (trigger-version-check)

When selecting software to check:
1. **Audit-flagged items** (from ChatGPT, unresolved, last 7 days)
2. **Never checked items** (last_checked IS NULL)
3. **Oldest checked items** (last_checked ASC)

This ensures flagged items are verified ASAP while maintaining regular incremental checks.

## Monitoring

### View Audit History

```sql
-- Recent audit runs with summary
SELECT
  id,
  created_at,
  total_software_checked,
  flags_created,
  chatgpt_model,
  execution_time_ms,
  admin_notified
FROM version_audit_runs
ORDER BY created_at DESC
LIMIT 10;
```

### View Active Flags

```sql
-- Unresolved flags (awaiting verification)
SELECT
  s.name,
  vaf.current_version,
  vaf.suggested_version,
  vaf.confidence,
  vaf.chatgpt_reasoning,
  vaf.flagged_at
FROM version_audit_flags vaf
JOIN software s ON s.id = vaf.software_id
WHERE vaf.resolved_at IS NULL
ORDER BY
  CASE vaf.confidence
    WHEN 'high' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'low' THEN 3
  END,
  vaf.flagged_at DESC;
```

### View Verification Results

```sql
-- Recently resolved flags (confirmed vs false positives)
SELECT
  s.name,
  vaf.current_version,
  vaf.suggested_version,
  vaf.verification_result,
  vaf.flagged_at,
  vaf.resolved_at,
  EXTRACT(EPOCH FROM (vaf.resolved_at - vaf.flagged_at))/3600 as hours_to_resolve
FROM version_audit_flags vaf
JOIN software s ON s.id = vaf.software_id
WHERE vaf.resolved_at IS NOT NULL
ORDER BY vaf.resolved_at DESC
LIMIT 20;
```

## Cost Estimate

**ChatGPT Audit Cost:**
- Model: GPT-4o
- Frequency: Every 3 days (~10 times/month)
- Input: ~61 software items × 30 tokens = ~2,000 tokens
- Output: ~500 tokens (JSON response)
- Cost per run: ~$0.015 (GPT-4o pricing)
- **Monthly cost: ~$0.15**

**Total System Cost:**
- Incremental checks: ~$13.50/month (existing)
- ChatGPT audit: ~$0.15/month (new)
- **Combined: ~$13.65/month**

The audit adds negligible cost while significantly improving version detection reliability.

## Troubleshooting

### Cron job not running?

```sql
-- Check cron job status
SELECT * FROM cron.job WHERE jobname = 'chatgpt-version-audit';

-- Check for errors in recent runs
SELECT
  jobid,
  runid,
  start_time,
  end_time,
  status,
  return_message
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'chatgpt-version-audit')
ORDER BY start_time DESC
LIMIT 5;
```

### Audit function errors?

Check logs in Supabase Dashboard:
1. Go to **Edge Functions > chatgpt-version-audit**
2. View **Invocations** tab
3. Check error messages and stack traces

Common issues:
- Missing `OPENAI_API_KEY` - Set in project secrets
- Invalid ChatGPT response - Check model availability (GPT-4o)
- Email failures - Verify `RESEND_API_KEY` and admin email addresses

### No flags created?

This is actually good! It means ChatGPT believes all software is up-to-date based on its knowledge. The system will still create an audit run record:

```sql
-- Check audit runs even with zero flags
SELECT * FROM version_audit_runs
WHERE flags_created = 0
ORDER BY created_at DESC
LIMIT 5;
```

### Manually mark flag as false positive

If ChatGPT incorrectly flagged software:

```sql
UPDATE version_audit_flags
SET
  resolved_at = NOW(),
  verification_result = 'false_positive',
  resolved_by = auth.uid()  -- Your admin user ID
WHERE software_id = 'SOFTWARE_UUID_HERE'
  AND resolved_at IS NULL;
```

## Customization

### Change audit frequency

Edit the cron schedule:

```sql
-- Every 2 days at 3 AM
SELECT cron.alter_job('chatgpt-version-audit', schedule := '0 3 */2 * *');

-- Every week on Sunday at midnight
SELECT cron.alter_job('chatgpt-version-audit', schedule := '0 0 * * 0');

-- Every day at 2 AM
SELECT cron.alter_job('chatgpt-version-audit', schedule := '0 2 * * *');
```

### Use different ChatGPT model

Edit `/supabase/functions/chatgpt-version-audit/index.ts`:

```typescript
// Line ~126
const chatGPTModel = 'gpt-4o' // Change to 'o1', 'gpt-5', etc.
```

Then redeploy:
```bash
supabase functions deploy chatgpt-version-audit
```

### Adjust flag retention period

Edit the `get_audit_flagged_software_ids()` function in the migration:

```sql
-- Currently: flags from last 7 days
WHERE flagged_at > NOW() - INTERVAL '7 days'

-- Change to 14 days:
WHERE flagged_at > NOW() - INTERVAL '14 days'

-- Change to 3 days:
WHERE flagged_at > NOW() - INTERVAL '3 days'
```

## Next Steps

1. ✅ Run the migration
2. ✅ Deploy edge functions
3. ✅ Configure environment variables
4. ✅ Set up cron job
5. ✅ Test manually (optional)
6. 📊 Monitor first few audit runs
7. 📈 Check verification accuracy after 1-2 weeks

The system is designed to be **low-maintenance** and **self-healing**. ChatGPT provides hints, the regular scraper does the heavy lifting, and admins are notified only when action might be needed.
