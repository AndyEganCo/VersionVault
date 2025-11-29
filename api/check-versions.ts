import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel cron job handler that triggers the Supabase edge function
 * for nightly version checks.
 *
 * This function is called by Vercel cron at midnight UTC and simply
 * forwards the request to the Supabase edge function which contains
 * the actual version checking logic.
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    // Get environment variables
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing required environment variables');
      return res.status(500).json({
        error: 'Server configuration error',
        details: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY'
      });
    }

    console.log('Triggering Supabase edge function for version checks...');

    // Call the Supabase edge function
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/trigger-version-check`;

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      }
    });

    // Get the response from the edge function
    const data = await response.json();

    if (!response.ok) {
      console.error('Edge function returned error:', data);
      return res.status(response.status).json({
        error: 'Edge function failed',
        details: data
      });
    }

    console.log('Edge function completed successfully');

    return res.status(200).json({
      message: 'Nightly version check triggered successfully',
      result: data
    });
  } catch (error) {
    console.error('Error triggering edge function:', error);
    return res.status(500).json({
      error: 'Failed to trigger version check',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
