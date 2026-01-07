# vMix Forum Navigation Fix

## Problem
The vMix forum (https://forums.vmix.com/posts/t33735-vMix-29-Changelog) posts newest content at the bottom of the page with lazy loading. When scraping the page:
- Only the initial posts load in the HTML
- JavaScript dynamically loads more posts as you scroll
- The `findlastpost` URL parameter should jump to the last post, but it can't because the post isn't loaded yet
- Result: The scraper only sees old posts, never reaching the newest releases

## Solution
Use **Interactive Scraping** with Puppeteer to auto-scroll the page until all content is loaded.

### How It Works
1. Load the forum page in a headless Chrome browser (via Browserless)
2. Execute custom JavaScript that:
   - Scrolls to the bottom of the page
   - Waits for new content to load (2 seconds)
   - Checks if the page height changed
   - Repeats until no more content loads (max 20 scrolls)
3. Return the full HTML with all posts loaded
4. Parse and extract version information normally

## Changes Made

### 1. SQL Script (`scripts/fix-vmix-forum-navigation.sql`)
Created a SQL script to configure vMix with:
- `source_type`: `'forum'` - Indicates this is a forum-based source
- `forum_config`: phpBB forum configuration
- `scraping_strategy`: Auto-scroll configuration with custom JavaScript

To apply: Run this SQL script against your Supabase database.

### 2. Backend Integration
Modified the following files to support scraping_strategy for forums:

#### `supabase/functions/trigger-version-check/index.ts`
- Added `scraping_strategy` to the software SELECT query (line 133)
- Pass `scraping_strategy` to extract-software-info function (line 200)

#### `supabase/functions/_shared/forum-parser.ts`
- Added `ScrapingStrategy` import
- Updated `fetchForumContent()` to accept `scrapingStrategy` parameter
- Updated `fetchForumIndex()` to use `fetchWithInteraction()` when strategy provided
- Updated `fetchTopicContent()` to pass strategy through the chain

#### `supabase/functions/extract-software-info/index.ts`
- Pass `scrapingStrategy` to `fetchForumContent()` when source type is 'forum'

## Testing

To test the fix:

1. **Apply the SQL configuration:**
   ```bash
   # Run the SQL script against your database
   psql $DATABASE_URL -f scripts/fix-vmix-forum-navigation.sql
   ```

2. **Verify the configuration:**
   ```sql
   SELECT name, source_type, forum_config, scraping_strategy
   FROM software
   WHERE name ILIKE '%vmix%';
   ```

3. **Trigger a manual version check:**
   - Use the admin panel to manually check vMix for updates
   - OR call the extract-software-info edge function directly
   - Check the logs for:
     - `🎭 Using interactive scraping with custom strategy`
     - `🔄 Starting auto-scroll to load all posts...`
     - Scroll progress logs showing increasing page heights

4. **Verify results:**
   - Check that the latest vMix versions are detected
   - Ensure release notes are extracted from the newest posts
   - Confirm that older versions are also captured

## Rollback

If needed, remove the scraping strategy to fall back to regular fetching:

```sql
UPDATE software
SET scraping_strategy = NULL
WHERE name ILIKE '%vmix%';
```

## Notes

- The auto-scroll is limited to 20 scrolls to prevent infinite loops
- Each scroll waits 2 seconds for content to load
- Total execution time: ~40-60 seconds for a full scroll
- This uses Browserless credits (requires BROWSERLESS_API_KEY)
- The strategy can be reused for other forums with similar lazy-loading behavior

## Related Files

- `scripts/fix-vmix-forum-navigation.sql` - Configuration script
- `supabase/functions/_shared/interactive-scraping.ts` - Puppeteer script generator
- `supabase/functions/_shared/forum-parser.ts` - Forum content fetcher
- `supabase/functions/trigger-version-check/index.ts` - Automated version checker
- `supabase/functions/extract-software-info/index.ts` - Main extraction function
