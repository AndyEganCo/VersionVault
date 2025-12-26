# Zoom Rooms Interactive Scraping Test Guide

**Date:** 2025-12-26
**Purpose:** Test enhanced interactive scraping for Zoom Rooms ServiceNow-based release notes page
**URL:** https://support.zoom.us/hc/en-us/articles/207005927-Release-notes-for-Zoom-Rooms

---

## 🎯 The Problem

Zoom's release notes page uses ServiceNow with Angular/React framework that loads content dynamically via JavaScript:
- Initial HTML is just a skeleton ("Loading...")
- Content loads asynchronously after page render
- Standard fetch() only gets empty shell
- Browserless basic rendering doesn't wait long enough

## 🛠️ The Solution

We've implemented **Option 2: Full Interactive Scraping** with two strategies:

### Strategy 1: Wait for Content (Passive Dynamic)
Uses `waitForSelector` to wait for dynamic content to load without clicking buttons.

### Strategy 2: Interactive Scraping (Active Dynamic)
Uses Puppeteer to click buttons, expand accordions, and execute custom JavaScript.

---

## ⚡ Important: Deploy First!

Before testing, deploy the latest function code:

```bash
cd /home/user/VersionVault
supabase functions deploy extract-software-info
```

**Latest changes:**
- ✅ Created shared `interactive-scraping.ts` module
- ✅ Implemented `generatePuppeteerScript()` for Puppeteer code generation
- ✅ Updated `fetchWithInteraction()` to use Browserless `/function` API
- ✅ Added `waitForSelector` support in `getBrowserlessOptions()`
- ✅ Integrated with `fetch-with-retry.ts` progressive fallback system

---

## 📋 Test Cases

### Test 1: Wait for Selector (Recommended for Zoom)

This strategy waits for specific content elements to appear before returning the HTML.

```bash
curl -X POST 'YOUR_SUPABASE_FUNCTION_URL/extract-software-info' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -d '{
    "name": "Zoom Rooms",
    "manufacturer": "Zoom Video Communications",
    "website": "https://zoom.us",
    "versionUrl": "https://support.zoom.us/hc/en-us/articles/207005927-Release-notes-for-Zoom-Rooms",
    "productIdentifier": "zoom-rooms",
    "scrapingStrategy": {
      "waitForSelector": "article, .article-body, .kb-article-content, [role=\"article\"]",
      "waitTime": 5000
    }
  }'
```

**What this does:**
- Waits for one of the specified selectors to appear (tries in order)
- Gives Angular/React 5 seconds to fully render
- Returns complete HTML with all release notes

### Test 2: Interactive Scraping with Button Clicks

If Zoom has collapsible sections or "Read More" buttons (use browser DevTools to inspect):

```bash
curl -X POST 'YOUR_SUPABASE_FUNCTION_URL/extract-software-info' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -d '{
    "name": "Zoom Rooms",
    "manufacturer": "Zoom Video Communications",
    "website": "https://zoom.us",
    "versionUrl": "https://support.zoom.us/hc/en-us/articles/207005927-Release-notes-for-Zoom-Rooms",
    "productIdentifier": "zoom-rooms",
    "scrapingStrategy": {
      "waitForSelector": "article",
      "releaseNotesSelectors": [
        "button:contains(\"Read More\")",
        ".expand-button",
        "[aria-expanded=\"false\"]"
      ],
      "waitTime": 3000
    }
  }'
```

### Test 3: Baseline (No Strategy)

Compare with no scraping strategy to see the difference:

```bash
curl -X POST 'YOUR_SUPABASE_FUNCTION_URL/extract-software-info' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -d '{
    "name": "Zoom Rooms",
    "manufacturer": "Zoom Video Communications",
    "website": "https://zoom.us",
    "versionUrl": "https://support.zoom.us/hc/en-us/articles/207005927-Release-notes-for-Zoom-Rooms",
    "productIdentifier": "zoom-rooms"
  }'
```

**Expected:** Will likely show `lowContentWarning` and very few/no versions extracted.

---

## 🔍 How to Inspect the Page

To find the right selectors for Zoom (or any other site):

1. **Open the page in Chrome:**
   ```
   https://support.zoom.us/hc/en-us/articles/207005927-Release-notes-for-Zoom-Rooms
   ```

