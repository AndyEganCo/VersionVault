# Version Check Edge Function

This Supabase Edge Function automatically checks for software version updates.

## Features

- Fetches all software with `version_website` URLs from the database
- Uses OpenAI GPT-4 to extract version numbers from web pages
- Saves check results to `version_checks` table
- Updates `software` table when new versions are detected
- Creates entries in `software_version_history` for new versions
- Sends notifications to users tracking the software

## Environment Variables

Required in your Supabase project:

- `SUPABASE_URL` - Automatically provided by Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Automatically provided by Supabase
- `OPENAI_API_KEY` - Your OpenAI API key

## Deployment

### 1. Install Supabase CLI

```bash
npm install -g supabase
```

### 2. Login to Supabase

```bash
supabase login
```

This will open a browser window to authenticate.

### 3. Link to Your Project

```bash
supabase link --project-ref idlkxmbymqduafgatdwd
```

You'll be prompted to enter your database password.

### 4. Set Environment Variables

```bash
supabase secrets set OPENAI_API_KEY=your-openai-key
```

Replace `your-openai-key` with your actual OpenAI API key.

### 5. Deploy the Function

```bash
supabase functions deploy trigger-version-check
```

After deployment, your function will be available at:
```
https://idlkxmbymqduafgatdwd.supabase.co/functions/v1/trigger-version-check
```

## Usage

### Manual Trigger

Call the endpoint:

```bash
curl -X POST https://idlkxmbymqduafgatdwd.supabase.co/functions/v1/trigger-version-check \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

Or visit in browser:
```
https://idlkxmbymqduafgatdwd.supabase.co/functions/v1/trigger-version-check
```

Note: The function will work without Authorization header, but you may want to add auth for production.

### Automated Scheduling

Set up a cron job using Supabase's pg_cron or an external service like:

- **Vercel Cron Jobs** (recommended for this project)
- **GitHub Actions**
- **Cron-job.org**

Example GitHub Action (`.github/workflows/version-check.yml`):

```yaml
name: Daily Version Check
on:
  schedule:
    - cron: '0 0 * * *'  # Daily at midnight
  workflow_dispatch:  # Allow manual trigger

jobs:
  check-versions:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Version Check
        run: |
          curl -X POST https://idlkxmbymqduafgatdwd.supabase.co/functions/v1/trigger-version-check
```

## Response Format

```json
{
  "success": true,
  "checked": 10,
  "results": [
    {
      "software": "ProPresenter",
      "oldVersion": "7.14.1",
      "newVersion": "7.15.0",
      "status": "updated"
    },
    {
      "software": "Ableton Live",
      "version": "11.3.10",
      "status": "up-to-date"
    }
  ]
}
```

## Database Tables Used

- `software` - Software entries with version_website URLs
- `version_checks` - History of all version checks
- `software_version_history` - Version release history
- `tracked_software` - User tracking relationships
- `notifications` - User notifications for new versions
