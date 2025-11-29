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
    $('script, style, noscript, iframe, nav, header, footer, .nav, .header, .footer, .sidebar, .menu').remove();

    let content = '';

    // Try multiple strategies to get clean content
    // Strategy 1: Look for release notes specific elements
    const releaseNotesSelectors = [
      'article',
      'main',
      '[class*="release"]',
      '[id*="release"]',
      '[class*="changelog"]',
      '[id*="changelog"]',
      '[class*="version"]',
      '[id*="version"]',
      '.content',
      '#content',
      '.main-content',
      '#main-content'
    ];

    for (const selector of releaseNotesSelectors) {
      const element = $(selector);
      if (element.length && element.text().trim().length > 100) {
        content = element.text();
        console.log(`Found content using selector: ${selector}`);
        break;
      }
    }

    // Strategy 2: If no specific element found, get body but clean it
    if (!content) {
      content = $('body').text();
    }

    // Clean up the content
    content = content
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n\s*\n/g, '\n') // Remove multiple newlines
      .trim();

    if (!content || content.length < 50) {
      console.error('Insufficient content found. Length:', content.length);
      return res.status(400).json({ error: 'No meaningful content found on page' });
    }

    console.log(`Extracted ${content.length} characters of content`);
    return res.status(200).json({ content });
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
