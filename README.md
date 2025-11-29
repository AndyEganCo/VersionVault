# VersionVault

A software version tracking and monitoring application that automatically checks for new software versions.

## Features

- Track software versions across multiple applications
- Automated nightly version checks via Vercel cron jobs
- AI-powered version detection using OpenAI GPT-4
- Supabase backend for data storage
- Real-time notifications for version updates

## Setup

### Environment Variables

You need to set up the following environment variables in your Vercel project:

**For the frontend (VITE_ prefix):**
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon/public key
- `VITE_OPENAI_API_KEY` - Your OpenAI API key

**For the Vercel cron job (no prefix):**
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anon/public key

**For the Supabase edge function:**
The edge function `trigger-version-check` should already be deployed in your Supabase project with the necessary logic for scraping and version detection.

### Deploying to Vercel

1. Connect your repository to Vercel
2. Add all the environment variables listed above
3. Deploy the project

The cron job will automatically be set up to run every night at midnight UTC.

### Cron Job Configuration

The nightly version check is configured in `vercel.json`:

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

This runs the `/api/check-versions` endpoint every night at midnight UTC (0 0 * * *).

### Manual Version Check

You can manually trigger a version check by calling the Supabase edge function directly:

```bash
curl https://YOUR_SUPABASE_URL/functions/v1/trigger-version-check \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY"
```

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## How It Works

1. **Scheduled Trigger**: Vercel cron triggers the `/api/check-versions` endpoint every night at midnight UTC
2. **Call Edge Function**: The Vercel function calls the Supabase edge function `trigger-version-check`
3. **Fetch Software**: The Supabase edge function fetches all software entries from the database
4. **Scrape Pages**: For each software, it scrapes the version page URL
5. **AI Detection**: Uses OpenAI GPT-4 to extract version numbers from scraped content
6. **Compare & Store**: Compares detected versions with current versions and stores results
7. **Notifications**: If a new version is detected, it can trigger notifications (to be implemented)

**Architecture:**
- **Vercel Cron**: Simple scheduler that runs at midnight UTC
- **Vercel API Function**: Lightweight proxy that calls the Supabase edge function
- **Supabase Edge Function**: Contains all the version checking logic (scraping, AI detection, database updates)

## Database Schema

Required Supabase tables:
- `software` - Software entries with version_page_url and current_version
- `version_checks` - Historical version check results
- `software_version_history` - Version history for each software
- `tracked_software` - User tracking preferences
