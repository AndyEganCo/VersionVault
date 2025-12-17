/**
 * Sitemap discovery and parsing for finding release notes pages
 * Supports standard sitemaps, sitemap indexes, and compressed sitemaps
 */

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  priority?: number;
  relevanceScore: number;  // Our calculated score for release relevance
}

/**
 * Discovers and parses sitemap to find URLs likely containing release notes
 */
export async function discoverReleaseUrls(
  websiteUrl: string,
  maxUrls: number = 5
): Promise<SitemapUrl[]> {
  console.log(`🗺️ Discovering sitemap for: ${websiteUrl}`);

  try {
    const baseUrl = new URL(websiteUrl);
    const sitemapUrls = await findSitemapUrls(baseUrl);

    if (sitemapUrls.length === 0) {
      console.log('⚠️ No sitemap found');
      return [];
    }

    console.log(`📍 Found ${sitemapUrls.length} sitemap(s) to check`);

    // Fetch and parse all sitemaps
    const allUrls: SitemapUrl[] = [];

    for (const sitemapUrl of sitemapUrls) {
      try {
        const urls = await parseSitemap(sitemapUrl);
        allUrls.push(...urls);
      } catch (error) {
        console.warn(`⚠️ Failed to parse sitemap ${sitemapUrl}: ${error.message}`);
      }
    }

    console.log(`📋 Found ${allUrls.length} total URLs in sitemaps`);

    // Filter and rank URLs by relevance to releases
    const releaseUrls = filterAndRankReleaseUrls(allUrls);

    console.log(`✅ Found ${releaseUrls.length} release-related URLs`);

    // Return top N URLs
    return releaseUrls.slice(0, maxUrls);
  } catch (error) {
    console.error(`❌ Sitemap discovery failed: ${error.message}`);
    return [];
  }
}

/**
 * Find sitemap URLs (supports sitemap.xml, sitemap_index.xml, robots.txt)
 */
