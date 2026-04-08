// Supabase Edge Function for sending custom newsletters
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2.0.0';
import { throttledResendSend } from '../_shared/resend-throttle.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const VERSIONVAULT_FROM = 'VersionVault <newsletter@updates.versionvault.dev>';
const VERSIONVAULT_URL = 'https://versionvault.dev';
const RATE_LIMIT_DELAY_MS = 600; // Resend allows 2 req/sec; 600ms gives a safe margin

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface SendNewsletterRequest {
  subject: string;
  content: string; // HTML content
  recipientType: 'test' | 'all' | 'segment';
  testEmail?: string;
  draftId?: string;
  includeSponsor?: boolean;
}

interface SendResult {
  sent_count: number;
  failed_count: number;
  errors: Array<{ email: string; error: string }>;
  send_id: string;
}

serve(async (req) => {
  console.log(`📥 Received ${req.method} request to send-custom-newsletter`);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!resendApiKey) {
      console.error('❌ Missing RESEND_API_KEY');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify user is an admin
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    const { data: adminData } = await supabaseAuth
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .single();

    if (!adminData) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`✅ Admin user ${user.id} authorized`);

    // Parse request body
    const body: SendNewsletterRequest = await req.json();
    const {
      subject,
      content,
      recipientType,
      testEmail,
      draftId,
      includeSponsor = false,
    } = body;

    if (!subject || !content) {
      return new Response(
        JSON.stringify({ error: 'Subject and content are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize clients
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Get sponsor if requested
    let sponsor = null;
    if (includeSponsor) {
      const { data: sponsorData } = await supabase
        .from('newsletter_sponsors')
        .select('name, tagline, description, cta_url, cta_text')
        .eq('is_active', true)
        .single();

      sponsor = sponsorData;
    }

    // Get recipients based on type
    let recipients: Array<{ email: string; user_id: string; name: string }> =
      [];

    if (recipientType === 'test') {
      if (!testEmail) {
        return new Response(
          JSON.stringify({ error: 'Test email is required' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      recipients = [
        {
          email: testEmail,
          user_id: user.id,
          name: testEmail.split('@')[0],
        },
      ];
    } else if (recipientType === 'all') {
      // Source of truth = Resend Audience. Resend owns subscribe / unsubscribe
      // state (including unsubscribes from email links), so we send to whoever
      // Resend currently has marked as subscribed in the configured audience.
      const audienceId = Deno.env.get('RESEND_AUDIENCE_ID');
      if (!audienceId) {
        return new Response(
          JSON.stringify({ error: 'RESEND_AUDIENCE_ID not configured' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Fetch all contacts in the audience (loop defensively in case Resend
      // adds pagination later — currently this returns a single page).
      type ResendContact = { id: string; email: string; unsubscribed: boolean };
      const audienceContacts: ResendContact[] = [];
      let nextUrl: string | null = `https://api.resend.com/audiences/${audienceId}/contacts`;
      while (nextUrl) {
        const resendRes: Response = await fetch(nextUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
        });
        if (!resendRes.ok) {
          const errText = await resendRes.text();
          console.error(`❌ Resend audience fetch failed: ${resendRes.status} - ${errText}`);
          return new Response(
            JSON.stringify({ error: `Failed to fetch Resend audience: ${resendRes.status}` }),
            {
              status: 502,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
        const body: { data?: ResendContact[]; has_more?: boolean; next_url?: string } =
          await resendRes.json();
        if (Array.isArray(body.data)) {
          audienceContacts.push(...body.data);
        }
        nextUrl = body.has_more && body.next_url ? body.next_url : null;
      }

      const subscribedContacts = audienceContacts.filter((c) => !c.unsubscribed && c.email);
      console.log(
        `📋 Resend audience: ${audienceContacts.length} total, ${subscribedContacts.length} subscribed`
      );

      // Resolve each contact email to a Supabase user so we can populate
      // user_id for newsletter_logs and the per-user unsubscribe link.
      // Contacts with no matching Supabase user are skipped (we can't issue
      // a working unsubscribe link without a uid).
      const { data: authData } = await supabase.auth.admin.listUsers({
        perPage: 1000,
      });
      const usersByEmail = new Map<string, { id: string; metadata: any }>();
      if (authData?.users) {
        for (const u of authData.users) {
          if (u.email) {
            usersByEmail.set(u.email.toLowerCase(), { id: u.id, metadata: u.user_metadata });
          }
        }
      }

      const skipped: string[] = [];
      for (const contact of subscribedContacts) {
        const match = usersByEmail.get(contact.email.toLowerCase());
        if (!match) {
          skipped.push(contact.email);
          continue;
        }
        recipients.push({
          email: contact.email,
          user_id: match.id,
          name: match.metadata?.name || contact.email.split('@')[0],
        });
      }

      if (skipped.length > 0) {
        console.warn(
          `⚠️ Skipped ${skipped.length} Resend contact(s) with no matching Supabase user: ${skipped.join(', ')}`
        );
      }
    }

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ error: 'No recipients found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`📧 Sending to ${recipients.length} recipient(s)`);

    // Create send record
    const { data: sendRecord, error: sendRecordError } = await supabase
      .from('newsletter_custom_sends')
      .insert({
        draft_id: draftId || null,
        sent_by: user.id,
        subject,
        html_content: content,
        recipient_count: recipients.length,
        recipient_filter: { type: recipientType },
      })
      .select()
      .single();

    if (sendRecordError) {
      console.error('❌ Failed to create send record:', sendRecordError);
      throw sendRecordError;
    }

    const result: SendResult = {
      sent_count: 0,
      failed_count: 0,
      errors: [],
      send_id: sendRecord.id,
    };

    // Send emails
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];

      try {
        const html = generateNewsletterHtml({
          subject,
          content,
          userName: recipient.name,
          userId: recipient.user_id,
          sponsor,
        });

        const { data: emailData, error: emailError } = await throttledResendSend(resend, {
          from: VERSIONVAULT_FROM,
          to: recipient.email,
          subject,
          html,
          headers: {
            'X-Entity-Ref-ID': sendRecord.id,
            'List-Unsubscribe': `<${VERSIONVAULT_URL}/unsubscribe?uid=${recipient.user_id}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        }) as { data: { id?: string } | null; error: { message?: string } | null };

        if (emailError) {
          throw new Error(emailError.message);
        }

        // Log the sent email
        await supabase.from('newsletter_logs').insert({
          user_id: recipient.user_id,
          email: recipient.email,
          email_type: 'custom',
          subject,
          software_updates: [],
          resend_id: emailData?.id,
          status: 'sent',
        });

        // Increment sponsor impressions if present
        if (sponsor) {
          const { data: sponsorData } = await supabase
            .from('newsletter_sponsors')
            .select('impression_count')
            .eq('is_active', true)
            .single();

          if (sponsorData) {
            await supabase
              .from('newsletter_sponsors')
              .update({
                impression_count: (sponsorData.impression_count || 0) + 1,
              })
              .eq('is_active', true);
          }
        }

        result.sent_count++;
        console.log(`✅ Sent to ${recipient.email}`);
      } catch (error: any) {
        result.failed_count++;
        result.errors.push({ email: recipient.email, error: error.message });
        console.error(`❌ Failed for ${recipient.email}:`, error.message);
      }

      // Rate limit: Wait between requests (except after last item)
      if (i < recipients.length - 1) {
        await delay(RATE_LIMIT_DELAY_MS);
      }
    }

    // Update send record with results
    await supabase
      .from('newsletter_custom_sends')
      .update({
        sent_count: result.sent_count,
        failed_count: result.failed_count,
        error_details:
          result.errors.length > 0 ? { errors: result.errors } : null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', sendRecord.id);

    console.log(
      `✅ Newsletter send complete! Sent: ${result.sent_count}, Failed: ${result.failed_count}`
    );

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in send-custom-newsletter:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Helper function to generate newsletter HTML
function generateNewsletterHtml(params: {
  subject: string;
  content: string;
  userName: string;
  userId: string;
  sponsor: any;
}): string {
  const { content, userName, userId, sponsor } = params;

  const sponsorHtml = sponsor
    ? `
    <div style="padding: 24px;">
      <div style="font-size: 10px; font-weight: 600; color: #525252; text-align: center; margin-bottom: 8px; letter-spacing: 1px;">SPONSOR</div>
      <a href="${sponsor.cta_url}" style="text-decoration: none;">
        <div style="background-color: #171717; border: 1px solid #262626; border-radius: 8px; padding: 16px;">
          <div style="font-size: 14px; font-weight: 600; color: #ffffff;">${sponsor.name}</div>
          ${sponsor.tagline ? `<div style="font-size: 13px; color: #3b82f6; margin-top: 4px;">${sponsor.tagline}</div>` : ''}
          ${sponsor.description ? `<div style="font-size: 13px; color: #a3a3a3; margin-top: 8px; line-height: 1.5;">${sponsor.description}</div>` : ''}
          <div style="display: inline-block; font-size: 12px; font-weight: 600; color: #ffffff; background-color: #2563eb; padding: 8px 16px; border-radius: 6px; margin-top: 12px;">${sponsor.cta_text}</div>
        </div>
      </a>
    </div>
  `
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #0a0a0a;">
    <!-- Header -->
    <div style="padding: 32px 24px 24px 24px; border-bottom: 1px solid #262626;">
      <a href="${VERSIONVAULT_URL}" style="text-decoration: none;">
        <div style="font-size: 20px; font-weight: 600; color: #ffffff; font-family: monospace;">
          <span style="color: #a3a3a3;">&gt;_</span> VersionVault
        </div>
      </a>
      <div style="font-size: 14px; color: #a3a3a3; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 8px;">
        Newsletter
      </div>
    </div>

    <!-- Greeting -->
    <div style="padding: 24px;">
      <div style="font-size: 16px; color: #ffffff; margin-bottom: 12px;">Hey ${userName},</div>
    </div>

    <!-- Main Content -->
    <div style="padding: 0 24px 24px 24px;">
      <div style="color: #a3a3a3; line-height: 1.6;">
        ${content}
      </div>
    </div>

    ${sponsorHtml}

    <!-- Footer -->
    <div style="padding: 24px; border-top: 1px solid #262626;">
      <div style="font-size: 13px; color: #a3a3a3; text-align: center; margin-bottom: 16px;">
        <a href="${VERSIONVAULT_URL}/user/notifications" style="color: #a3a3a3; text-decoration: underline;">Manage Preferences</a>
        <span style="margin: 0 12px; color: #525252;">•</span>
        <a href="${VERSIONVAULT_URL}/unsubscribe?uid=${userId}" style="color: #a3a3a3; text-decoration: underline;">Unsubscribe</a>
        <span style="margin: 0 12px; color: #525252;">•</span>
        <a href="${VERSIONVAULT_URL}/dashboard" style="color: #a3a3a3; text-decoration: underline;">Dashboard</a>
      </div>
      <div style="font-size: 12px; color: #525252; text-align: center; margin-bottom: 8px;">VersionVault • Software Version Tracking</div>
      <div style="font-size: 12px; color: #404040; text-align: center;">© ${new Date().getFullYear()} VersionVault. All rights reserved.</div>
    </div>
  </div>
</body>
</html>
  `;
}
