# Troubleshooting trigger-version-check

## Issue: No logs or versions not updating

### Step 1: Check if the function is deployed

```bash
# List all deployed functions
supabase functions list
```

You should see `trigger-version-check` in the list. If not, deploy it:

```bash
./deploy-edge-functions.sh
# OR
supabase functions deploy trigger-version-check
```

### Step 2: Check if CRON_SECRET is set

```bash
# List all secrets
supabase secrets list
```

You should see `CRON_SECRET` in the list. If not, set it:

```bash
# Generate a secret
CRON_SECRET=$(openssl rand -hex 32)

# Set it in Supabase
supabase secrets set CRON_SECRET="$CRON_SECRET"

# Save it to .env for testing
echo "CRON_SECRET=$CRON_SECRET" >> .env

echo "Your CRON_SECRET: $CRON_SECRET"
```

### Step 3: Test the function manually

Use the test script:

```bash
./test-trigger-version-check.sh
```

OR test manually with curl:

```bash
# Load your env
source .env

# Call the function
curl -X POST \
  "${VITE_SUPABASE_URL}/functions/v1/trigger-version-check" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json"
```

### Step 4: Check the logs

```bash
# View real-time logs
supabase functions logs trigger-version-check --follow

# View last 50 log entries
supabase functions logs trigger-version-check --limit 50
```

### Step 5: Check your software has version_website set

```sql
-- Run this in Supabase SQL Editor
SELECT id, name, version_website
FROM software
WHERE version_website IS NOT NULL AND version_website != '';
```

If no results, your software doesn't have version_website URLs configured.

### Step 6: Test extract-software-info directly

If trigger-version-check works but no versions are found, test the extract function directly:

```bash
# Get your service role key from Supabase Dashboard → Settings → API
source .env

curl -X POST \
  "${VITE_SUPABASE_URL}/functions/v1/extract-software-info" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "TouchDesigner",
    "website": "https://derivative.ca",
    "versionUrl": "https://derivative.ca/download"
  }'
```

## Common Errors

### Error: "No Authorization header provided"
- You forgot to pass the `Authorization` header
- Add: `-H "Authorization: Bearer ${CRON_SECRET}"`

### Error: "Invalid credentials"
- Your CRON_SECRET doesn't match what's set in Supabase
- Re-check with `supabase secrets list`
- Re-set with `supabase secrets set CRON_SECRET="your-secret"`

### Error: "CRON_SECRET not configured"
- The secret is not set in Supabase environment
- Set it: `supabase secrets set CRON_SECRET="$(openssl rand -hex 32)"`

### No errors but no versions found
- Check if extract-software-info is working (Step 6)
- Check if your software has valid version_website URLs
- Check logs: `supabase functions logs extract-software-info --follow`

## Expected Response

When working correctly, you should get a response like:

```json
{
  "totalChecked": 5,
  "successful": 4,
  "failed": 1,
  "totalVersionsAdded": 23,
  "results": [
    {
      "softwareId": "uuid-here",
      "name": "TouchDesigner",
      "success": true,
      "versionsFound": 10
    },
    ...
  ]
}
```

## Still not working?

1. Check if your Supabase project has the pg_net extension enabled (needed for HTTP calls)
2. Check if your edge function timeout is sufficient (increase in Supabase Dashboard)
3. Verify your OpenAI API key is set: `supabase secrets list`
4. Check OpenAI API key has credits: https://platform.openai.com/usage
