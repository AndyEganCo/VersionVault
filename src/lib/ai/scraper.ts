import * as cheerio from 'cheerio';

export async function scrapeWebsite(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Remove unnecessary elements
    $('script, style, noscript, iframe').remove();
    
    // Try to find version information in meta tags first
    const metaVersion = $('meta[name*="version"], meta[property*="version"]').attr('content');
    if (metaVersion) {
      return metaVersion;
    }
    
    // Look for version information in specific elements
    const versionElements = $('[class*="version"], [id*="version"], [data-version], .version, #version');
    if (versionElements.length) {
      return versionElements.text();
    }
    
    // Get main content as fallback
    const mainContent = $('main, article, .content, #content').text();
    if (mainContent) {
      return mainContent;
    }
    
    // Last resort: get body text
    const bodyText = $('body').text();
    if (!bodyText.trim()) {
      throw new Error('No content found on page');
    }
    
    return bodyText;
  } catch (error) {
    const err = error as Error;
    console.error('Error:', err.message);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  }
}