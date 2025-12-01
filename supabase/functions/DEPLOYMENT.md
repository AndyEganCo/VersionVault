# Supabase Edge Functions Deployment Guide

## Overview

This project uses Supabase Edge Functions to securely handle AI-powered software information extraction. The OpenAI API key is stored **server-side** as a secret, preventing exposure to browsers.

## Edge Functions

### 1. `extract-software-info`

**Purpose:** Securely extracts software version, manufacturer, category, and release date using OpenAI.

**Features:**
- Fetches webpage content from both version URL and main website
- Intelligent content extraction (targets main content areas)
- Processes up to 30k characters from version page, 20k from main website
- Sends both contents to OpenAI for comprehensive version detection
- Falls back to main website if version not found on version page

**Security:** OpenAI API key is stored as a Supabase secret (not exposed to client)

### 2. `fetch-webpage`

**Purpose:** Fetches webpage content server-side to bypass CORS restrictions.

## Deployment Steps

### Prerequisites

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   supabase link --project-ref your-project-ref
   ```

### Step 1: Set OpenAI API Key as a Secret

The OpenAI API key must be stored as a Supabase secret (server-side), **NOT** in your `.env` file.

```bash
# Set the secret (replace with your actual key)
supabase secrets set OPENAI_API_KEY=sk-your-actual-openai-api-key
```

To verify the secret was set:
```bash
supabase secrets list
```

### Step 2: Deploy Edge Functions

Deploy both edge functions:

```bash
# Deploy extract-software-info function
supabase functions deploy extract-software-info

# Deploy fetch-webpage function
supabase functions deploy fetch-webpage
```

Or deploy all functions at once:
```bash
supabase functions deploy
```

### Step 3: Verify Deployment

Test the edge functions:

```bash
# Test extract-software-info
curl -X POST \
  https://your-project-ref.supabase.co/functions/v1/extract-software-info \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "QLab",
    "website": "https://qlab.app",
    "versionUrl": "https://qlab.app/release-notes"
  }'
```

Expected response:
```json
{
  "manufacturer": "Figure 53",
  "category": "Show Control",
  "currentVersion": "5.4.2",
  "releaseDate": "2024-11-15"
}
```

## Environment Variables

### Client-Side (.env)

Your `.env` file should only contain:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# ⚠️ DEPRECATED: Do NOT add VITE_OPENAI_API_KEY
# The OpenAI key is now stored as a Supabase secret (server-side)
# If you have VITE_OPENAI_API_KEY in your .env, you can remove it
```

### Server-Side (Supabase Secrets)

Set via CLI (see Step 1):

```bash
OPENAI_API_KEY=sk-your-actual-key
```

## Security Benefits

### Before (Insecure) ❌
- OpenAI API key in `.env` as `VITE_OPENAI_API_KEY`
- Exposed to browser via `dangerouslyAllowBrowser: true`
- Anyone could extract key from network requests
- Unlimited API usage/abuse possible

### After (Secure) ✅
- OpenAI API key stored as Supabase secret
- Never sent to browser
- API calls happen server-side only
- Rate limiting implemented client-side
- Proper security best practices

## Monitoring

View function logs:
```bash
supabase functions logs extract-software-info
supabase functions logs fetch-webpage
```

View real-time logs:
```bash
supabase functions logs extract-software-info --follow
```

## Troubleshooting

### Error: "OPENAI_API_KEY not configured"

**Solution:** Set the secret:
```bash
supabase secrets set OPENAI_API_KEY=sk-your-key
```

### Error: "Server error: 500"

**Solution:** Check function logs:
```bash
supabase functions logs extract-software-info
```

### Rate Limiting

The client implements a 30-second rate limit per software item to prevent spam. Users will see:
```
Please wait X seconds before checking this version again
```

## Cost Optimization

To reduce OpenAI API costs:

1. **Character Limits:** Already optimized (30k for version page, 20k for main site)
2. **Model Selection:** Using `gpt-4o-mini` (cost-effective)
3. **Rate Limiting:** 30-second cooldown prevents spam
4. **Caching:** Consider implementing Redis caching for frequently checked software

## Next Steps

Future improvements:

1. **Move Release Notes Extraction to Server-Side**
   - Currently still uses client-side OpenAI (security risk)
   - Create `extract-release-notes` edge function

2. **Implement Caching**
   - Cache version check results for 24 hours
   - Reduce duplicate API calls

3. **Add Analytics**
   - Track version check success/failure rates
   - Monitor API usage and costs

4. **Webhook Support**
   - Scheduled version checks via cron
   - Automated notifications for new versions
