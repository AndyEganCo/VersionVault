-- Use custom script to wait for actual content text, not just the container
-- ServiceNow loads the container first, then fills it with JavaScript

UPDATE software
SET scraping_strategy = '{
  "customScript": "await page.waitForFunction(() => { const text = document.body.innerText; return text.includes(\"December\") && text.includes(\"Released\") && text.length > 5000; }, {timeout: 30000});",
  "waitTime": 3000
}'::jsonb
WHERE name = 'Zoom Rooms';

-- Verify
SELECT name, scraping_strategy FROM software WHERE name = 'Zoom Rooms';
