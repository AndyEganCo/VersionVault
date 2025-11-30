# AI Features Setup Guide

VersionVault uses OpenAI to automatically extract software information when approving requests.

## What Does AI Do?

When an admin approves a software request, AI automatically:
1. **Extracts the manufacturer name** - Identifies the company/developer from the website
2. **Determines the category** - Classifies the software into the right category
3. **Adds to tracking** - Creates the software entry with all information filled in

This eliminates manual data entry and ensures consistency!

## Setup Instructions

### Step 1: Get an OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Sign in or create an account
3. Click "Create new secret key"
4. Give it a name (e.g., "VersionVault")
5. Copy the key (starts with `sk-`)
6. **IMPORTANT:** Save it somewhere safe - you won't see it again!

### Step 2: Add API Key to Your Project

**For Local Development:**

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your keys:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_key
   VITE_OPENAI_API_KEY=sk-your-openai-key-here
   ```

3. Restart your dev server

**For Vercel Deployment:**

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add these variables:
   - `VITE_SUPABASE_URL` = Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = Your Supabase anon key
   - `VITE_OPENAI_API_KEY` = Your OpenAI API key (sk-...)

4. Redeploy your project

### Step 3: Test It!

1. Log in as an admin
2. Submit a software request (or use an existing one)
3. Click "Approve & Add"
4. Watch the AI process:
   - "Processing request with AI..."
   - "Extracting software information..."
   - "Adding to software tracking list..."
   - "✅ Approved and added!"

5. Check the Software page - the new entry should be there with manufacturer and category filled in!

## How It Works

### The AI Prompt

The AI receives:
- Software name
- Website URL
- Version check URL
- Description (if provided)

It analyzes this information and returns:
```json
{
  "manufacturer": "Adobe",
  "category": "Design"
}
```

### Fallback Behavior

If AI fails (no API key, network error, etc.), it falls back to:
- **Manufacturer:** Extracted from domain name (e.g., "adobe.com" → "Adobe")
- **Category:** "Show Control"

The approval will still work, just with less accurate data.

## Available Categories

The AI chooses from these categories:
- Audio Production
- Video Production
- Presentation & Playback
- Lighting Control
- Show Control
- Design & Planning
- Network & Control
- Project Management

## Cost Information

### Pricing

OpenAI charges per token used. For this feature:
- Model: GPT-4o-mini (cheapest, fast)
- Cost: ~$0.0001 per approval (basically free)
- 1000 approvals ≈ $0.10

### Monitoring Usage

Check your OpenAI dashboard to monitor:
1. Go to https://platform.openai.com/usage
2. View your API usage
3. Set up usage limits if desired

## Troubleshooting

### Error: "Failed to process request"

**Possible causes:**
1. No OpenAI API key set
2. Invalid API key
3. API key has no credits
4. Network error

**Solutions:**
1. Check `.env` file has `VITE_OPENAI_API_KEY`
2. Verify key starts with `sk-`
3. Check OpenAI billing at https://platform.openai.com/settings/organization/billing
4. Try again - might be temporary network issue

### AI Returns Wrong Information

The AI is pretty accurate, but sometimes makes mistakes:

**You can always edit after approval:**
1. Go to Manage Software
2. Find the software
3. Click Edit
4. Update manufacturer or category

### Warning: "dangerouslyAllowBrowser: true"

You might see this in the console. It's expected for now.

**Why?** OpenAI SDK normally runs server-side, but we're running it client-side.

**Is it safe?** Your API key is in environment variables, not in the code. BUT for production, you should move this to a server-side function.

**Future improvement:** Create a Supabase Edge Function to handle AI processing server-side.

## Without AI (Optional)

If you don't want to use AI:

1. Don't set `VITE_OPENAI_API_KEY`
2. The fallback will automatically trigger
3. Manufacturer will be extracted from domain
4. Category will be "Other"
5. You can manually edit these later

## Security Best Practices

✅ **DO:**
- Store API keys in environment variables
- Use different keys for dev/production
- Set usage limits on OpenAI dashboard
- Rotate keys periodically

❌ **DON'T:**
- Commit `.env` to git (it's in `.gitignore`)
- Share API keys publicly
- Use the same key across multiple projects
- Expose keys in client-side code (we'll fix this later)

## Need Help?

If you encounter issues:
1. Check browser console for error messages
2. Verify all environment variables are set
3. Test OpenAI API key with curl:
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer YOUR_API_KEY"
   ```
4. Check Vercel deployment logs for issues
