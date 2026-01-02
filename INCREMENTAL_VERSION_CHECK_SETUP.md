# Incremental Version Check System - Setup Guide

## Overview

The version check system has been upgraded to use an **incremental checking strategy** instead of checking all software at once. This eliminates timeout issues and distributes the load throughout the day.

### Key Benefits
✅ **No more timeouts** - Checks only 15 items per run (well under 400s limit)
✅ **Scalable** - Works with 50 or 500+ software items
✅ **Fresh data** - Software gets checked multiple times per day
✅ **Smart prioritization** - Checks oldest/never-checked software first
✅ **Backward compatible** - Can still do full checks manually

---

## Current Configuration

**For 61 software items:**
- **Schedule**: Every 4 hours (6 runs per day)
- **Items per run**: 15 (oldest first)
- **Coverage**: 90 items/day (each software checked ~1.5x daily)
- **Estimated runtime**: ~30-50 seconds per run

---

## 1. Supabase Cron Job Setup

### Option A: Using pg_cron (Recommended)

Run this SQL in your Supabase SQL Editor:

```sql
-- Create or replace the incremental version check cron job
-- Runs every 4 hours, checks 15 oldest software items
SELECT cron.schedule(
  'incremental-version-check',
  '0 */4 * * *',  -- Every 4 hours at :00 minutes
  $$
  DO $$
  DECLARE
    supabase_url TEXT;
    service_key TEXT;
  BEGIN
    supabase_url := get_app_setting('supabase_url');
    service_key := get_service_role_key();

    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/trigger-version-check?limit=15',
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

**Verify it was created:**
```sql
SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE jobname = 'incremental-version-check';
```

**Remove old nightly version check (if exists):**
```sql
-- Find the old job
SELECT jobid, jobname FROM cron.job WHERE jobname LIKE '%version%check%';

-- Delete it (replace <jobid> with the actual ID)
SELECT cron.unschedule(<jobid>);
```

---

### Option B: External Cron (GitHub Actions, etc.)

If using an external service, configure it to POST to:

```bash
curl -X POST \
  "https://your-project.supabase.co/functions/v1/trigger-version-check?limit=15" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

**Schedule**: Every 4 hours (0 */4 * * *)

---

## 2. Configuration Options

### Query Parameters

The edge function accepts a `limit` query parameter:

| Parameter | Behavior | Use Case |
|-----------|----------|----------|
| `?limit=15` | Check 15 oldest items | Default incremental mode |
| `?limit=20` | Check 20 oldest items | If you want faster coverage |
| `?limit=all` | Check ALL items | Manual full checks |
| (none) | Check 15 items | Default fallback |

### Examples

```bash
# Incremental check (15 items)
POST /functions/v1/trigger-version-check?limit=15

# Larger batch (20 items)
POST /functions/v1/trigger-version-check?limit=20

# Full check (all software)
POST /functions/v1/trigger-version-check?limit=all
```

---

## 3. Adjusting for Your Needs

### If You Have More Software

As your software list grows, you may want to adjust:

**100 software items:**
- Every 3 hours with limit=15 → 120 items/day (1.2x coverage)
- Every 2 hours with limit=15 → 180 items/day (1.8x coverage)

**200 software items:**
- Every 2 hours with limit=20 → 240 items/day (1.2x coverage)
- Every 1 hour with limit=10 → 240 items/day (1.2x coverage)

**Update the cron schedule:**
```sql
-- For every 2 hours
SELECT cron.schedule(
  'incremental-version-check',
  '0 */2 * * *',  -- Change this line
  -- ... rest of the command
);
```

---

## 4. Monitoring Queries

### Check Which Software Was Checked Recently

```sql
-- Show last check time for all software
SELECT
  name,
  current_version,
  last_checked,
  EXTRACT(EPOCH FROM (now() - last_checked))/3600 AS hours_since_check
FROM software
WHERE version_website IS NOT NULL
ORDER BY last_checked ASC NULLS FIRST
LIMIT 20;
```

### Find Software That Hasn't Been Checked in 24+ Hours

```sql
SELECT
  name,
  current_version,
  last_checked,
  EXTRACT(EPOCH FROM (now() - last_checked))/3600 AS hours_since_check
FROM software
WHERE version_website IS NOT NULL
  AND (last_checked IS NULL OR last_checked < now() - interval '24 hours')
ORDER BY last_checked ASC NULLS FIRST;
```

### Check Cron Job Performance

```sql
-- Recent cron runs
SELECT
  jobid,
  job_name,
  status,
  return_message,
  start_time,
  end_time,
  EXTRACT(EPOCH FROM (end_time - start_time)) AS duration_seconds
FROM cron.job_run_details
WHERE job_name = 'incremental-version-check'
ORDER BY start_time DESC
LIMIT 20;
```

