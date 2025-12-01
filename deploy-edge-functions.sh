#!/bin/bash

# VersionVault Edge Function Deployment Script
# This script helps you deploy the secure edge functions to Supabase

set -e  # Exit on error

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     VersionVault Edge Function Deployment Script          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Supabase CLI is installed
echo -e "${BLUE}[1/6] Checking Supabase CLI...${NC}"
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}ERROR: Supabase CLI is not installed!${NC}"
    echo ""
    echo "Please install it first:"
    echo "  macOS:   brew install supabase/tap/supabase"
    echo "  npm:     npm install -g supabase"
    echo "  Linux:   curl -fsSL https://raw.githubusercontent.com/supabase/cli/main/install.sh | sh"
    echo ""
    exit 1
fi
echo -e "${GREEN}✓ Supabase CLI found: $(supabase --version)${NC}"
echo ""

# Check if logged in
echo -e "${BLUE}[2/6] Checking Supabase login...${NC}"
if ! supabase projects list &> /dev/null; then
    echo -e "${YELLOW}Not logged in. Logging in now...${NC}"
    supabase login
else
    echo -e "${GREEN}✓ Already logged in${NC}"
fi
echo ""

# Check if project is linked
echo -e "${BLUE}[3/6] Checking project link...${NC}"
if [ ! -f ".supabase/config.toml" ]; then
    echo -e "${YELLOW}Project not linked.${NC}"
    echo ""
    echo "Please enter your Supabase project reference ID:"
    echo "(Find it at: Dashboard → Settings → General → Reference ID)"
    read -p "Project Ref: " PROJECT_REF

    if [ -z "$PROJECT_REF" ]; then
        echo -e "${RED}ERROR: Project reference ID is required!${NC}"
        exit 1
    fi

    supabase link --project-ref "$PROJECT_REF"
else
    echo -e "${GREEN}✓ Project already linked${NC}"
fi
echo ""

# Check for OpenAI API key secret
echo -e "${BLUE}[4/6] Checking API keys...${NC}"
SECRETS=$(supabase secrets list 2>&1)

if echo "$SECRETS" | grep -q "OPENAI_API_KEY"; then
    echo -e "${GREEN}✓ OPENAI_API_KEY secret is set${NC}"
else
    echo -e "${YELLOW}OPENAI_API_KEY secret not found.${NC}"
    echo ""
    echo "Please enter your OpenAI API key:"
    echo "(Get it from: https://platform.openai.com/api-keys)"
    echo "(It should start with 'sk-')"
    read -sp "OpenAI API Key: " OPENAI_KEY
    echo ""

    if [ -z "$OPENAI_KEY" ]; then
        echo -e "${RED}ERROR: OpenAI API key is required!${NC}"
        exit 1
    fi

    if [[ ! "$OPENAI_KEY" =~ ^sk- ]]; then
        echo -e "${RED}WARNING: API key should start with 'sk-'. Are you sure this is correct?${NC}"
        read -p "Continue anyway? (y/N): " CONFIRM
        if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    echo "Setting secret..."
    supabase secrets set OPENAI_API_KEY="$OPENAI_KEY"
    echo -e "${GREEN}✓ Secret set successfully${NC}"
fi

echo ""

# Check for Browserless API key (optional but recommended)
if echo "$SECRETS" | grep -q "BROWSERLESS_API_KEY"; then
    echo -e "${GREEN}✓ BROWSERLESS_API_KEY secret is set${NC}"
else
    echo -e "${YELLOW}BROWSERLESS_API_KEY secret not found (optional).${NC}"
    echo ""
    echo "Browserless allows rendering JavaScript-heavy pages."
    echo "Get a free API key from: https://www.browserless.io/"
    echo ""
    read -p "Do you want to set BROWSERLESS_API_KEY now? (y/N): " SET_BROWSERLESS

    if [[ "$SET_BROWSERLESS" =~ ^[Yy]$ ]]; then
        read -sp "Browserless API Key: " BROWSERLESS_KEY
        echo ""

        if [ ! -z "$BROWSERLESS_KEY" ]; then
            echo "Setting secret..."
            supabase secrets set BROWSERLESS_API_KEY="$BROWSERLESS_KEY"
            echo -e "${GREEN}✓ Secret set successfully${NC}"
        fi
    else
        echo "Skipping Browserless setup. You can set it later with:"
        echo "  supabase secrets set BROWSERLESS_API_KEY=your-key"
    fi
fi
echo ""

# Deploy edge functions
echo -e "${BLUE}[5/6] Deploying edge functions...${NC}"
echo ""
echo "Deploying extract-software-info (includes all version extraction)..."
supabase functions deploy extract-software-info

echo ""
echo "Deploying fetch-webpage..."
supabase functions deploy fetch-webpage

echo ""
echo "Deploying trigger-version-check (automated nightly checks)..."
supabase functions deploy trigger-version-check

echo ""
echo -e "${GREEN}✓ Edge functions deployed successfully!${NC}"
echo ""

# Final instructions
echo -e "${BLUE}[6/6] Final steps...${NC}"
echo ""
echo -e "${GREEN}✓ Deployment complete!${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo ""
echo "1. Update your .env file:"
echo "   - Make sure VITE_SUPABASE_URL is set"
echo "   - Make sure VITE_SUPABASE_ANON_KEY is set"
echo "   - REMOVE VITE_OPENAI_API_KEY if it exists (it's now server-side!)"
echo ""
echo "2. Rebuild your app:"
echo "   npm run build"
echo "   OR"
echo "   npm run dev"
echo ""
echo "3. Test the version check:"
echo "   - Go to Admin → Manage Software"
echo "   - Click the refresh icon next to any software"
echo "   - Should see: 'Checking version for [Software]...'"
echo ""
echo "4. View logs (if needed):"
echo "   supabase functions logs extract-software-info --follow"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}Deployment successful! 🎉${NC}"
echo ""
