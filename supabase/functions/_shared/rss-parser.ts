/**
 * RSS/Atom feed parser for release notes
 * Supports RSS 2.0 and Atom feeds
 */

export interface RSSEntry {
  title: string;
  link: string;
  date: string;
  content: string;
  version?: string;  // Extracted from title if possible
}

/**
 * Fetches and parses an RSS/Atom feed
 * Returns formatted text content ready for AI extraction
 */
export async function fetchRSSContent(
  feedUrl: string,
  maxEntries: number = 10
): Promise<string> {
  console.log(`📡 Fetching RSS feed: ${feedUrl}`);

  try {
    // Fetch the feed
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'VersionVault/1.0 (+https://versionvault.dev)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml',
      },
    });

    if (!response.ok) {
      throw new Error(`RSS fetch failed: ${response.status} ${response.statusText}`);
    }

    const xmlText = await response.text();

    // Parse XML
    const entries = parseRSSEntries(xmlText, maxEntries);

    console.log(`✅ Parsed ${entries.length} RSS entries`);

    if (entries.length === 0) {
      console.warn('⚠️ No entries found in feed');
      return '';
    }

    // Format entries as readable text for AI
    return formatEntriesForAI(entries);
  } catch (error) {
    console.error(`❌ RSS fetch failed for ${feedUrl}:`, error);
    throw error;
  }
}

/**
 * Parse RSS/Atom feed XML into structured entries
 */
function parseRSSEntries(xml: string, max: number): RSSEntry[] {
  const entries: RSSEntry[] = [];

  // Detect feed type
  const isAtom = xml.includes('xmlns="http://www.w3.org/2005/Atom"') ||
                 xml.includes('<feed');

  console.log(`Feed type: ${isAtom ? 'Atom' : 'RSS 2.0'}`);

  if (isAtom) {
    return parseAtomEntries(xml, max);
  } else {
    return parseRSSItems(xml, max);
  }
}

/**
 * Parse Atom feed entries
 */
function parseAtomEntries(xml: string, max: number): RSSEntry[] {
  const entries: RSSEntry[] = [];

  // Match <entry>...</entry>
  const entryRegex = /<entry[^>]*>(.*?)<\/entry>/gs;

  let match;
  while ((match = entryRegex.exec(xml)) !== null && entries.length < max) {
    const entryXml = match[1];

    const entry: RSSEntry = {
      title: extractTag(entryXml, 'title'),
      link: extractAtomLink(entryXml),
      date: extractTag(entryXml, 'updated') || extractTag(entryXml, 'published'),
      content: extractAtomContent(entryXml),
    };

    // Try to extract version from title
    entry.version = extractVersionFromText(entry.title);

    entries.push(entry);
  }

  return entries;
}

/**
 * Parse RSS 2.0 items
 */
function parseRSSItems(xml: string, max: number): RSSEntry[] {
  const entries: RSSEntry[] = [];

  // Match <item>...</item>
  const itemRegex = /<item[^>]*>(.*?)<\/item>/gs;

  let match;
  while ((match = itemRegex.exec(xml)) !== null && entries.length < max) {
    const itemXml = match[1];

    const entry: RSSEntry = {
      title: extractTag(itemXml, 'title'),
      link: extractTag(itemXml, 'link'),
      date: extractTag(itemXml, 'pubDate') || extractTag(itemXml, 'dc:date'),
      content: extractTag(itemXml, 'description') || extractTag(itemXml, 'content:encoded'),
    };

    // Try to extract version from title
    entry.version = extractVersionFromText(entry.title);

    entries.push(entry);
  }

  return entries;
}

/**
 * Extract text content from an XML tag
 */
function extractTag(xml: string, tagName: string): string {
  // Match: <tagName>content</tagName> or <tagName attr="val">content</tagName>
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xml.match(regex);

  if (!match) return '';

  let content = match[1];

  // Decode HTML entities
  content = decodeHTMLEntities(content);

  // Strip CDATA if present
  content = content.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1');

  return content.trim();
}

/**
 * Extract link from Atom entry (handles <link href="..."/>)
 */
function extractAtomLink(xml: string): string {
  // Match: <link href="..." /> or <link href="...">
  const match = xml.match(/<link[^>]+href=["']([^"']+)["']/i);
  return match ? match[1] : '';
}

/**
 * Extract content from Atom entry (prefers <content>, falls back to <summary>)
 */
function extractAtomContent(xml: string): string {
  let content = extractTag(xml, 'content');

  if (!content) {
    content = extractTag(xml, 'summary');
  }

  return content;
}

/**
 * Decode common HTML entities
 */
function decodeHTMLEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&#x27;': "'",
    '&nbsp;': ' ',
  };

  return text.replace(/&[#\w]+;/g, (entity) => entities[entity] || entity);
}

/**
 * Try to extract version number from text (title or content)
 */
function extractVersionFromText(text: string): string | undefined {
  // Common version patterns
  const patterns = [
    /version\s+(\d+\.\d+(?:\.\d+)?)/i,
    /v(\d+\.\d+(?:\.\d+)?)/i,
    /(\d+\.\d+(?:\.\d+)?)\s+(?:release|update)/i,
    /\b(\d+\.\d+(?:\.\d+)?)\b/,  // Fallback: any semver-like number
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return undefined;
}

/**
 * Format RSS entries as text for AI extraction
 */
function formatEntriesForAI(entries: RSSEntry[]): string {
  return entries
    .map((entry, index) => {
      // Strip HTML from content but preserve structure
      let content = stripHTML(entry.content);

      // Limit each entry to reasonable size (AI will see all entries)
      if (content.length > 3000) {
        content = content.substring(0, 3000) + '...';
      }

      return `
=== RELEASE ${index + 1}: ${entry.title} ===
Date: ${entry.date}
Link: ${entry.link}
${entry.version ? `Version: ${entry.version}` : ''}

${content}
      `.trim();
    })
    .join('\n\n--- NEXT RELEASE ---\n\n');
}

/**
 * Strip HTML tags from content while preserving readability
 */
function stripHTML(html: string): string {
  return html
    // Convert <br>, <p>, <div> to newlines
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    // Remove all other HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Clean up whitespace
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}
