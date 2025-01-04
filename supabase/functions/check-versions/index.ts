import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { load } from 'https://esm.sh/cheerio@1.0.0-rc.12';
import OpenAI from 'https://esm.sh/openai@4.28.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openaiKey = Deno.env.get('OPENAI_API_KEY')!;

const supabase = createClient(supabaseUrl, supabaseKey);
const openai = new OpenAI({ apiKey: openaiKey });

async function scrapeVersion(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const html = await response.text();
    const $ = load(html);
    
    // Remove unnecessary elements
    $('script, style, noscript, iframe, nav, footer').remove();
    
    // Try meta tags first
    const metaVersion = $('meta[name*="version"], meta[property*="version"]').attr('content');
    if (metaVersion) return metaVersion;
    
    // Look for version-specific elements
    const versionText = $('[class*="version"], [id*="version"], [data-version], .version, #version').text();
    if (versionText) return versionText;
    
    // Get main content as fallback
    return $('body').text();
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return null;
  }
}

async function extractVersion(name: string, content: string): Promise<string | null> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "Extract ONLY the version number from the text. Return null if no version is found."
        },
        {
          role: "user",
          content: `Find the latest version number for ${name} from this text: ${content.substring(0, 2000)}`
        }
      ],
      temperature: 0.1,
      max_tokens: 20
    });

    const version = completion.choices[0].message.content?.trim();
    return version === 'null' ? null : version;
  } catch (error) {
    console.error(`Error extracting version for ${name}:`, error);
    return null;
  }
}

async function notifyUsers(softwareId: string, name: string, version: string) {
  const { data: trackers } = await supabase
    .from('tracked_software')
    .select('user_id')
    .eq('software_id', softwareId);

  if (!trackers) return;

  for (const tracker of trackers) {
    await supabase.from('notifications').insert({
      user_id: tracker.user_id,
      software_id: softwareId,
      message: `New version ${version} available for ${name}`,
      type: 'version_update'
    });
  }
}

serve(async () => {
  try {
    const { data: software } = await supabase
      .from('software')
      .select('*');

    if (!software) {
      throw new Error('No software found');
    }

    for (const item of software) {
      try {
        const content = await scrapeVersion(item.website);
        if (!content) continue;

        const version = await extractVersion(item.name, content);
        if (!version || version === item.current_version) continue;

        // Store version history
        await supabase
          .from('software_versions')
          .insert({
            software_id: item.id,
            version,
            detected_at: new Date().toISOString()
          });

        // Update current version
        await supabase
          .from('software')
          .update({ current_version: version })
          .eq('id', item.id);

        // Notify users
        await notifyUsers(item.id, item.name, version);

        // Log successful check
        await supabase
          .from('version_checks')
          .insert({
            software_id: item.id,
            status: 'success',
            detected_version: version,
            current_version: item.current_version
          });
      } catch (error) {
        console.error(`Error checking ${item.name}:`, error);
        
        // Log failed check
        await supabase
          .from('version_checks')
          .insert({
            software_id: item.id,
            status: 'error',
            error: error.message
          });
      }
    }

    return new Response(JSON.stringify({ status: 'success' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});