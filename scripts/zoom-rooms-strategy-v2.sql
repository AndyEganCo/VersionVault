-- Updated Zoom Rooms Strategy - More Reliable
-- Instead of waiting for specific text content, wait for the article element
-- and give JavaScript time to load

UPDATE software
SET scraping_strategy = '{
  "waitForSelector": "article, .article-body, main[role=article], [role=main]",
  "waitTime": 8000
}'::jsonb
WHERE name = 'Zoom Rooms';

-- Verify
SELECT name, scraping_strategy FROM software WHERE name = 'Zoom Rooms';

-- REASONING:
-- The previous customScript waited for specific text ("December", "Released", length > 5000)
-- which might timeout if:
--   1. Current month isn't December
--   2. Page structure changes
--   3. Content loads differently
--
-- This new strategy:
--   1. Waits for the article/main content element to appear
--   2. Waits 8 seconds for JavaScript to populate it
--   3. No text content requirements - more reliable
--   4. Returns HTML which gets parsed normally
