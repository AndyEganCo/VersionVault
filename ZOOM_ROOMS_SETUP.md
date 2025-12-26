# Zoom Rooms Setup Guide

## What You Need to Do

The interactive scraping code is written and committed, but you need 2 steps to make it work:

### Step 1: Deploy the Updated Function 🚀

The new interactive scraping code needs to be deployed to your Supabase project.

**Option A: Deploy via Supabase CLI (if installed)**
```bash
cd /home/user/VersionVault
supabase functions deploy extract-software-info
```

**Option B: Deploy via GitHub Actions / CI/CD**
If your project auto-deploys from GitHub, just merge the PR and it will deploy automatically.

**Option C: Manual Deploy via Supabase Dashboard**
1. Go to https://supabase.com/dashboard/project/idlkxmbymqduafgatdwd/functions
2. Click on `extract-software-info`
3. Click "Deploy" and upload the function files

### Step 2: Add Zoom Rooms to Database with Scraping Strategy 📝

Run this SQL in your Supabase SQL Editor:

```sql
-- Copy the contents of scripts/add-zoom-rooms.sql
```

Or use the Supabase SQL Editor:
1. Go to https://supabase.com/dashboard/project/idlkxmbymqduafgatdwd/sql
2. Paste the contents of `scripts/add-zoom-rooms.sql`
3. Click "Run"

The SQL file will:
- ✅ Add Zoom Rooms to your software table (if not already there)
- ✅ Set the correct version URL
- ✅ Add the interactive scraping strategy with `waitForSelector`
- ✅ Configure it to wait 5 seconds for ServiceNow content to load

## Why This Didn't Work Before

When you clicked "check for new version", it called the function WITHOUT the `scrapingStrategy` parameter because:

1. ❌ Zoom Rooms wasn't in your database yet
2. ❌ Or it was in the database but had no `scraping_strategy` field
3. ✅ Function used default "static" fetch
4. ✅ Got ServiceNow skeleton HTML instead of actual content

## How It Works After Setup

After you complete both steps:

1. ✅ Function has interactive scraping code (Step 1 - Deploy)
2. ✅ Database has scraping strategy for Zoom Rooms (Step 2 - SQL)
3. ✅ When you click "check for new version":
   - Web UI calls function with Zoom Rooms data
   - Function reads `scraping_strategy` from database
   - Uses Browserless `/function` API with Puppeteer
   - Waits for `article` element to appear
   - Waits 5 seconds for JavaScript to fully load
   - Extracts full content with all version info
   - Returns complete version data to your UI

## Testing After Setup

Once both steps are done:

1. Go to your web app
2. Find Zoom Rooms in the software list (or add it if using the form)
3. Click "Check for New Version"
4. Should see:
   - ✅ Loading indicator
   - ✅ Multiple versions found
   - ✅ Detailed release notes
   - ✅ Current version extracted

If it still shows "Loading..." skeleton:
- Check Supabase function logs
- Verify the deployment worked
- Verify the database has the scraping_strategy field
- Check that BROWSERLESS_API_KEY is set in Supabase secrets

## Verifying the Setup

### Check Function Deployed:
```bash
curl https://idlkxmbymqduafgatdwd.supabase.co/functions/v1/extract-software-info \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"name":"test"}' | grep -o 'interactive'
# Should see 'interactive' in the response if deployment worked
```

### Check Database Entry:
```sql
SELECT name, scraping_strategy
FROM software
WHERE name = 'Zoom Rooms';
```

Should return:
```
name: Zoom Rooms
scraping_strategy: {"waitTime": 5000, "waitForSelector": "article, .article-body, .kb-article-content, [role=\"article\"]"}
```

## Cost Notes

Interactive scraping uses Browserless `/function` API which costs ~$0.005-0.01 per request.

For occasional "check for new version" button clicks: negligible cost
For nightly automated checks of ~100 software: ~$15-30/month (if 30% need interactive)

## Troubleshooting

**Problem:** Still getting "Loading..." skeleton
- ✅ Check function logs in Supabase Dashboard
- ✅ Verify BROWSERLESS_API_KEY environment variable is set
- ✅ Verify scraping_strategy is in database

**Problem:** Function timeout
- ✅ Reduce waitTime from 5000 to 3000
- ✅ Try simpler waitForSelector: just "article"

**Problem:** Bot blocking detected
- ✅ Browserless handles this with stealth mode
- ✅ Check logs for blocker detection messages
- ✅ May need to add Zoom to "known difficult domains" list

## Next Steps

After Zoom Rooms works:

1. ✅ Test with other ServiceNow-based sites
2. ✅ Update ATEM to actually click "Read More" buttons (was never working before!)
3. ✅ Add scraping strategies to other software products as needed
4. ✅ Monitor function logs and costs

---

**Files Created:**
- ✅ `supabase/functions/_shared/interactive-scraping.ts` - Core implementation
- ✅ `scripts/add-zoom-rooms.sql` - Database setup
- ✅ `docs/testing/zoom-rooms-scraping.md` - Testing guide
- ✅ This guide

**Committed to:** `claude/debug-zoom-rooms-fo53A` branch
**Ready for:** Deployment + Testing
