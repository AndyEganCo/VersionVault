import * as cheerio from 'cheerio';

export async function scrapeWebsite(url: string): Promise<{ content: string; source: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache'
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove unnecessary elements
    $('script, style, noscript, iframe, nav, footer').remove();

    // Try meta tags first (highest priority)
    const metaVersion = $('meta[name*="version"], meta[property*="version"]').attr('content');
    if (metaVersion) {
      return { content: metaVersion, source: 'meta' };
    }

    // Look for download sections (high priority)
    const downloadSection = $('a[href*="download"], button:contains("Download")').parent();
    if (downloadSection.length) {
      return { content: downloadSection.text(), source: 'download-section' };
    }

    // Look for version-specific elements (medium priority)
    const versionSelectors = [
      '[class*="version"]',
      '[id*="version"]',
      '[data-version]',
      '.version',
      '#version',
      '.release-version',
      '.current-version',
      '.latest-version',
      '[class*="release"]',
      '[id*="release"]'
    ];

    const versionElements = $(versionSelectors.join(', '));
    if (versionElements.length) {
      const versionText = versionElements.map((_, el) => $(el).text()).get().join(' ');
      return { content: versionText, source: 'version-element' };
    }

    // Try main content areas (low priority)
    const mainContent = $('main, article, .content, #content, .main-content').text();
    if (mainContent.trim()) {
      return { content: mainContent.trim(), source: 'main-content' };
    }

    // Last resort: get body text
    const bodyText = $('body').text().trim();
    if (!bodyText) {
      throw new Error('No content found on page');
    }

    return { content: bodyText, source: 'body' };
  } catch (err) {
    const error = err instanceof Error ? err : new Error('Unknown error occurred');
    console.error('Scraping error:', error);
    throw error;
  }
}