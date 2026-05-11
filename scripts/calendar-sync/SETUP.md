# Smartsheet → Google Calendar Sync Setup

Replaces the n8n cloud workflows with free GitHub Actions cron jobs.
Two workflows run on the same schedules as before:
- **Sprint Schedule** — every 2 hours, syncs all rows
- **Travel Schedule** — every 6 hours, syncs rows containing "punch list" or "commissioning"

---

## Step 1 — Google Cloud: Create a Service Account (5 minutes)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or use an existing one) — name it anything, e.g. `calendar-sync`
3. In the left menu go to **APIs & Services → Library**
4. Search for **Google Calendar API** and click **Enable**
5. Go to **APIs & Services → Credentials**
6. Click **+ Create Credentials → Service account**
   - Name: `calendar-sync` (or anything)
   - Click **Create and continue**, skip the optional role/user steps, click **Done**
7. Click on the service account you just created
8. Go to the **Keys** tab → **Add Key → Create new key → JSON**
9. Download the JSON file — keep it safe, you'll paste it into GitHub Secrets

---

## Step 2 — Share your Google Calendars with the service account

The downloaded JSON has a field `"client_email"` — it looks like:
`calendar-sync@your-project.iam.gserviceaccount.com`

For **each** of the two Google Calendars:
1. Open Google Calendar in a browser
2. Click the three dots next to the calendar → **Settings and sharing**
3. Scroll to **Share with specific people or groups**
4. Add the `client_email` address from the JSON with **Make changes to events** permission
5. Click **Send**

Calendars to share:
- Sprint: `c_71bc8d4c769a443aaa4d3406b129b4f3574bcdddf5fe559b2ff138f97313b100@group.calendar.google.com`
- Travel: `c_ccc7a9944cec8fcfed17622b5a15c0974394f074f6a17fd93fc182cfd752d35e@group.calendar.google.com`

---

## Step 3 — Add GitHub Secrets

In your GitHub repo go to **Settings → Secrets and variables → Actions → New repository secret**

Add these two secrets:

| Secret name | Value |
|---|---|
| `SMARTSHEET_BEARER_TOKEN` | Your Smartsheet API bearer token (same one used in n8n) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | The entire contents of the JSON file you downloaded in Step 1 |

To get your Smartsheet token: Smartsheet → Account → Personal Settings → API Access → Generate New Access Token

---

## Step 4 — Test it manually

Once secrets are set, go to **Actions** tab in GitHub → pick either workflow → click **Run workflow**.
Check the logs to confirm it runs without errors.

---

## How it works

```
GitHub Actions (cron)
  → fetch Smartsheet report (Bearer token)
  → fetch existing Google Calendar events (service account)
  → diff: compute creates / deletes / updates
  → delete stale events
  → create new/changed events
```

Events are tracked by embedding `Smartsheet Row ID: <id>` in the calendar event description. This is the same approach the n8n workflows used, so if you had events already created by n8n they will be recognized and not duplicated.

---

## Turning off n8n workflows

Once you've confirmed GitHub Actions is working correctly, deactivate or delete the n8n workflows to avoid double-writes.
