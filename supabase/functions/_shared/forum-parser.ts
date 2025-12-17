/**
 * Forum scraping with intelligent topic filtering
 * Supports phpBB, Discourse, and generic forum types
 */

import { DOMParser } from 'https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts';

export interface ForumConfig {
  forumType?: 'phpbb' | 'discourse' | 'generic';
  stickyOnly?: boolean;
  officialAuthor?: string;
  titlePattern?: string;  // Regex string, e.g., "^Release of"
}

export interface ForumTopic {
  title: string;
  link: string;
  author: string;
  isSticky: boolean;
  replies: number;
}

/**
 * Fetches forum content with topic filtering
 * Returns the first official release topic's content
 */
export async function fetchForumContent(
  forumUrl: string,
  config: ForumConfig = {},
  useBrowserless: boolean = false
): Promise<string> {
  console.log(`🗨️ Fetching forum: ${forumUrl}`);
  console.log(`Config:`, JSON.stringify(config, null, 2));

  try {
    // Step 1: Fetch forum index page
    const indexHtml = await fetchForumIndex(forumUrl, useBrowserless);

    console.log(`📄 Fetched ${indexHtml.length} characters from forum`);
    console.log(`HTML preview (first 500 chars): ${indexHtml.substring(0, 500)}`);

    if (!indexHtml || indexHtml.length < 500) {
      console.warn('⚠️ Forum index has very low content, may need Browserless');
      if (!useBrowserless) {
        console.log('🔄 Retrying with Browserless...');
        return await fetchForumContent(forumUrl, config, true);
      }
    }

    // Step 2: Parse topics from index
    const forumType = config.forumType || detectForumType(forumUrl, indexHtml);
    console.log(`Detected forum type: ${forumType}`);

    const topics = parseForumTopics(indexHtml, forumType, forumUrl);
    console.log(`📋 Found ${topics.length} total topics`);

    if (topics.length === 0) {
      console.warn('⚠️ No topics found on forum index page');
      return '';
    }

    // Step 3: Filter to official release topics
    const officialTopics = filterOfficialTopics(topics, config);
    console.log(`✅ Found ${officialTopics.length} official topics after filtering`);

    if (officialTopics.length === 0) {
      console.warn('⚠️ No official topics found after filtering');
      console.warn(`Filters applied: ${JSON.stringify(config)}`);
      console.warn(`Sample topics found: ${topics.slice(0, 3).map(t => t.title).join(', ')}`);
      return '';
    }

    // Step 4: Fetch first topic's content (first post only)
    console.log(`📖 Fetching content from: ${officialTopics[0].title}`);
    const topicContent = await fetchTopicContent(
      officialTopics[0].link,
      forumType,
      useBrowserless
    );

    return topicContent;
  } catch (error) {
    console.error(`❌ Forum fetch failed for ${forumUrl}:`, error);
    throw error;
  }
}

/**
 * Fetch forum index page
 */
