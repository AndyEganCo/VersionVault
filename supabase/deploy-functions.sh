#!/bin/bash

# Deploy all edge functions with JWT verification disabled
# Run this script instead of "supabase functions deploy"

echo "🚀 Deploying edge functions with --no-verify-jwt flag..."
echo ""

echo "📦 Deploying merge-release-notes..."
npx supabase functions deploy merge-release-notes --no-verify-jwt

echo ""
echo "📦 Deploying extract-with-web-search..."
npx supabase functions deploy extract-with-web-search --no-verify-jwt

echo ""
echo "📦 Deploying trigger-version-check..."
npx supabase functions deploy trigger-version-check --no-verify-jwt

echo ""
echo "✅ All functions deployed successfully!"
echo ""
echo "Functions deployed:"
echo "  - merge-release-notes (no JWT verification)"
echo "  - extract-with-web-search (no JWT verification)"
echo "  - trigger-version-check (no JWT verification)"
