# 🚀 Deployment Quickstart Guide

## Step 1: Pull the Latest Changes

If you're on a different machine or need to get the latest code:

```bash
# Navigate to your project directory
cd /path/to/VersionVault

# Fetch all branches
git fetch origin

# Checkout the feature branch
git checkout claude/review-version-check-01TF52iLn7uGLPwrUcEuCLQB

# Pull latest changes
git pull origin claude/review-version-check-01TF52iLn7uGLPwrUcEuCLQB
```

Or if you're already on the branch:

```bash
# Just pull the latest
git pull
```

## Step 2: Install Supabase CLI

### macOS
```bash
brew install supabase/tap/supabase
```

### Windows
```bash
# Using Scoop
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### Linux
```bash
# Download and install
curl -fsSL https://raw.githubusercontent.com/supabase/cli/main/install.sh | sh
```

### npm (All platforms)
```bash
npm install -g supabase
```

Verify installation:
```bash
supabase --version
```

## Step 3: Login to Supabase

```bash
supabase login
```

This will open your browser. Login with your Supabase account.

## Step 4: Link Your Project

You need your project reference ID. Find it in your Supabase dashboard:
- Go to https://supabase.com
- Open your project
- Look at the URL: `https://supabase.com/dashboard/project/YOUR_PROJECT_REF`
- OR: Settings → General → Reference ID

```bash
# Link the project (replace YOUR_PROJECT_REF with your actual project ref)
supabase link --project-ref YOUR_PROJECT_REF
```

You might be prompted to enter your database password - this is the password you set when creating the Supabase project.

## Step 5: Set the OpenAI API Key (IMPORTANT!)

The OpenAI API key must be set as a **Supabase secret** (not in your `.env` file).

```bash
# Replace sk-your-actual-key with your real OpenAI API key
supabase secrets set OPENAI_API_KEY=sk-your-actual-openai-api-key
```

Get your OpenAI API key from: https://platform.openai.com/api-keys

Verify the secret was set:
```bash
supabase secrets list
```

You should see:
```
OPENAI_API_KEY
```

## Step 6: Deploy the Edge Functions

Now deploy the new edge function:

```bash
# Deploy just the new function
supabase functions deploy extract-software-info
```

Or deploy all functions:
```bash
supabase functions deploy
```

You should see output like:
```
Deploying Function extract-software-info (project ref: your-project-ref)
Bundled extract-software-info in XXXms.
Deployed Function extract-software-info in XXXms.
        https://your-project-ref.supabase.co/functions/v1/extract-software-info
```

## Step 7: Update Your .env File

**IMPORTANT:** Remove the old `VITE_OPENAI_API_KEY` from your `.env` file if it exists.

Your `.env` should look like this:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# DO NOT ADD VITE_OPENAI_API_KEY - it's now a server-side secret!
```

Find your Supabase URL and Anon Key:
- Dashboard → Settings → API
- Copy "Project URL" and "anon public" key

## Step 8: Rebuild Your App

```bash
# Install dependencies (if needed)
npm install

# Build for production
npm run build

# Or start dev server to test
npm run dev
```

## Step 9: Test the Version Check

1. Open your app: http://localhost:5173 (or your deployed URL)
2. Login as admin
3. Go to Admin → Manage Software
4. Click the refresh icon next to any software with a version URL
5. You should see: "Checking version for [Software Name]..."
6. After a few seconds: "Version check complete! Version: X.X.X"

## Step 10: Verify It's Working

Check the browser console (F12 → Console):
- You should see: `Extracting info for: [Software Name]`
- You should see: `Extraction successful: { manufacturer: "...", ... }`
- You should **NOT** see any OpenAI API keys in the Network tab!

## Troubleshooting

### Error: "OPENAI_API_KEY not configured"

**Solution:** The secret wasn't set properly.

```bash
# Set it again
supabase secrets set OPENAI_API_KEY=sk-your-actual-key

# Verify
supabase secrets list

# Redeploy
supabase functions deploy extract-software-info
```

### Error: "Project not linked"

**Solution:** Link your project again.

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

### Error: "Server error: 500"

**Solution:** Check the function logs.

```bash
# View logs
supabase functions logs extract-software-info

# View real-time logs
supabase functions logs extract-software-info --follow
```

### Error: "Supabase configuration not found"

**Solution:** Check your `.env` file has the correct values.

```bash
# Make sure these are set in .env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...your-anon-key
```

### Rate Limit Error: "Please wait X seconds"

**Solution:** This is working as intended! You can only check each software once every 30 seconds. Wait and try again.

### No version found

**Solution:**
1. Check the function logs: `supabase functions logs extract-software-info`
2. The version page might not have clear version info
3. Try checking the software's main website or release notes page

## Quick Command Reference

```bash
# Login
supabase login

# Link project
supabase link --project-ref YOUR_PROJECT_REF

# Set secret
supabase secrets set OPENAI_API_KEY=sk-xxx

# List secrets
supabase secrets list

# Deploy function
supabase functions deploy extract-software-info

# View logs
supabase functions logs extract-software-info

# View logs in real-time
supabase functions logs extract-software-info --follow

# Test function manually
curl -X POST \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/extract-software-info \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "QLab",
    "website": "https://qlab.app",
    "versionUrl": "https://qlab.app/release-notes"
  }'
```

## Getting Your Project Details

### Project Reference ID
1. Go to https://supabase.com/dashboard
2. Select your project
3. URL will be: `https://supabase.com/dashboard/project/YOUR_PROJECT_REF`
4. OR: Settings → General → Reference ID

### Anon Key
1. Go to your Supabase project
2. Settings → API
3. Copy "anon public" key

### OpenAI API Key
1. Go to https://platform.openai.com/api-keys
2. Click "Create new secret key"
3. Copy the key (starts with `sk-`)
4. Store it as a Supabase secret (NOT in .env)

## What Changed?

Before this update:
- ❌ OpenAI API key exposed in browser
- ❌ Only 3,000 characters analyzed
- ❌ Only checked version URL
- ❌ No rate limiting

After this update:
- ✅ OpenAI API key secure on server
- ✅ 50,000 characters analyzed
- ✅ Checks version URL AND main website
- ✅ Rate limiting (30s per software)
- ✅ Smart content extraction

## Need Help?

If you're still having issues:

1. Check the function logs: `supabase functions logs extract-software-info`
2. Verify your secrets: `supabase secrets list`
3. Test the function directly with curl (see command above)
4. Check your `.env` file is correct
5. Make sure you've pulled the latest code from git

---

**Security Note:** Never commit your `.env` file or share your OpenAI API key. The key is now safely stored as a Supabase secret and never exposed to the browser.
