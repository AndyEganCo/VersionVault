// Manual trigger endpoint for testing version checks
// Visit: https://your-site.vercel.app/api/trigger-version-check

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests or GET for testing
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the URL of the scheduled function
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const scheduledFunctionUrl = `${protocol}://${host}/api/check-versions`;

    console.log(`Triggering version check at: ${scheduledFunctionUrl}`);

    // Call the scheduled function
    const response = await fetch(scheduledFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Include auth header if CRON_SECRET is set
        ...(process.env.CRON_SECRET && {
          'Authorization': `Bearer ${process.env.CRON_SECRET}`
        })
      }
    });

    const data = await response.json();

    return res.status(200).json({
      success: true,
      message: 'Version check triggered successfully',
      result: data
    });
  } catch (error) {
    console.error('Error triggering version check:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
