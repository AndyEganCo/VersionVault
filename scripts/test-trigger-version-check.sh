#!/bin/bash

# Test script for trigger-version-check edge function
# Usage: ./test-trigger-version-check.sh

echo "🧪 Testing trigger-version-check edge function"
echo ""

# Check if .env file exists
if [ ! -f ".env" ]; then
  echo "❌ Error: .env file not found"
  echo "Please create a .env file with:"
  echo "  VITE_SUPABASE_URL=your_supabase_url"
  echo "  CRON_SECRET=your_cron_secret"
  exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

if [ -z "$VITE_SUPABASE_URL" ]; then
  echo "❌ Error: VITE_SUPABASE_URL not set in .env"
  exit 1
fi

if [ -z "$CRON_SECRET" ]; then
  echo "❌ Error: CRON_SECRET not set in .env"
  echo ""
  echo "To set CRON_SECRET:"
  echo "  1. Generate a secret: openssl rand -hex 32"
  echo "  2. Set in Supabase: supabase secrets set CRON_SECRET=\"your-secret\""
  echo "  3. Add to .env: CRON_SECRET=your-secret"
  exit 1
fi

# Extract base URL (remove trailing slash if present)
SUPABASE_URL="${VITE_SUPABASE_URL%/}"

echo "📍 Supabase URL: $SUPABASE_URL"
echo "🔐 Using CRON_SECRET: ${CRON_SECRET:0:10}..."
echo ""
echo "🚀 Calling trigger-version-check..."
echo ""

# Call the function
curl -X POST \
  "${SUPABASE_URL}/functions/v1/trigger-version-check" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  -v \
  2>&1 | tee /tmp/trigger-version-check-response.txt

echo ""
echo ""
echo "✅ Test complete!"
echo ""
echo "To view detailed logs, run:"
echo "  supabase functions logs trigger-version-check --follow"
