-- Add Crawler4AI entry back
INSERT INTO crawler_status (name, status, success_rate) 
VALUES ('Crawler4AI', 'idle', 0);

-- Update Puppeteer entry
UPDATE crawler_status 
SET status = 'idle', 
    success_rate = 0, 
    error = NULL 
WHERE name = 'Puppeteer';