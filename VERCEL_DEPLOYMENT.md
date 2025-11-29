# Vercel Deployment Guide

This guide helps you deploy VersionVault to Vercel with automated version checking.

## Quick Start

### 1. Connect to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Click "Deploy"

### 2. Set Environment Variables

After deployment, add these in Vercel Dashboard → Settings → Environment Variables:

**Required:**
```
VITE_SUPABASE_URL=https://idlkxmbymqduafgatdwd.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_OPENAI_API_KEY=sk-...
```

**Optional (for security):**
```
CRON_SECRET=generate_with_openssl_rand_base64_32
```

### 3. Redeploy

After setting environment variables:
1. Go to Deployments tab
2. Click the three dots on latest deployment
3. Click "Redeploy"

This ensures the API functions have access to the environment variables.

## API Routes

VersionVault includes two serverless functions:

### `/api/check-versions`
- **Purpose:** Automated version checking (runs daily via cron)
- **Schedule:** Daily at midnight UTC (`0 0 * * *`)
- **Access:** Protected by `CRON_SECRET` if set

### `/api/trigger-version-check`
- **Purpose:** Manually trigger version checking
- **Access:** Public (for testing)
- **URL:** `https://your-site.vercel.app/api/trigger-version-check`

## Testing API Routes

After deployment, test the endpoints:

```bash
# Test manual trigger
curl https://www.versionvault.dev/api/trigger-version-check

# Should return JSON with version check results
```

## Verifying Cron Jobs

1. Go to Vercel Dashboard
2. Select your project
3. Click "Crons" tab
4. Verify `check-versions` is scheduled

## Troubleshooting

### API Routes Return 404

**Cause:** Functions haven't been deployed or are in wrong location

**Solutions:**
1. Ensure `api/` folder is in project root
2. Check Vercel build logs for errors
3. Redeploy after making changes

### Environment Variables Not Working

**Cause:** Variables not set or deployment not refreshed

**Solutions:**
1. Double-check variable names (case-sensitive)
2. Redeploy after setting variables
3. Check Vercel logs for missing variable errors

### Cron Jobs Not Running

**Cause:** Not in production or `vercel.json` misconfigured

**Solutions:**
1. Ensure code is deployed to production (not preview)
2. Verify `vercel.json` exists in root
3. Check Vercel Crons tab for schedule
4. View function logs for execution errors

### Add Software Not Working

**Cause:** Missing Supabase RLS policies or database fields

**Solutions:**
1. Run database migrations in Supabase SQL Editor
2. Check browser console for specific error
3. Verify admin permissions in Supabase

## Database Setup

Make sure you've run these migrations in Supabase:

1. **Public read access** (from `supabase/migrations/enable_public_read.sql`)
2. **Software requests table** (from `supabase/migrations/create_software_requests.sql`)

## Viewing Logs

### Real-time logs:
```bash
vercel logs --follow
```

### Function-specific logs:
```bash
vercel logs /api/check-versions
```

### Via Dashboard:
1. Vercel Dashboard → Functions
2. Select function
3. View execution logs

## Build Configuration

Vercel auto-detects Vite projects. Default settings:

- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

These are configured automatically, no changes needed.

## Production Checklist

- [ ] GitHub repo connected to Vercel
- [ ] Environment variables set
- [ ] Initial deployment successful
- [ ] Supabase migrations run
- [ ] API routes accessible (test `/api/trigger-version-check`)
- [ ] Cron jobs scheduled (check Vercel Crons tab)
- [ ] Add software working (test as admin)
- [ ] Version checking working (check logs)

## Support

- **Vercel Docs:** [vercel.com/docs](https://vercel.com/docs)
- **Cron Jobs:** [vercel.com/docs/cron-jobs](https://vercel.com/docs/cron-jobs)
- **API Routes:** [vercel.com/docs/functions](https://vercel.com/docs/functions)

---

**Need Help?** Check Vercel function logs first, then create a GitHub issue with:
- Error message
- Function logs
- Steps to reproduce
