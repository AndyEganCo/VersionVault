#!/bin/bash

# Test Zoom Rooms with Interactive Scraping Strategy

# Get your Supabase details (update these if needed)
SUPABASE_URL="https://idlkxmbymqduafgatdwd.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkbGt4bWJ5bXFkdWFmZ2F0ZHdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI5MDQwOTUsImV4cCI6MjA0ODQ4MDA5NX0.2dS7d0-KQJLAe5N5hDmQKzQQ3JbHh56C1g3NbVWNd6s"

echo "🧪 Testing Zoom Rooms with Interactive Scraping..."
echo ""
echo "Test 1: With waitForSelector strategy (RECOMMENDED)"
echo "=================================================="

curl -X POST "${SUPABASE_URL}/functions/v1/extract-software-info" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ANON_KEY}" \
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
  }' | jq '.'

echo ""
echo "✅ Test complete! Check the output above."
echo ""
echo "Expected to see:"
echo "  - extractionMethod: 'interactive'"
echo "  - Multiple versions in the versions array"
echo "  - Content length > 10000 characters"
echo "  - No 'Loading...' skeleton content"
