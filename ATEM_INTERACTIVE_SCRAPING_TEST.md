# ATEM Interactive Scraping Test Guide

**Date:** 2025-12-02
**Purpose:** Test Phase 3 interactive scraping with Blackmagic Design ATEM page
**URL:** https://www.blackmagicdesign.com/support/family/atem-live-production-switchers

---

## Background

The ATEM support page has "read more" buttons for each version that expand to show full release notes. This is exactly what Phase 3 interactive scraping was designed to handle.

---

## Test Strategy Variations

Try these variations to find the correct selectors for the Blackmagic Design ATEM page:

### Option 1: Generic Read More Buttons
```bash
curl -X POST 'https://idlkxmbymqduafgatdwd.supabase.co/functions/v1/extract-software-info' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkbGt4bWJ5bXFkdWFmZ2F0ZHdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI5MDQwOTUsImV4cCI6MjA0ODQ4MDA5NX0.2dS7d0-KQJLAe5N5hDmQKzQQ3JbHh56C1g3NbVWNd6s' \
  -d '{
    "name": "ATEM Mini",
    "manufacturer": "Blackmagic Design",
    "website": "https://www.blackmagicdesign.com",
    "versionUrl": "https://www.blackmagicdesign.com/support/family/atem-live-production-switchers",
    "productIdentifier": "atem-mini",
    "scrapingStrategy": {
      "releaseNotesSelectors": [
        "button:contains(\"Read More\")",
        "a:contains(\"Read More\")",
        ".read-more",
        ".btn-read-more",
        "[aria-label*=\"Read More\"]"
      ],
      "waitTime": 3000
    }
  }'
```

### Option 2: Bootstrap Collapse (if they use Bootstrap)
```bash
curl -X POST 'https://idlkxmbymqduafgatdwd.supabase.co/functions/v1/extract-software-info' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkbGt4bWJ5bXFkdWFmZ2F0ZHdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI5MDQwOTUsImV4cCI6MjA0ODQ4MDA5NX0.2dS7d0-KQJLAe5N5hDmQKzQQ3JbHh56C1g3NbVWNd6s' \
  -d '{
    "name": "ATEM Mini",
    "manufacturer": "Blackmagic Design",
    "website": "https://www.blackmagicdesign.com",
    "versionUrl": "https://www.blackmagicdesign.com/support/family/atem-live-production-switchers",
    "productIdentifier": "atem-mini",
    "scrapingStrategy": {
      "releaseNotesSelectors": [
        "[data-toggle=\"collapse\"]",
        "button.collapsed",
        ".accordion-toggle"
      ],
      "expandSelectors": [
        ".collapse",
        ".accordion-body"
      ],
      "waitForSelector": ".collapse.show",
      "waitTime": 2000
    }
  }'
```

### Option 3: Click All Expandable Elements
```bash
curl -X POST 'https://idlkxmbymqduafgatdwd.supabase.co/functions/v1/extract-software-info' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkbGt4bWJ5bXFkdWFmZ2F0ZHdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI5MDQwOTUsImV4cCI6MjA0ODQ4MDA5NX0.2dS7d0-KQJLAe5N5hDmQKzQQ3JbHh56C1g3NbVWNd6s' \
  -d '{
    "name": "ATEM Mini",
    "manufacturer": "Blackmagic Design",
    "website": "https://www.blackmagicdesign.com",
    "versionUrl": "https://www.blackmagicdesign.com/support/family/atem-live-production-switchers",
    "productIdentifier": "atem-mini",
    "scrapingStrategy": {
      "customScript": "const buttons = await page.$$('\"button, a, .clickable\"'); for (const button of buttons) { const text = await button.evaluate(el => el.textContent); if (text && (text.includes('Read') || text.includes('More') || text.includes('Show'))) { await button.click(); await page.waitForTimeout(500); } }",
      "waitTime": 5000
    }
  }'
```

### Option 4: Without Interactive Scraping (Baseline)
This will help us compare what we get WITH vs WITHOUT interactive scraping:
```bash
curl -X POST 'https://idlkxmbymqduafgatdwd.supabase.co/functions/v1/extract-software-info' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkbGt4bWJ5bXFkdWFmZ2F0ZHdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI5MDQwOTUsImV4cCI6MjA0ODQ4MDA5NX0.2dS7d0-KQJLAe5N5hDmQKzQQ3JbHh56C1g3NbVWNd6s' \
  -d '{
    "name": "ATEM Mini",
    "manufacturer": "Blackmagic Design",
    "website": "https://www.blackmagicdesign.com",
    "versionUrl": "https://www.blackmagicdesign.com/support/family/atem-live-production-switchers",
    "productIdentifier": "atem-mini"
  }'
```

