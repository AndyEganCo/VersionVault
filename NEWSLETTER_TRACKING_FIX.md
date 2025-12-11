# Newsletter Email Tracking Fix

## Issue

Email tracking (open rate, click rate, bounces) shows **0.0%** on the Newsletter Management dashboard because the **Resend webhook URL is incorrect**.

## What's Happening

Your newsletter system has a webhook handler (`handle-email-webhook`) that processes email engagement events from Resend. The webhook is configured in Resend, but **the URL is missing `.supabase` in the domain**.

## Root Cause

**Current (INCORRECT) URL:**
```
https://idlkxmbymqduafgatdwd.co/functions/v1/handle-email-webhook
```

**Correct URL should be:**
```
https://idlkxmbymqduafgatdwd.supabase.co/functions/v1/handle-email-webhook
                              ^^^^^^^^
                              Missing this!
```

Resend is sending webhook events to the wrong domain, so they never reach your Edge Function.

---

## 🚀 Quick Fix (Do This First!)

1. Go to https://resend.com/webhooks
2. Find your webhook pointing to `idlkxmbymqduafgatdwd.co/functions/v1/handle-email-webhook`
3. **Edit the URL** to: `https://idlkxmbymqduafgatdwd.supabase.co/functions/v1/handle-email-webhook`
4. Save the webhook
5. Send a test email from `/admin/newsletter` and open it
6. Wait 1-2 minutes and refresh - open rate should now update!

---

## Detailed Fix Instructions

### Step 1: Verify Your Webhook Endpoint is Deployed

First, check that the `handle-email-webhook` function is deployed:

```bash
# From your project root
supabase functions list
```

Look for `handle-email-webhook` in the list.

If it's not there, deploy it:

```bash
supabase functions deploy handle-email-webhook
```

### Step 2: Get Your Webhook URL

Your webhook URL follows this format:

```
https://YOUR-PROJECT-REF.supabase.co/functions/v1/handle-email-webhook
```

**To find YOUR-PROJECT-REF:**

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your VersionVault project
3. Go to **Settings → API**
4. Look at your **Project URL** - it will be like `https://abcdefghijk.supabase.co`
5. Your webhook URL is: `https://abcdefghijk.supabase.co/functions/v1/handle-email-webhook`

### Step 3: Configure Resend Webhook

1. Go to [Resend Webhooks](https://resend.com/webhooks)
2. Click **Add Webhook**
3. Enter your webhook URL (from Step 2)
4. Select **ALL** of these events:
   - ✅ `email.delivered` - Tracks when email is successfully delivered
   - ✅ `email.opened` - Tracks when user opens email (updates open rate)
   - ✅ `email.clicked` - Tracks when user clicks links (updates click rate)
   - ✅ `email.bounced` - Tracks bounced emails
   - ✅ `email.complained` - Tracks spam complaints
5. Click **Add Webhook**

### Step 4: Test the Webhook

Send a test email from your admin panel:

1. Go to `/admin/newsletter`
2. Click **Send Test Email**
3. Check your inbox and **open the email**
4. Wait 1-2 minutes for webhook to process
5. Refresh the admin panel - open rate should now show data

### Step 5: Verify Tracking is Working

Run this query in your Supabase SQL Editor:

```sql
-- Check recent email logs
SELECT
  email,
  status,
  opened_at,
  clicked_at,
  bounced_at,
  created_at
FROM newsletter_logs
ORDER BY created_at DESC
LIMIT 10;
```

You should see `opened_at` timestamps being populated when users open emails.

---

## What the Webhook Does

The `handle-email-webhook` endpoint processes these events:

| Event | Action |
|-------|--------|
| **email.delivered** | Updates status to "delivered" |
| **email.opened** | Sets `opened_at` timestamp → increases open rate |
| **email.clicked** | Sets `clicked_at` timestamp → increases click rate |
| **email.bounced** | Records bounce type (soft/hard), auto-disables after 3 hard bounces |
| **email.complained** | Records spam complaint, immediately disables user notifications |

---

## Troubleshooting

### Webhook not receiving events

**Check webhook logs:**
```bash
supabase functions logs handle-email-webhook --follow
```

**Check Resend webhook status:**
1. Go to https://resend.com/webhooks
2. Click on your webhook
3. Check "Recent Deliveries" for any errors

### Still showing 0.0%

- **Make sure you have sent emails**: Stats only show for emails sent after webhook is configured
- **Wait for opens/clicks**: Users need to actually open and click emails
- **Check database**: Run the SQL query from Step 5 to verify `opened_at` is being set

### Authentication errors (401)

The webhook is public but authenticated via Resend headers. Check:
```bash
# View edge function logs for auth errors
supabase functions logs handle-email-webhook
```

---

## Security Note

The webhook endpoint:
- Uses Svix headers for verification (optional but recommended)
- Only updates records that match the `resend_id`
- Automatically disables notifications after repeated bounces
- Immediately disables notifications on spam complaints

---

## Expected Results After Fix

Once configured, your dashboard will show:

- **Open Rate**: % of emails that were opened (typically 15-30% for newsletters)
- **Click Rate**: % of emails where links were clicked (typically 2-5%)
- **Bounced**: Count of emails that bounced

The tracking data will only apply to **future emails** sent after webhook configuration.
