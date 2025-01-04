-- Update Puppeteer entry
UPDATE crawler_status 
SET status = 'idle', 
    success_rate = 0, 
    error = NULL 
WHERE name = 'Puppeteer';