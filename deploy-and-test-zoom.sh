#!/bin/bash

set -e  # Exit on error

echo "🚀 Deploying Interactive Scraping Updates..."
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Change to project directory
cd "$SCRIPT_DIR"

echo "📁 Working directory: $SCRIPT_DIR"
echo ""

# Deploy the function
echo "📦 Deploying extract-software-info function..."
supabase functions deploy extract-software-info

echo ""
echo "✅ Deployment complete!"
echo ""
echo "⏳ Waiting 5 seconds for deployment to propagate..."
sleep 5

echo ""
echo "🧪 Testing Zoom Rooms with Interactive Scraping..."
echo ""
echo "Test Configuration:"
echo "  - URL: https://support.zoom.us/hc/en-us/articles/207005927-Release-notes-for-Zoom-Rooms"
echo "  - Strategy: waitForSelector (passive dynamic)"
echo "  - Wait time: 5000ms"
echo ""

# Get Supabase details
SUPABASE_URL="https://idlkxmbymqduafgatdwd.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkbGt4bWJ5bXFkdWFmZ2F0ZHdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI5MDQwOTUsImV4cCI6MjA0ODQ4MDA5NX0.2dS7d0-KQJLAe5N5hDmQKzQQ3JbHh56C1g3NbVWNd6s"

echo "🔄 Sending request..."
echo ""

RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/extract-software-info" \
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
  }')

echo "📊 RESULTS:"
echo "=========================================="
echo ""

# Parse and display key metrics
echo "$RESPONSE" | jq -r '
  "Extraction Method: " + (.extractionMethod // "unknown"),
  "Manufacturer: " + (.manufacturer // "Unknown"),
  "Category: " + (.category // "Unknown"),
  "Confidence: " + ((.confidence // 0) | tostring) + "%",
  "Product Found: " + (if .productNameFound then "✅ YES" else "❌ NO" end),
  "Versions Found: " + ((.versions | length) | tostring),
  "",
  "Validation Notes:",
  (.validationNotes // "None"),
  "",
  "Current Version: " + (.currentVersion // "Not found"),
  "Release Date: " + (.releaseDate // "Not found")
'

echo ""
echo "=========================================="
echo ""

# Check if we got versions
VERSION_COUNT=$(echo "$RESPONSE" | jq '.versions | length')

if [ "$VERSION_COUNT" -gt 0 ]; then
  echo "✅ SUCCESS! Found $VERSION_COUNT versions"
  echo ""
  echo "First 3 versions:"
  echo "$RESPONSE" | jq -r '.versions[:3] | .[] | "  - Version: \(.version), Date: \(.releaseDate // "unknown"), Notes: \(.notes[:80] // "none")..."'
else
  echo "❌ FAILED - No versions found"
  echo ""
  echo "This likely means:"
  echo "  1. The scraping strategy selectors didn't match"
  echo "  2. The page structure is different than expected"
  echo "  3. Bot blocking is preventing access"
  echo ""
  echo "Full response saved to zoom-test-result.json"
  echo "$RESPONSE" | jq '.' > zoom-test-result.json
fi

echo ""
echo "💾 Full response saved to: zoom-test-result.json"
echo "$RESPONSE" | jq '.' > zoom-test-result.json

echo ""
echo "To view function logs, visit:"
echo "https://supabase.com/dashboard/project/idlkxmbymqduafgatdwd/functions/extract-software-info/logs"
