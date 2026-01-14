import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all active software
    const { data: software, error } = await supabase
      .from('software')
      .select('id, name, updated_at, last_checked')
      .order('name');

    if (error) {
      console.error('Error fetching software:', error);
      throw error;
    }

    // Generate sitemap XML
    const baseUrl = 'https://versionvault.dev';

    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Homepage -->
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>

  <!-- Main Pages -->
  <url>
    <loc>${baseUrl}/software</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>

  <url>
    <loc>${baseUrl}/premium</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>

  <url>
    <loc>${baseUrl}/donate</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>

  <!-- Legal Pages -->
  <url>
    <loc>${baseUrl}/privacy</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>

  <url>
    <loc>${baseUrl}/terms</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>

  <!-- Auth Pages -->
  <url>
    <loc>${baseUrl}/login</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>

  <url>
    <loc>${baseUrl}/signup</loc>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>

  <url>
    <loc>${baseUrl}/forgot-password</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
`;

    // Add software entries
    // Note: Software uses modal, not individual pages
    // But we can add them with #software-id for better indexing
    if (software && software.length > 0) {
      sitemap += '\n  <!-- Software (Modal Links) -->';
      for (const item of software) {
        const lastmod = item.updated_at || item.last_checked;
        const slug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        sitemap += `
  <url>
    <loc>${baseUrl}/software#${slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>${lastmod ? `
    <lastmod>${new Date(lastmod).toISOString().split('T')[0]}</lastmod>` : ''}
  </url>`;
      }
    }

    sitemap += '\n</urlset>';

    return new Response(sitemap, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error generating sitemap:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
