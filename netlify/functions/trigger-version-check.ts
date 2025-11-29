// Manual trigger endpoint for testing version checks
// Visit: https://your-site.netlify.app/.netlify/functions/trigger-version-check

export default async (req: Request) => {
  // Only allow POST requests or GET for testing
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Get the URL of the scheduled function
    const baseUrl = new URL(req.url).origin;
    const scheduledFunctionUrl = `${baseUrl}/.netlify/functions/check-versions`;

    console.log(`Triggering version check at: ${scheduledFunctionUrl}`);

    // Call the scheduled function
    const response = await fetch(scheduledFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    return new Response(JSON.stringify({
      success: true,
      message: 'Version check triggered successfully',
      result: data
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error triggering version check:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};
