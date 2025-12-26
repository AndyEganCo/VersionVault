# Zoom Rooms Fix - Root Cause & Solution

## What Was Broken

**Symptom:** Getting 500 errors from Browserless when trying to scrape Zoom Rooms release notes.

**Root Cause:** I incorrectly routed `waitForSelector` strategies to the Browserless `/function` API, which requires custom Puppeteer scripts. This was wrong because:

1. The `/content` API **already supports `waitForSelector` natively**
2. My Puppeteer script had syntax errors (comma-separated selectors)
3. Browserless crashed trying to execute the malformed script → 500 error

## The Bad Code (What I Did Wrong)

```typescript
// extract-software-info/index.ts - LINE 375 (BEFORE)
if (strategy && (strategy.releaseNotesSelectors || strategy.expandSelectors || strategy.customScript || strategy.waitForSelector)) {
  startingMethod = 'interactive'  // ❌ WRONG! Sends to /function API
}
```

This sent ANY strategy with `waitForSelector` to the `/function` API.

## The Fix

```typescript
// extract-software-info/index.ts - LINE 375 (AFTER)
if (strategy && (strategy.releaseNotesSelectors || strategy.expandSelectors || strategy.customScript)) {
  startingMethod = 'interactive'  // Only for complex Puppeteer scripting
} else if (strategy && strategy.waitForSelector) {
  startingMethod = 'browserless-extended'  // ✅ Uses /content API
}
```

Now `waitForSelector` uses the simpler `/content` API that has native support.

## Files Changed (Commit: fee67e6)

1. **`extract-software-info/index.ts`**
   - Removed `waitForSelector` from interactive trigger
   - Added separate branch for `waitForSelector` → `browserless-extended`

2. **`fetch-with-retry.ts`**
   - Pass `waitForSelector` through to `fetchBrowserless()`
   - Gets sent to Browserless `/content` API options

3. **`bot-blocker-handler.ts`**
   - Handle comma-separated selectors (take first one)
   - `/content` API only supports single selector

## API Comparison

### Browserless /content API (Now Using This ✅)
```bash
POST https://chrome.browserless.io/content?token=XXX&stealth=true
{
  "url": "https://support.zoom.us/...",
  "waitForSelector": {
    "selector": "article",
    "timeout": 40000
  },
  "gotoOptions": {
    "waitUntil": "networkidle2",
    "timeout": 60000
  }
}
```
- Simple, reliable
- Native selector support
- No script needed

### Browserless /function API (Was Using This ❌)
```bash
POST https://chrome.browserless.io/function
{
  "code": "export default async function({page}) { ... custom script ... }"
}
```
- Complex, error-prone
- Requires valid Puppeteer JavaScript
- Our script had syntax errors → 500

## Deployment Steps

### 1. Deploy the Fixed Function

```bash
cd /home/user/VersionVault
supabase functions deploy extract-software-info
```

Or run:
```bash
./DEPLOY_NOW.sh
```

### 2. Update Zoom Rooms Strategy

Run this SQL in Supabase SQL Editor:

```sql
UPDATE software
SET scraping_strategy = '{
  "waitForSelector": "article",
  "waitTime": 8000
}'::jsonb
WHERE name = 'Zoom Rooms';
```

Or use the SQL file:
```bash
# Copy contents of scripts/zoom-rooms-FIXED-strategy.sql
# Paste into Supabase SQL Editor and run
```

### 3. Test

Go to your web app and click "Check for New Version" on Zoom Rooms.

**Expected:**
- ✅ No more 500 errors
- ✅ Uses `/content` API (check logs: "Fetching with Browserless (extended)")
- ✅ Waits for article element
- ✅ Extracts version information

## Why This Should Work Now

1. **No more `/function` API errors**
   - We're using `/content` which is simpler and more reliable

2. **Native selector support**
   - Browserless `/content` handles `waitForSelector` internally
   - No custom script to break

3. **Simpler strategy**
   - Just wait for `article` element + 8 seconds
   - No checking for specific text like "December"
   - More robust across different months/page updates

## What I Learned

1. **Use existing features first** - The `/content` API already supported what we needed
2. **Don't over-engineer** - Custom Puppeteer scripts should be last resort
3. **Test assumptions** - I assumed we needed `/function` when `/content` was sufficient
4. **Read the logs carefully** - The 500 error was a clear sign the API choice was wrong

## Files to Review

- ✅ `supabase/functions/extract-software-info/index.ts:375-384`
- ✅ `supabase/functions/_shared/fetch-with-retry.ts:70-169`
- ✅ `supabase/functions/_shared/bot-blocker-handler.ts:338-347`
- 📄 `scripts/zoom-rooms-FIXED-strategy.sql` (run this in database)

---

**Commit:** fee67e6
**Branch:** claude/debug-zoom-rooms-fo53A
**Ready to deploy:** Yes
