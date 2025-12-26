-- FIXED Zoom Rooms Strategy
-- Uses simple waitForSelector instead of customScript
-- This uses Browserless /content API (reliable) not /function API (was causing 500 errors)

UPDATE software
SET scraping_strategy = '{
  "waitForSelector": "article",
  "waitTime": 8000
}'::jsonb
WHERE name = 'Zoom Rooms';

-- Verify the update
SELECT
  name,
  scraping_strategy,
  version_website
FROM software
WHERE name = 'Zoom Rooms';

-- WHAT THIS DOES:
-- 1. Waits for <article> element to appear on the page (ServiceNow loads this)
-- 2. Waits additional 8 seconds for JavaScript to populate the content
-- 3. Returns the full HTML with all release notes
--
-- USES: Browserless /content API
--   - Simple POST to /content endpoint with waitForSelector option
--   - Native support, no Puppeteer script needed
--   - More reliable than /function API
--
-- WHY NOT customScript?
--   - customScript requires /function API with Puppeteer
--   - Was causing 500 errors from Browserless
--   - Waiting for specific text ("December", "Released") is too brittle
--   - Simple selector waiting is sufficient for ServiceNow pages
