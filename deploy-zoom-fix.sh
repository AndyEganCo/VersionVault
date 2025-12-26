#!/bin/bash

set -e  # Exit on error

echo "🚀 Deploying Zoom Rooms Interactive Scraping Fix"
echo "================================================"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "📦 Supabase CLI not found. Installing..."
    echo ""

    # Install Supabase CLI
    if command -v npm &> /dev/null; then
        echo "Using npm to install Supabase CLI..."
        npm install -g supabase
    elif command -v brew &> /dev/null; then
        echo "Using Homebrew to install Supabase CLI..."
        brew install supabase/tap/supabase
    else
        echo "❌ Neither npm nor Homebrew found."
        echo ""
        echo "Please install Supabase CLI manually:"
        echo "  npm: npm install -g supabase"
        echo "  brew: brew install supabase/tap/supabase"
        echo "  or visit: https://supabase.com/docs/guides/cli/getting-started"
        exit 1
    fi

    echo "✅ Supabase CLI installed"
    echo ""
fi

# Change to project directory
cd /home/user/VersionVault

# Check if logged in to Supabase
if ! supabase projects list &> /dev/null; then
    echo "🔐 Not logged in to Supabase. Logging in..."
    echo ""
    supabase login
    echo ""
fi

# Link project if not already linked
if [ ! -f "supabase/.temp/project-ref" ]; then
    echo "🔗 Linking project..."
    supabase link --project-ref idlkxmbymqduafgatdwd
    echo ""
fi

# Deploy the function
echo "📦 Deploying extract-software-info function..."
echo ""
supabase functions deploy extract-software-info

echo ""
echo "✅ DEPLOYMENT COMPLETE!"
echo ""
echo "================================================"
echo "🧪 Now test it:"
echo "================================================"
echo ""
echo "1. Go to your web app"
echo "2. Find 'Zoom Rooms' in your software list"
echo "3. Click 'Check for New Version'"
echo ""
echo "Expected result:"
echo "  ✅ Multiple versions found"
echo "  ✅ Detailed release notes"
echo "  ✅ No more 'Loading...' skeleton"
echo ""
echo "📊 View function logs:"
echo "  https://supabase.com/dashboard/project/idlkxmbymqduafgatdwd/functions/extract-software-info/logs"
echo ""
