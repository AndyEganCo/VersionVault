// Secure client-side interface for software info extraction
// All AI processing happens server-side to protect API keys

export interface ExtractedSoftwareInfo {
  manufacturer: string;
  category: string;
  currentVersion?: string;
  releaseDate?: string;
  isJavaScriptPage?: boolean;      // True if page likely needs browser rendering
  lowContentWarning?: string;       // Warning message for manual checking
}

/**
 * Extracts software information using server-side AI processing
 * This is now secure - no API keys exposed to the browser!
 */
export async function extractSoftwareInfo(
  name: string,
  website: string,
  versionUrl: string,
  description?: string
): Promise<ExtractedSoftwareInfo> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase configuration not found');
    }

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/extract-software-info`;

    console.log(`Extracting info for: ${name}`);

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        name,
        website,
        versionUrl,
        description
      })
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const extracted = await response.json() as ExtractedSoftwareInfo;

    // Validate the response
    if (!extracted.manufacturer || !extracted.category) {
      throw new Error('Invalid response from server');
    }

    console.log('Extraction successful:', extracted);
    return extracted;

  } catch (error) {
    console.error('Error extracting software info:', error);

    // Fallback: extract from domain name
    const fallback = extractFromDomain(website);
    return fallback;
  }
}

/**
 * Fallback method to extract info from domain if AI fails
 */
function extractFromDomain(website: string): ExtractedSoftwareInfo {
  try {
    const url = new URL(website);
    const domain = url.hostname.replace('www.', '');
    const parts = domain.split('.');

    // Extract manufacturer from domain
    let manufacturer = parts[0];
    manufacturer = manufacturer.charAt(0).toUpperCase() + manufacturer.slice(1);

    return {
      manufacturer,
      category: 'Show Control' // Default category
    };
  } catch {
    return {
      manufacturer: 'Unknown',
      category: 'Show Control'
    };
  }
}