async function fetchForumIndex(url: string, useBrowserless: boolean): Promise<string> {
  if (useBrowserless) {
    const apiKey = Deno.env.get('BROWSERLESS_API_KEY');
    if (!apiKey) {
      console.warn('BROWSERLESS_API_KEY not set, falling back to regular fetch');
      return await fetchForumIndex(url, false);
    }

    const browserlessUrl = `https://chrome.browserless.io/content?token=${apiKey}&stealth=true`;

    const response = await fetch(browserlessUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: url,
        setExtraHTTPHeaders: {
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Browserless error: ${response.status}`);
    }

    return await response.text();
  } else {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    return await response.text();
  }
}

/**
 * Detect forum type from URL and HTML content
 */
function detectForumType(url: string, html: string): 'phpbb' | 'discourse' | 'generic' {
  // phpBB detection
  if (url.includes('viewforum.php') ||
      html.includes('phpBB') ||
      html.includes('class="topiclist"')) {
    return 'phpbb';
  }

  // Discourse detection
  if (html.includes('discourse') ||
      html.includes('data-discourse') ||
      html.includes('class="topic-list"')) {
    return 'discourse';
  }

  return 'generic';
}

/**
 * Parse topics from forum HTML
 */
function parseForumTopics(
  html: string,
  forumType: 'phpbb' | 'discourse' | 'generic',
  baseUrl: string
): ForumTopic[] {
  if (forumType === 'phpbb') {
    return parsePhpBBTopics(html, baseUrl);
  } else if (forumType === 'discourse') {
    return parseDiscourseTopics(html, baseUrl);
  } else {
    return parseGenericTopics(html, baseUrl);
  }
}

/**
 * Parse phpBB forum topics (like Blackmagic Design forums)
 */
function parsePhpBBTopics(html: string, baseUrl: string): ForumTopic[] {
  const topics: ForumTopic[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  if (!doc) {
    console.warn('Failed to parse HTML with DOMParser, trying regex fallback');
    return parsePhpBBTopicsRegex(html, baseUrl);
  }

  // Try multiple selector strategies for phpBB variations
  let topicRows = doc.querySelectorAll('.topiclist .row');

  if (topicRows.length === 0) {
    console.log('No topics found with .topiclist .row, trying alternative selectors...');
    topicRows = doc.querySelectorAll('.forumbg .topics li, .topiclist li, ul.topics li');
  }

  if (topicRows.length === 0) {
    console.log('Still no topics with DOM selectors, trying regex fallback');
    return parsePhpBBTopicsRegex(html, baseUrl);
  }

  console.log(`Found ${topicRows.length} potential topic rows`);

  for (const row of topicRows) {
    try {
      // Find topic title and link - try multiple selectors
      let titleLink = row.querySelector('.topictitle, a.topictitle');

      if (!titleLink) {
        // Try alternative selectors
        titleLink = row.querySelector('a[href*="viewtopic"]');
      }

      if (!titleLink) {
        console.log('Skipping row - no title link found');
        continue;
      }

      const title = titleLink.textContent?.trim() || '';
      if (!title || title.length < 3) {
        console.log('Skipping row - title too short or empty');
        continue;
      }

      const relativeLink = titleLink.getAttribute('href') || '';
      const link = makeAbsoluteUrl(relativeLink, baseUrl);

      // Check if sticky/announcement
      const rowHtml = row.outerHTML || '';
      const classList = row.getAttribute('class') || '';
      const isSticky = classList.includes('sticky') ||
                       classList.includes('announce') ||
                       classList.includes('global-announce') ||
                       rowHtml.includes('icon_topic_pinned') ||
                       rowHtml.includes('icon-announce');

      // Find author (in .topic-poster or similar)
      const authorElem = row.querySelector('.topic-poster a, .username, .author');
      const author = authorElem?.textContent?.trim() || '';

      // Find reply count
      const repliesElem = row.querySelector('.posts, .replies');
      const repliesText = repliesElem?.textContent?.trim() || '0';
      const replies = parseInt(repliesText) || 0;

      console.log(`Found topic: "${title}" (sticky: ${isSticky})`);

      topics.push({
        title,
        link,
        author,
        isSticky,
        replies,
      });
    } catch (error) {
      console.warn('Error parsing topic row:', error);
    }
  }

  console.log(`Parsed ${topics.length} phpBB topics from DOM`);
  return topics;
}

/**
 * Fallback regex-based phpBB parser
 */
function parsePhpBBTopicsRegex(html: string, baseUrl: string): ForumTopic[] {
  const topics: ForumTopic[] = [];

  // Try multiple regex patterns to catch different phpBB structures

  // Pattern 1: <a class="topictitle" href="...">Title</a>
  const pattern1 = /<a\s+[^>]*class="[^"]*topictitle[^"]*"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;

  // Pattern 2: <a href="./viewtopic.php?...">Title</a> (any link to viewtopic)
  const pattern2 = /<a\s+[^>]*href="([^"]*viewtopic[^"]+)"[^>]*>([^<]+)<\/a>/gi;

  const patterns = [pattern1, pattern2];

  for (const topicRegex of patterns) {
    let match;
    const seenTitles = new Set<string>(); // Avoid duplicates

    while ((match = topicRegex.exec(html)) !== null) {
      const relativeLink = match[1];
      const title = match[2].trim();

      // Skip if we've already seen this title (from a different pattern)
      if (seenTitles.has(title)) continue;
      seenTitles.add(title);

      // Skip navigation/UI links
      if (title.length < 5 || /^(View|Post|Reply|Quote|Edit|Delete|Report)$/i.test(title)) {
        continue;
      }

      const link = makeAbsoluteUrl(relativeLink, baseUrl);

      // Check for sticky in surrounding context
      const contextStart = Math.max(0, match.index - 500);
      const contextEnd = Math.min(html.length, match.index + 500);
      const context = html.substring(contextStart, contextEnd);

      const isSticky = /class="[^"]*\b(sticky|announce|global-announce)\b[^"]*"/i.test(context) ||
                       context.includes('icon_topic_pinned') ||
                       context.includes('icon-announce');

      console.log(`Regex found topic: "${title}" (sticky: ${isSticky})`);

      topics.push({
        title,
        link,
        author: '',  // Can't reliably extract with regex
        isSticky,
        replies: 0,
      });
    }
  }

  console.log(`Parsed ${topics.length} phpBB topics (regex fallback)`);
  return topics;
}

/**
 * Parse Discourse forum topics
 */
function parseDiscourseTopics(html: string, baseUrl: string): ForumTopic[] {
  const topics: ForumTopic[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  if (!doc) return [];

  const topicRows = doc.querySelectorAll('.topic-list-item, tr.topic-list-item');

  for (const row of topicRows) {
    const titleLink = row.querySelector('.title a, .main-link a');
    if (!titleLink) continue;

    const title = titleLink.textContent?.trim() || '';
    const relativeLink = titleLink.getAttribute('href') || '';
    const link = makeAbsoluteUrl(relativeLink, baseUrl);

    const isPinned = row.querySelector('.topic-statuses .pinned') !== null;

    topics.push({
      title,
      link,
      author: '',
      isSticky: isPinned,
      replies: 0,
    });
  }

  return topics;
}

/**
 * Generic forum topic parser
 */
function parseGenericTopics(html: string, baseUrl: string): ForumTopic[] {
  const topics: ForumTopic[] = [];

  // Look for links that might be topics
  const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;

  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const link = makeAbsoluteUrl(match[1], baseUrl);
    const title = match[2].trim();

    // Filter out navigation/UI links
    if (title.length < 5 || title.length > 200) continue;
    if (/^(Home|Forum|Login|Register|Search|Profile)$/i.test(title)) continue;

    topics.push({
      title,
      link,
      author: '',
      isSticky: false,
      replies: 0,
    });
  }

  return topics;
}

/**
 * Filter topics to only official releases
 */
function filterOfficialTopics(topics: ForumTopic[], config: ForumConfig): ForumTopic[] {
  return topics.filter((topic) => {
    // Filter 1: Sticky-only mode
    if (config.stickyOnly && !topic.isSticky) {
      return false;
    }

    // Filter 2: Title pattern (e.g., "^Release of")
    if (config.titlePattern) {
      try {
        const pattern = new RegExp(config.titlePattern, 'i');
        if (!pattern.test(topic.title)) {
          return false;
        }
      } catch (e) {
        console.warn(`Invalid title pattern: ${config.titlePattern}`);
      }
    }

    // Filter 3: Official author (e.g., "Blackmagic")
    if (config.officialAuthor && topic.author) {
      if (!topic.author.toLowerCase().includes(config.officialAuthor.toLowerCase())) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Fetch topic content (first post only)
 */
async function fetchTopicContent(
  topicUrl: string,
  forumType: 'phpbb' | 'discourse' | 'generic',
  useBrowserless: boolean
): Promise<string> {
  console.log(`Fetching topic page: ${topicUrl}`);

  const html = await fetchForumIndex(topicUrl, useBrowserless);

  if (forumType === 'phpbb') {
    return extractPhpBBFirstPost(html);
  } else if (forumType === 'discourse') {
    return extractDiscourseFirstPost(html);
  } else {
    return extractGenericFirstPost(html);
  }
}

/**
 * Extract first post from phpBB topic
 */
function extractPhpBBFirstPost(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  if (!doc) {
    return extractPhpBBFirstPostRegex(html);
  }

  // Find first post's content
  const firstPost = doc.querySelector('.post .content, .postbody .content');

  if (!firstPost) {
    console.warn('Could not find first post with DOM parser, trying regex');
    return extractPhpBBFirstPostRegex(html);
  }

  return cleanPostContent(firstPost.textContent || '');
}

/**
 * Fallback regex-based phpBB first post extraction
 */
function extractPhpBBFirstPostRegex(html: string): string {
  // Match: <div class="content">...</div> (first occurrence)
  const contentMatch = html.match(/<div[^>]+class="[^"]*\bcontent\b[^"]*"[^>]*>(.*?)<\/div>/is);

  if (!contentMatch) {
    console.warn('Could not extract first post content');
    return '';
  }

  return cleanPostContent(stripHTMLTags(contentMatch[1]));
}

/**
 * Extract first post from Discourse topic
 */
function extractDiscourseFirstPost(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  if (!doc) return '';

  const firstPost = doc.querySelector('.topic-post:first-child .cooked, .post-stream .cooked:first-child');

  if (!firstPost) {
    console.warn('Could not find first Discourse post');
    return '';
  }

  return cleanPostContent(firstPost.textContent || '');
}

/**
 * Generic first post extraction
 */
function extractGenericFirstPost(html: string): string {
  // Strip HTML and return first 5000 characters
  const text = stripHTMLTags(html);
  return cleanPostContent(text.substring(0, 5000));
}

/**
 * Clean post content (remove excess whitespace, etc.)
 */
function cleanPostContent(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Strip HTML tags from text
 */
function stripHTMLTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * Convert relative URL to absolute
 */
function makeAbsoluteUrl(relativeUrl: string, baseUrl: string): string {
  if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
    return relativeUrl;
  }

  try {
    const base = new URL(baseUrl);

    // Handle ./viewtopic.php style links
    if (relativeUrl.startsWith('./')) {
      return new URL(relativeUrl.substring(2), base.origin + base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1)).href;
    }

    // Handle /viewtopic.php style links
    if (relativeUrl.startsWith('/')) {
      return new URL(relativeUrl, base.origin).href;
    }

    // Handle viewtopic.php style links (relative to current path)
    return new URL(relativeUrl, baseUrl).href;
  } catch (e) {
    console.warn(`Failed to make absolute URL: ${relativeUrl}`);
    return relativeUrl;
  }
}
