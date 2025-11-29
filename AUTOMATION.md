# VersionVault Automation Features

This document explains the automated systems in VersionVault for version checking and user software requests.

## 🤖 Automated Version Checking

VersionVault automatically checks for new software versions daily using AI-powered web scraping.

### How It Works

1. **Vercel Cron Job** - Runs `/api/check-versions` daily at midnight UTC
2. **Web Scraping** - Each software's `version_website` URL is scraped using Cheerio
3. **AI Extraction** - OpenAI GPT-4 extracts the version number from the scraped content
4. **Database Update** - If a new version is detected:
   - Updates `software.current_version`
   - Updates `software.release_date`
   - Updates `software.last_checked`
   - Adds entry to `software_version_history` table
5. **Rate Limiting** - Waits 2 seconds between each software check to be respectful

### Configuration

**Scheduled Frequency** (`vercel.json`):
```json
{
  "crons": [
    {
      "path": "/api/check-versions",
      "schedule": "0 0 * * *"
    }
  ]
}
```

**Cron Schedule Format:**
- `0 0 * * *` - Daily at midnight UTC
- `0 */6 * * *` - Every 6 hours
- `0 0 * * 0` - Weekly (Sundays at midnight)
- `0 0 1 * *` - Monthly (1st of month at midnight)

