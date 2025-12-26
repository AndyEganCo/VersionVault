-- Try longer wait time and more specific selectors for ServiceNow

UPDATE software
SET scraping_strategy = '{
  "waitForSelector": "article, .kb-article-text, .kb_article_text, [data-article-body], .article-content",
  "waitTime": 10000
}'::jsonb
WHERE name = 'Zoom Rooms';

-- Verify
SELECT name, scraping_strategy FROM software WHERE name = 'Zoom Rooms';