2. **Open DevTools (F12 or Right-Click > Inspect)**

3. **Check for dynamic content:**
   - Look for `<article>`, `<div class="article-body">`, or similar containers
   - Right-click the content area > Inspect Element
   - Note the class names and element types

4. **Check for interactive elements:**
   - Look for "Read More", "Show More", "Expand" buttons
   - Check if version sections are collapsed by default
   - Note the button selectors

5. **Common ServiceNow selectors:**
   ```
   article
   .article-body
   .kb-article-content
   [role="article"]
   .content-container
   ```

---

## ✅ Expected Results

### Success Indicators:
- ✅ `extractionMethod: "interactive"` - Confirms interactive scraping was used
- ✅ `versions` array populated with multiple Zoom Rooms versions
- ✅ Each version has detailed `notes`
- ✅ `confidence` score 80-100%
- ✅ Content length > 10,000 characters (indicates full content, not skeleton)

### Partial Success:
- ⚠️ `extractionMethod: "browserless-extended"` - Fell back from interactive
- ⚠️ Lower confidence score (60-79%)
- ⚠️ Some versions extracted but not all

### Failure Indicators:
- ❌ `extractionMethod: "static"` - Didn't use Browserless at all
- ❌ `lowContentWarning` present
- ❌ Very low confidence (<50%)
- ❌ Empty or minimal release notes
- ❌ Content length < 2,000 characters

---

## 🐛 Debugging

### Check Extraction Method:
```bash
curl ... | jq '.extractionMethod'
```

### Check Content Length:
```bash
curl ... | jq '.versions | length'
# Should show number of versions found
```

### Check for Warnings:
```bash
curl ... | jq '.lowContentWarning, .validationNotes'
```

### View Supabase Function Logs:
1. Go to Supabase Dashboard
2. Navigate to Edge Functions
3. Select `extract-software-info`
4. Click "Logs" tab
5. Look for console output from the scraping process

---

## 📊 Progressive Fallback Chain

The system automatically tries these methods in order:

1. **Static fetch** - Fast, works for simple HTML
2. **Browserless basic** - Renders JavaScript (30s timeout)
3. **Browserless extended** - For tough sites (60s timeout, networkidle0)
4. **Interactive** - Full Puppeteer with button clicks, waits, etc.

For Zoom with a `scrapingStrategy`, it will START at Interactive and fall back if needed.

---

## 💾 Adding to Database

Once you confirm the strategy works, add it to the database:

```sql
UPDATE software
SET scraping_strategy = '{
  "waitForSelector": "article, .article-body",
  "waitTime": 5000
}'::jsonb
WHERE name = 'Zoom Rooms';
```

Or if using button clicks:

```sql
UPDATE software
SET scraping_strategy = '{
  "waitForSelector": "article",
  "releaseNotesSelectors": ["button.expand-notes", ".read-more-btn"],
  "waitTime": 3000
}'::jsonb
WHERE name = 'Zoom Rooms';
```

---

## 🎯 Cost Considerations

- **Static fetch**: Free
- **Browserless basic**: ~$0.002 per request
- **Browserless extended**: ~$0.003-0.005 per request
- **Interactive (Puppeteer)**: ~$0.005-0.01 per request

For nightly checks with ~50-100 software products using interactive scraping:
- Monthly cost: ~$15-30 (assuming 30% need interactive)

---

## 🚀 Next Steps

1. ✅ Test with Zoom Rooms (this doc)
2. ✅ Test with ATEM (should now actually click buttons!)
3. ✅ Test with other ServiceNow-based sites
4. ✅ Update database with working strategies
5. ✅ Monitor function logs for any issues
6. ✅ Document any new selectors patterns found

---

## 🔗 Related Documentation

- `docs/BOT_BLOCKING_HANDLING.md` - Bot blocker detection and mitigation
- `docs/testing/atem-scraping.md` - ATEM interactive scraping tests
- `supabase/functions/_shared/interactive-scraping.ts` - Implementation details
- `supabase/functions/_shared/bot-blocker-handler.ts` - Bot protection utilities

---

**Ready to test!** Start with Test 1 (waitForSelector) as it's the most likely to work for Zoom's ServiceNow page.