async function findSitemapUrls(baseUrl: URL): Promise<string[]> {
  const sitemapCandidates = [
    new URL('/sitemap.xml', baseUrl.origin).href,
    new URL('/sitemap_index.xml', baseUrl.origin).href,
    new URL('/sitemap-index.xml', baseUrl.origin).href,
  ];

  const foundSitemaps: string[] = [];

  // Try common sitemap locations
  for (const candidate of sitemapCandidates) {
    try {
      const response = await fetch(candidate, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'VersionVault/1.0 (+https://versionvault.dev)',
        },
      });

      if (response.ok) {
        console.log(`✅ Found sitemap: ${candidate}`);
        foundSitemaps.push(candidate);
      }
    } catch (error) {
      // Silently skip - this is expected for non-existent sitemaps
    }
  }

  // If no sitemaps found, try robots.txt
  if (foundSitemaps.length === 0) {
    try {
      const robotsUrl = new URL('/robots.txt', baseUrl.origin).href;
      const response = await fetch(robotsUrl, {
        headers: {
          'User-Agent': 'VersionVault/1.0 (+https://versionvault.dev)',
        },
      });

      if (response.ok) {
        const robotsTxt = await response.text();
        const sitemapMatches = robotsTxt.matchAll(/Sitemap:\s*(.+)/gi);

        for (const match of sitemapMatches) {
          const sitemapUrl = match[1].trim();
          console.log(`✅ Found sitemap in robots.txt: ${sitemapUrl}`);
          foundSitemaps.push(sitemapUrl);
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch robots.txt');
    }
  }

  return foundSitemaps;
}

/**
 * Parse a sitemap XML file
 */
async function parseSitemap(sitemapUrl: string): Promise<SitemapUrl[]> {
  console.log(`📄 Parsing sitemap: ${sitemapUrl}`);

  try {
    const response = await fetch(sitemapUrl, {
      headers: {
        'User-Agent': 'VersionVault/1.0 (+https://versionvault.dev)',
        'Accept': 'application/xml, text/xml, application/x-gzip',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    let xml = await response.text();

    // Check if this is a sitemap index (contains links to other sitemaps)
    if (xml.includes('<sitemapindex')) {
      console.log('📑 Detected sitemap index, fetching child sitemaps...');
      return await parseSitemapIndex(xml);
    }

    // Parse regular sitemap
    return parseSitemapUrls(xml);
  } catch (error) {
    throw new Error(`Failed to fetch sitemap: ${error.message}`);
  }
}

/**
 * Parse a sitemap index file (which points to other sitemaps)
 */
async function parseSitemapIndex(xml: string): Promise<SitemapUrl[]> {
  const sitemapRegex = /<loc>([^<]+)<\/loc>/g;
  const sitemapUrls: string[] = [];

  let match;
  while ((match = sitemapRegex.exec(xml)) !== null) {
    sitemapUrls.push(match[1]);
  }

  console.log(`📚 Found ${sitemapUrls.length} child sitemaps`);

  const allUrls: SitemapUrl[] = [];

  // Fetch child sitemaps (limit to first 5 to avoid too many requests)
  for (const sitemapUrl of sitemapUrls.slice(0, 5)) {
    try {
      const urls = await parseSitemap(sitemapUrl);
      allUrls.push(...urls);
    } catch (error) {
      console.warn(`⚠️ Failed to parse child sitemap ${sitemapUrl}`);
    }
  }

  return allUrls;
}

/**
 * Parse URLs from sitemap XML
 */
function parseSitemapUrls(xml: string): SitemapUrl[] {
  const urls: SitemapUrl[] = [];

  // Match <url> blocks in sitemap
  const urlBlockRegex = /<url>(.*?)<\/url>/gs;
  let urlMatch;

  while ((urlMatch = urlBlockRegex.exec(xml)) !== null) {
    const urlBlock = urlMatch[1];

    // Extract loc (required)
    const locMatch = urlBlock.match(/<loc>([^<]+)<\/loc>/);
    if (!locMatch) continue;

    const loc = locMatch[1].trim();

    // Extract lastmod (optional)
    const lastmodMatch = urlBlock.match(/<lastmod>([^<]+)<\/lastmod>/);
    const lastmod = lastmodMatch ? lastmodMatch[1].trim() : undefined;

    // Extract priority (optional)
    const priorityMatch = urlBlock.match(/<priority>([^<]+)<\/priority>/);
    const priority = priorityMatch ? parseFloat(priorityMatch[1]) : undefined;

    urls.push({
      loc,
      lastmod,
      priority,
      relevanceScore: 0,  // Will be calculated later
    });
  }

  console.log(`📋 Parsed ${urls.length} URLs from sitemap`);
  return urls;
}

/**
 * Filter and rank URLs by relevance to release notes
 */
function filterAndRankReleaseUrls(urls: SitemapUrl[]): SitemapUrl[] {
  // Keywords that indicate release-related content
  const highValueKeywords = [
    'release-notes',
    'release_notes',
    'releasenotes',
    'changelog',
    'change-log',
    'whatsnew',
    'whats-new',
    'updates',
    'version-history',
    'versions',
  ];

  const mediumValueKeywords = [
    'releases',
    'download',
    'downloads',
    'news',
    'announcements',
  ];

  const lowValueKeywords = [
    'blog',
    'update',
    'version',
  ];

  // Score each URL
  for (const url of urls) {
    const urlLower = url.loc.toLowerCase();
    let score = 0;

    // High value keywords (exact match in path)
    for (const keyword of highValueKeywords) {
      if (urlLower.includes(keyword)) {
        score += 100;
        break;  // Only count once
      }
    }

    // Medium value keywords
    for (const keyword of mediumValueKeywords) {
      if (urlLower.includes(keyword)) {
        score += 50;
        break;
      }
    }

    // Low value keywords
    for (const keyword of lowValueKeywords) {
      if (urlLower.includes(keyword)) {
        score += 25;
      }
    }

    // Bonus for sitemap priority
    if (url.priority && url.priority >= 0.8) {
      score += 20;
    }

    // Bonus for recent lastmod
    if (url.lastmod) {
      try {
        const lastmodDate = new Date(url.lastmod);
        const now = new Date();
        const daysSince = (now.getTime() - lastmodDate.getTime()) / (1000 * 60 * 60 * 24);

        // Bonus for pages modified in last 6 months
        if (daysSince < 180) {
          score += 10;
        }
      } catch (e) {
        // Invalid date, skip
      }
    }

    // Penalty for very long URLs (likely not main release page)
    if (url.loc.length > 100) {
      score -= 10;
    }

    // Penalty for URLs with dates in path (likely individual blog posts)
    if (/\/\d{4}\/\d{2}\//.test(url.loc)) {
      score -= 30;
    }

    url.relevanceScore = score;
  }

  // Filter to only URLs with positive relevance score
  const relevant = urls.filter(url => url.relevanceScore > 0);

  // Sort by relevance score (highest first)
  relevant.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return relevant;
}
