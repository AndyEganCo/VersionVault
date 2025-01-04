import { CronJob } from 'https://deno.land/x/cron@v1.3.0/cron.ts';

// Run version checks every 6 hours
const job = new CronJob('0 */6 * * *', async () => {
  try {
    const response = await fetch('http://localhost:54321/functions/v1/check-versions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log('Version check completed successfully');
  } catch (error) {
    console.error('Error running version check:', error);
  }
});

job.start();