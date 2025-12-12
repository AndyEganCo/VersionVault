# Edge Function Setup Guide

This guide explains how to deploy the `fetch-webpage` Supabase Edge Function to enable version extraction from software websites.

## Why Do We Need This?

When the AI tries to extract version information, it needs to read the content of version webpages. However, browsers block direct fetching due to **CORS (Cross-Origin Resource Sharing)** restrictions.

The Edge Function solves this by:
- Fetching webpages **server-side** (no CORS restrictions)
- Acting as a proxy between your app and external websites
- Returning the webpage content to the AI for analysis

## Prerequisites

1. **Supabase CLI** installed
2. **Supabase account** with project created
3. **Docker** (required by Supabase CLI)

## Installation Steps

### Step 1: Install Supabase CLI

If you don't have it already:

```bash
# macOS/Linux
npm install -g supabase

# Or using Homebrew (macOS)
brew install supabase/tap/supabase
```

### Step 2: Login to Supabase

```bash
supabase login
```

This will open a browser window to authenticate.

### Step 3: Link Your Project

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

**Finding your project ref:**
1. Go to https://supabase.com/dashboard
2. Select your project
3. The project ref is in the URL: `https://supabase.com/dashboard/project/YOUR_PROJECT_REF`
4. Or find it in Settings → General → Project Settings → Reference ID

### Step 4: Deploy the Edge Function

From your project root directory:

```bash
supabase functions deploy fetch-webpage
```

You should see output like:
```
Deploying Function fetch-webpage...
Function URL: https://YOUR_PROJECT_REF.supabase.co/functions/v1/fetch-webpage
```

### Step 5: Verify Deployment

Test the function:

```bash
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/fetch-webpage' \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com"}'
```

You should get back:
```json
{"content":"Example Domain This domain is for..."}
```

## Configuration

The Edge Function is now deployed! Your app will automatically use it when:
- `VITE_SUPABASE_URL` is configured in your environment variables
- The function is deployed at `https://YOUR_PROJECT_REF.supabase.co/functions/v1/fetch-webpage`

No additional environment variables needed - it uses your existing Supabase URL.

## Testing

1. Go to Software Requests page
2. Create a test request with a version URL
3. Click "Approve & Add"
4. Check the browser console - you should see successful fetch logs
5. The software entry should now have version and release date populated!

## Troubleshooting

### "Function not found" error

**Solution:** Make sure you deployed the function:
```bash
supabase functions deploy fetch-webpage
```

### "Authentication required" error

**Solution:** The function allows anonymous access. If you see this, check your Supabase project settings.

### Edge Function times out

**Solution:** Some websites are slow to respond. The function has a default timeout. If needed, you can modify the timeout in the edge function code.

### Still getting CORS errors

**Solution:**
1. Verify the edge function is deployed: `supabase functions list`
2. Check your VITE_SUPABASE_URL environment variable is correct
3. Make sure the Edge Function URL is accessible

## Cost Information

Supabase Edge Functions are free tier:
- **Free tier:** 500,000 invocations/month
- **Pro tier:** 2,000,000 invocations/month

Each software approval = 1 invocation

Well within free limits for most use cases!

## How It Works

1. User clicks "Approve & Add" on a software request
2. AI extraction service calls `fetchWebpageContent(url)`
3. Client makes POST request to Edge Function with the URL
4. Edge Function fetches the webpage server-side (no CORS)
5. Edge Function extracts text content and returns it
6. AI analyzes the content to extract version and release date
7. Software is added with all information populated

## Local Development

To test the Edge Function locally:

```bash
# Start local Supabase (requires Docker)
supabase start

# Serve functions locally
supabase functions serve fetch-webpage
```

The function will be available at:
```
http://localhost:54321/functions/v1/fetch-webpage
```

Update your local `.env`:
```env
VITE_SUPABASE_URL=http://localhost:54321
```

## Security Notes

- The Edge Function only accepts POST requests with a URL
- It limits responses to 3000 characters to prevent abuse
- CORS headers allow requests from any origin (needed for web app)
- No authentication required (safe for public read-only fetching)

## Updating the Function

If you need to modify the function:

1. Edit `supabase/functions/fetch-webpage/index.ts`
2. Redeploy:
   ```bash
   supabase functions deploy fetch-webpage
   ```

Changes are deployed immediately!
