# Supabase Edge Functions

This directory contains secure server-side functions for VersionVault.

## 🚀 Quick Deploy

The easiest way to deploy these functions is to use the automated script:

```bash
# From the project root
./deploy-edge-functions.sh
```

This script will:
1. ✓ Check if Supabase CLI is installed
2. ✓ Login to Supabase
3. ✓ Link your project
4. ✓ Set up the OpenAI API key (server-side secret)
5. ✓ Deploy both edge functions
6. ✓ Show you next steps

## 📖 Manual Deployment

If you prefer to deploy manually, see [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

Or see [DEPLOYMENT_QUICKSTART.md](../../DEPLOYMENT_QUICKSTART.md) in the project root for step-by-step terminal commands.

## 🔒 Security Note

The OpenAI API key is stored as a **Supabase secret** (server-side), not in your `.env` file. This prevents the key from being exposed to browsers.

## Functions

### `extract-software-info`
Securely extracts software version information using OpenAI. Analyzes both the version URL and main website (up to 50k characters total).

### `fetch-webpage`
Fetches webpage content server-side to bypass CORS restrictions.

## Need Help?

See [DEPLOYMENT_QUICKSTART.md](../../DEPLOYMENT_QUICKSTART.md) for troubleshooting tips.