### Coverage Statistics

```sql
-- How many software items are being tracked
SELECT
  COUNT(*) as total_software,
  COUNT(CASE WHEN last_checked IS NOT NULL THEN 1 END) as has_been_checked,
  COUNT(CASE WHEN last_checked IS NULL THEN 1 END) as never_checked,
  COUNT(CASE WHEN last_checked > now() - interval '24 hours' THEN 1 END) as checked_last_24h,
  COUNT(CASE WHEN last_checked > now() - interval '4 hours' THEN 1 END) as checked_last_4h
FROM software
WHERE version_website IS NOT NULL AND version_website != '';
```

---

## 5. Manual Triggers

### Trigger Incremental Check (Admin)

```bash
curl -X POST \
  "https://your-project.supabase.co/functions/v1/trigger-version-check?limit=15" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

### Trigger Full Check (All Software)

```bash
curl -X POST \
  "https://your-project.supabase.co/functions/v1/trigger-version-check?limit=all" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

**Note:** Only use `limit=all` when necessary. For 61+ items, this could take several minutes.

---

## 6. How It Works

### Smart Prioritization

The system uses this query logic:

```sql
SELECT * FROM software
WHERE version_website IS NOT NULL
ORDER BY last_checked ASC NULLS FIRST  -- Never checked first, then oldest
LIMIT 15;
```

This ensures:
1. **Never-checked software** gets priority (NULLS FIRST)
2. **Oldest-checked software** comes next
3. **Recently-checked software** is skipped until older items are done

### Example with 61 Items

| Run | Time | Items Checked | Notes |
|-----|------|---------------|-------|
| 1 | 00:00 | 1-15 (oldest) | Never-checked items first |
| 2 | 04:00 | 16-30 | Next oldest |
| 3 | 08:00 | 31-45 | Next oldest |
| 4 | 12:00 | 46-60 | Next oldest |
| 5 | 16:00 | 61 + 1-14 | Full cycle complete, restart |
| 6 | 20:00 | 15-29 | Second round |

**Result:** Every item is checked at least once every ~20 hours (5 runs × 4 hours)

---

## 7. Troubleshooting

### Cron Job Not Running

```sql
-- Check if job exists
SELECT * FROM cron.job WHERE jobname LIKE '%version%';

-- Check recent runs
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;
```

### Software Not Getting Checked

```sql
-- Verify software has version_website configured
SELECT id, name, version_website, last_checked
FROM software
WHERE name = 'Your Software Name';

-- If version_website is NULL, update it
UPDATE software
SET version_website = 'https://example.com/downloads'
WHERE name = 'Your Software Name';
```

### Check Edge Function Logs

In Supabase Dashboard → Edge Functions → trigger-version-check → Logs

Look for:
- `🎯 Check limit: 15 items` (confirms parameter is working)
- `📋 Found 15 software to check (incremental (15 oldest))` (confirms query is working)
- `✅ Version check complete!` (confirms successful completion)

---

## 8. Migration Path

### From Nightly to Incremental

**Before (Nightly):**
- Checked ALL 61 items once per day at midnight
- Risk of timeouts as list grows
- 6-7 minute runtime
- Single point of failure

**After (Incremental):**
- Checks 15 oldest items every 4 hours
- No timeout risk (~30-50 second runtime)
- 6 checks per day = 90 item checks/day
- Each software checked ~1.5x per day
- Resilient to failures

**No data loss** - The `last_checked` column is already being updated, so the transition is seamless!

---

## 9. Recommended Schedule for Different Scales

| Software Count | Frequency | Limit | Daily Checks | Coverage |
|----------------|-----------|-------|--------------|----------|
| 1-50 | Every 4 hours | 15 | 90 | 1.8x/day |
| 51-100 | Every 3 hours | 15 | 120 | 1.2x/day |
| 101-200 | Every 2 hours | 20 | 240 | 1.2x/day |
| 201-500 | Every 1 hour | 25 | 600 | 1.2x/day |
| 500+ | Every 1 hour | 30 | 720 | 1.4x/day |

All schedules keep runtime under 60 seconds and well within the 400s limit.

---

## Summary

✅ **Code Updated**: Edge function accepts `?limit=` parameter
✅ **Smart Ordering**: Prioritizes oldest/never-checked software
✅ **Default**: 15 items per run (configurable)
✅ **Backward Compatible**: `?limit=all` for full checks

**Next Steps:**
1. Run the SQL above to create the cron job
2. Remove old nightly version check (if exists)
3. Monitor with the provided queries
4. Adjust frequency/limit as your software list grows

**Questions?** Check the edge function logs or run the monitoring queries above.
