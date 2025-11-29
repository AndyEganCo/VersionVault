import type { VercelRequest, VercelResponse } from '@vercel/node';
import { load } from 'cheerio';

/**
 * Server-side URL scraper to avoid CORS issues
 * This endpoint fetches and scrapes a URL, returning the text content
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    console.log('Scraping URL:', url);

    // Fetch the URL
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
      return res.status(response.status).json({
        error: `HTTP error: ${response.status} ${response.statusText}`
      });
    }

    const html = await response.text();
    const $ = load(html);

    // Remove unnecessary elements
    $('script, style, noscript, iframe').remove();

    // Try to find version information in meta tags first
    const metaVersion = $('meta[name*="version"], meta[property*="version"]').attr('content');
    if (metaVersion) {
      return res.status(200).json({ content: metaVersion });
    }

    // Look for version information in specific elements
    const versionElements = $('[class*="version"], [id*="version"], [data-version], .version, #version');
    if (versionElements.length) {
      return res.status(200).json({ content: versionElements.text() });
    }

    // Get main content as fallback
    const mainContent = $('main, article, .content, #content').text();
    if (mainContent && mainContent.trim()) {
      return res.status(200).json({ content: mainContent });
    }

    // Last resort: get body text
    const bodyText = $('body').text();
    if (!bodyText.trim()) {
      return res.status(400).json({ error: 'No content found on page' });
    }

    return res.status(200).json({ content: bodyText });
  } catch (error) {
    console.error('Error scraping URL:', error);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return res.status(408).json({ error: 'Request timed out' });
      }
      return res.status(500).json({ error: error.message });
    }

    return res.status(500).json({ error: 'Failed to scrape URL' });
  }
}