[Cron expression reference](https://crontab.guru/)

### Manual Testing

To manually trigger a version check:

**Via URL:**
```
GET https://www.versionvault.dev/api/trigger-version-check
```

**Via cURL:**
```bash
curl https://www.versionvault.dev/api/trigger-version-check
```

**Via Admin Panel** (coming soon):
- Navigate to Admin → Software
- Click "Check Versions Now" button

### Response Format

```json
{
  "success": true,
  "checked": 25,
  "successful": 23,
  "failed": 2,
  "updated": 5,
  "results": [
    {
      "name": "ProPresenter",
      "success": true,
      "version": "7.15.3"
    }
  ]
}
```

### Environment Variables Required

Set these in **Vercel Dashboard** → Project Settings → Environment Variables:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_OPENAI_API_KEY=your_openai_api_key
CRON_SECRET=random_secret_string (optional but recommended)
```

⚠️ **Security Note:** The `CRON_SECRET` prevents unauthorized calls to the cron endpoint.

### Vercel Deployment

1. **Push to GitHub** - Vercel auto-deploys on push
2. **Set Environment Variables** - Add all required env vars in Vercel dashboard
3. **Enable Cron Jobs** - Automatically enabled when `vercel.json` contains crons
4. **Monitor Logs** - View execution logs in Vercel Dashboard → Functions

### Viewing Logs

**Vercel Dashboard:**
1. Go to your project
2. Click "Functions" tab
3. Select `check-versions`
4. View real-time logs and execution history

**Real-time monitoring:**
```bash
vercel logs --follow
```

### Troubleshooting

**Version not detected?**
- Check that `software.version_website` is set correctly
- Verify the URL contains version information
- Check Vercel function logs for errors

**Rate limits or timeouts?**
- Vercel serverless functions have 10s timeout by default
- Increase in `vercel.json`: `"maxDuration": 60`
- Adjust delay between requests (currently 2 seconds)

**OpenAI errors?**
- Verify API key is valid
- Check OpenAI account has credits
- Monitor OpenAI API usage

**Cron not running?**
- Verify `vercel.json` is in project root
- Check Vercel dashboard for cron execution history
- Ensure project is deployed (crons only run in production)

---

## 👥 User Software Requests

Users can request new software to be tracked. Admins review and approve these requests.

### User Workflow

1. **Submit Request**
   - Click "Request New Software" button
   - Fill out form with:
     - Software name
     - Official website
     - Version check URL
     - Optional description
   - Submit

2. **Request Stored**
   - Saved to `software_requests` table
   - Status: `pending`
   - Associated with user's account

3. **Wait for Admin Approval**
   - Users can view their own requests
   - Status updates: `pending` → `approved` or `rejected`

### Admin Workflow

1. **View Requests**
   - Navigate to Admin → Requests
   - See all pending, approved, and rejected requests

2. **Review Request**
   - Check software name and URLs
   - Verify website and version URL are valid
   - Click links to preview

3. **Approve or Reject**
   - **Approve** - Automatically creates software entry with:
     - Unique ID (generated from name)
     - Default category: "Project Management"
     - Default manufacturer: "Unknown"
     - Status updated to `approved`
   - **Reject** - Status updated to `rejected`

4. **Follow Up**
   - Approved software can be edited in Manage Software
   - Update category, manufacturer, etc.
   - Software immediately available for tracking

### Database Schema

```sql
CREATE TABLE software_requests (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  website TEXT NOT NULL,
  versionUrl TEXT NOT NULL,
  description TEXT,
  userId UUID REFERENCES auth.users(id),
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')),
  createdAt TIMESTAMP DEFAULT NOW()
);
```

### RLS Policies

- **Users can**:
  - Create requests (authenticated)
  - View their own requests

- **Admins can**:
  - View all requests
  - Update request status
  - Delete requests

### API Example

**Create Request:**
```typescript
const { error } = await supabase
  .from('software_requests')
  .insert({
    name: 'ProPresenter',
    website: 'https://renewedvision.com',
    versionUrl: 'https://renewedvision.com/download',
    description: 'Popular church presentation software',
    userId: user.id,
    status: 'pending'
  });
```

**Approve Request:**
```typescript
// 1. Create software entry
await supabase.from('software').insert({
  id: 'propresenter',
  name: 'ProPresenter',
  manufacturer: 'Renewed Vision',
  website: request.website,
  version_website: request.versionUrl,
  category: 'Presentation & Playback'
});

// 2. Update request status
await supabase
  .from('software_requests')
  .update({ status: 'approved' })
  .eq('id', requestId);
```

---

## 🔐 Security Considerations

### Version Checker
- Uses anonymous Supabase key (read-only for most tables)
- Optional `CRON_SECRET` to prevent unauthorized triggers
- Respects robots.txt and rate limits
- Timeout after 30 seconds per website
- No user data exposed in logs

### User Requests
- RLS policies prevent unauthorized access
- Users can only view their own requests
- Only admins can approve/reject
- URLs are validated before scraping

---

## 📊 Monitoring

### Vercel Function Logs

View version check results:
1. Vercel Dashboard → Functions
2. Select `check-versions`
3. View logs for each execution

**CLI monitoring:**
```bash
vercel logs /api/check-versions --follow
```

### Supabase Logs

Monitor database changes:
1. Supabase Dashboard → Logs
2. Filter by table: `software_version_history`
3. See all version updates

---

## 🚀 Vercel Deployment Checklist

- [ ] Push code to GitHub
- [ ] Connect repo to Vercel
- [ ] Set environment variables in Vercel dashboard
- [ ] Verify `vercel.json` is in project root
- [ ] Deploy to production
- [ ] Check cron jobs are scheduled (Vercel → Functions → Cron)
- [ ] Test manual trigger: `/api/trigger-version-check`
- [ ] Monitor first cron execution

---

## 💡 Future Enhancements

- [ ] Email notifications when new versions detected
- [ ] Webhook notifications for version updates
- [ ] Admin dashboard with version check statistics
- [ ] Ability to configure check frequency per software
- [ ] User voting system for software requests
- [ ] Automatic category detection using AI
- [ ] GitHub integration for software with GitHub releases
- [ ] Custom scraping rules per software

---

## 🔧 Advanced Configuration

### Custom Timeout

Edit `vercel.json`:
```json
{
  "functions": {
    "api/check-versions.ts": {
      "maxDuration": 60
    }
  }
}
```

### Multiple Cron Jobs

```json
{
  "crons": [
    {
      "path": "/api/check-versions",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cleanup-old-data",
      "schedule": "0 0 * * 0"
    }
  ]
}
```

---

## 💡 Best Practices

### For Admins

1. **Review requests promptly** - Users are waiting
2. **Verify URLs work** - Click through before approving
3. **Update metadata** - Fill in manufacturer, category after approval
4. **Monitor version checks** - Review logs weekly for issues

### For Users

1. **Provide accurate URLs** - Version URL should contain version info
2. **Be specific** - Clear software names help prevent duplicates
3. **Add context** - Description helps admins understand the request

---

## 📞 Support

If you encounter issues:

1. Check Vercel function logs
2. Verify environment variables are set
3. Test URLs manually in browser
4. Create GitHub issue with details

---

**Last Updated:** 2025-11-29
**Version:** 2.0.0 (Vercel)