---

## How to Find the Correct Selectors

If the above don't work, you can inspect the page to find the right selectors:

1. **Open the ATEM page in your browser:**
   ```
   https://www.blackmagicdesign.com/support/family/atem-live-production-switchers
   ```

2. **Open DevTools (F12 or Right-Click > Inspect)**

3. **Locate a "Read More" button:**
   - Right-click on it > Inspect Element
   - Look at the HTML structure

4. **Common patterns to look for:**
   ```html
   <!-- Button with class -->
   <button class="read-more-btn">Read More</button>

   <!-- Link with class -->
   <a class="release-notes-link" href="#details">View Details</a>

   <!-- Bootstrap collapse -->
   <button data-toggle="collapse" data-target="#version-9-5">Read More</button>

   <!-- Custom attribute -->
   <div class="expandable" data-expandable="true">
     <button class="expand-btn">Show More</button>
   </div>
   ```

5. **Update the scraping strategy with the actual selectors you find**

---

## Expected Results

### ✅ Success Indicators:
- `extractionMethod: "interactive"` - Confirms interactive scraping was used
- `releaseNotes` array populated with detailed notes
- Higher content character count compared to baseline test
- Confidence score 80-100% (ATEM has clear version numbers)

### ⚠️ Fallback Indicators:
- `extractionMethod: "browserless"` - Fell back to passive rendering
- `extractionMethod: "static"` - Fell back to basic HTML fetch
- Still works, but may have less detailed release notes

### ❌ Issues to Watch For:
- `lowContentWarning` - Page didn't load properly
- Very low confidence (<50%) - Wrong product version extracted
- Empty release notes - Buttons weren't clicked

---

## Debugging Tips

1. **Check extraction method:**
   ```bash
   curl ... | jq '.extractionMethod'
   ```

2. **Compare content length:**
   ```bash
   # With interactive scraping
   curl ... | jq '.releaseNotes | length'

   # Without interactive scraping
   curl ... | jq '.releaseNotes | length'
   ```

3. **Look for validation warnings:**
   ```bash
   curl ... | jq '.validationResult'
   ```

---

## What We're Testing

This test validates:
- ✅ Interactive scraping can click "Read More" buttons
- ✅ Full release notes are extracted (not just summaries)
- ✅ Product validation works (ATEM vs other Blackmagic products)
- ✅ Confidence scoring is accurate
- ✅ Fallback system works if interactive fails

---

## Next Steps After Testing

1. **If it works:** Great! Add the working strategy to the database
2. **If selectors are wrong:** Update with correct selectors from browser inspection
3. **If it partially works:** Compare WITH vs WITHOUT interactive to see improvement
4. **If it fails:** Check function logs in Supabase dashboard for errors

---

## Adding the Strategy to Database (After Success)

Once you find the correct selectors, you can save them to the database:

```sql
UPDATE software
SET scraping_strategy = '{
  "releaseNotesSelectors": ["ACTUAL_SELECTOR_HERE"],
  "waitTime": 3000
}'::jsonb
WHERE name = 'ATEM Mini';
```

Or add to the `scraping_patterns` table for reuse:

```sql
UPDATE scraping_patterns
SET strategy = '{
  "versionPatterns": {
    "ATEM Mini": "ATEM\\\\s+Mini.*?(\\\\d+\\\\.\\\\d+(?:\\\\.\\\\d+)?)"
  },
  "releaseNotesSelectors": ["ACTUAL_SELECTOR_HERE"],
  "waitTime": 3000
}'::jsonb
WHERE domain = 'blackmagicdesign.com';
```

---

## Important Notes

- The Browserless API has rate limits - don't spam requests
- Interactive scraping is slower (~5-10 seconds) but gets better data
- Always test WITHOUT interactive first to establish a baseline
- The function will automatically fall back if interactive fails

---

**Ready to test!** Run Option 4 first (baseline), then try Options 1-3 to see which selectors work.
