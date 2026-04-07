# Freemium Launch Runbook

Step-by-step to flip the freemium launch on. Run the **newsletter today**,
then schedule the cron so the first enforcement run fires **tomorrow**.

## Prereqs

- `SUPABASE_PROJECT_ID` — your project ref (e.g. `abcdefgh`)
- `CRON_SECRET` — already set as a Supabase secret (same one used by
  `trigger-version-check`). If not set:
  ```bash
  supabase secrets set CRON_SECRET="$(openssl rand -hex 32)"
  ```

## 1. Apply the migration (today)

Adds `launch_gift` as a valid `premium_grants` source and inserts one
`premium_grants` row per existing user with `expires_at = NOW() + 30 days`.
The `trigger_update_granted_until` trigger fires per row and syncs
`premium_users.granted_until` automatically.

```bash
supabase db push
# or in the Supabase SQL editor, paste the contents of
# supabase/migrations/20260407000000_launch_free_pro_month.sql
```

Verify:

```sql
SELECT COUNT(*) FROM premium_grants WHERE source = 'launch_gift';
SELECT COUNT(*) FROM premium_users WHERE granted_until > NOW();
```

Both counts should match the number of non-legacy users.

## 2. Deploy the updated edge functions (today)

The throttle helper + enforce-grace-period refactor. Deploy everything that
imports the shared throttle to be safe:

```bash
supabase functions deploy enforce-grace-period
supabase functions deploy process-referral
supabase functions deploy send-custom-newsletter
supabase functions deploy process-newsletter-queue
supabase functions deploy send-user-request-digest
supabase functions deploy send-admin-request-digest
supabase functions deploy chatgpt-version-audit
```

## 3. Send the launch newsletter (today)

Subject and body live in `scripts/launch-newsletter.md` +
`scripts/launch-newsletter-body.html`.

1. **Test first**: open `/admin/custom-newsletter`, paste the subject and
   HTML body, set recipients to `test`, send to your own address, verify it
   renders correctly on mobile and desktop.
2. **Send to all**: change recipients to `all`, click send.

The `send-custom-newsletter` function now uses the shared 600ms throttle,
so the send will take roughly `recipients * 0.6` seconds and stay well
under Resend's 2 req/sec limit.

## 4. Schedule the daily enforcement cron (run this once, today)

Paste this into the Supabase SQL editor. Replace `YOUR_PROJECT_ID` and
`YOUR_CRON_SECRET`. The `0 14 * * *` schedule fires at 14:00 UTC, which is
after today's 14:00 UTC has already passed (today is 20:18 UTC) — so the
**first run will be tomorrow at 14:00 UTC**, giving users the full day to
read the newsletter without a second email.

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'daily-enforce-grace-period',
  '0 14 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/enforce-grace-period',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_CRON_SECRET',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

Verify the schedule:

```sql
SELECT jobname, schedule, active FROM cron.job
 WHERE jobname = 'daily-enforce-grace-period';
```

## 5. Monitor (over the next 30 days)

- Day 1 (tomorrow): cron fires, but should be a no-op for almost everyone
  because every user's `granted_until` is ~30 days out. Only users who were
  already within the winddown window (finishing Stripe subs, etc.) will
  receive the `subscription_ending` / `subscription_ended` email.
- Day 15: the midpoint reminder fires for users whose launch_gift is
  halfway through.
- Day 27: 3-day final warning.
- Day 30: auto-untrack if still >5 apps, expired email sent.

Check `cron.job_run_details` for failures:

```sql
SELECT start_time, status, return_message
  FROM cron.job_run_details
 WHERE jobname = 'daily-enforce-grace-period'
 ORDER BY start_time DESC
 LIMIT 20;
```

Check Resend logs at https://resend.com/emails for bounces / throttling.

## Rollback

If the cron needs to be stopped:

```sql
SELECT cron.unschedule('daily-enforce-grace-period');
```

The `launch_gift` grants stay in `premium_grants` and will expire naturally.
To revoke them early:

```sql
DELETE FROM premium_grants WHERE source = 'launch_gift';
-- The trigger will re-sync granted_until for each affected user automatically.
```
