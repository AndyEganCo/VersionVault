#!/bin/bash

echo "🚀 DEPLOYING THE REAL FIX"
echo "=========================="
echo ""
echo "Fix: Use /content API for waitForSelector (not /function API)"
echo "Commit: fee67e6"
echo ""

# Navigate to project directory
cd "$(dirname "$0")"

echo "📦 Deploying extract-software-info function..."
supabase functions deploy extract-software-info

echo ""
echo "✅ DEPLOYED!"
echo ""
echo "Next step: Update Zoom Rooms strategy in database"
echo "Run this SQL in Supabase SQL Editor:"
echo ""
echo "UPDATE software"
echo "SET scraping_strategy = '{"
echo "  \"waitForSelector\": \"article\","
echo "  \"waitTime\": 8000"
echo "}'::jsonb"
echo "WHERE name = 'Zoom Rooms';"
echo ""
echo "This will:"
echo "  ✅ Use Browserless /content API (not /function)"
echo "  ✅ Wait for 'article' selector"
echo "  ✅ Wait 8 seconds for JavaScript to load"
echo "  ✅ No custom Puppeteer script needed"
echo ""
