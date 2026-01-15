/**
 * Smart Content Extraction Utilities
 * Intelligently extracts relevant portions of page content based on product name and version patterns
 */

export interface ContentWindow {
  content: string;
  startPosition: number;
  endPosition: number;
  matchedTerm: string;
  matchType?: 'version' | 'product' | 'both';
}

/**
 * Find version number patterns in content
 * Looks for patterns like: "Version 27.1", "v27.1.0", "27.1", etc.
 */
export function findVersionPatterns(
  content: string
): Array<{ position: number; matchedTerm: string }> {
  const matches: Array<{ position: number; matchedTerm: string }> = [];

  // Version patterns to search for
  const versionRegexes = [
    // "Version 27.1" or "version 27.1"
    /\bversion\s+(\d+\.[\d.]+)/gi,
    // "v27.1" or "V27.1"
    /\bv(\d+\.[\d.]+)/gi,
    // "(Version 27.1)" - often in headings
    /\(version\s+(\d+\.[\d.]+)\)/gi,
    // Standalone version numbers in headings (e.g., "27.1" or "27.1.0")
    // Must be followed by release notes context
    /\b(\d{1,3}\.\d{1,3}(?:\.\d{1,3})?)\b(?=\s*(?:release|update|changelog|notes|fixes|features|improvements))/gi,
    // Month Year (Version X.Y) - Adobe style
    /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\s*\(version\s+(\d+\.[\d.]+)\)/gi,
  ];

  for (const regex of versionRegexes) {
    let match: RegExpExecArray | null;
    const regexCopy = new RegExp(regex.source, regex.flags);

    while ((match = regexCopy.exec(content)) !== null) {
      matches.push({
        position: match.index,
        matchedTerm: match[0],
      });
    }
  }

  // Sort by position and remove duplicates (same or very close positions)
  return matches
    .sort((a, b) => a.position - b.position)
    .filter((match, index, arr) => {
      if (index === 0) return true;
      // Remove if within 50 chars of previous match (likely same version)
      return match.position - arr[index - 1].position > 50;
    });
}

/**
 * Generate product name variants to search for
 * e.g., "Teranex" → ["Teranex", "Teranex Mini", "Teranex 3D", "Teranex AV"]
 */
export function generateProductVariants(productName: string): string[] {
  const variants: string[] = [productName];

  // Common suffixes for product families
  const suffixes = [
    'Mini', 'Pro', 'Max', 'Studio', 'Extreme', 'Plus',
    '4K', '8K', '12K', 'HD', 'SDI', 'HDMI',
    'AV', '2', '3', '4', 'II', 'III', 'IV',
    'ISO', 'Broadcast', 'Production'
  ];

  // Add variants with each suffix
  for (const suffix of suffixes) {
    variants.push(`${productName} ${suffix}`);
  }

  return variants;
}

/**
 * Find all occurrences of product name (or variants) in content
 * Returns positions where the product is mentioned
 */
export function findProductMentions(
  content: string,
  productName: string
): Array<{ position: number; matchedTerm: string }> {
  const normalizedContent = content.toLowerCase();
  const variants = generateProductVariants(productName);
  const mentions: Array<{ position: number; matchedTerm: string }> = [];

  for (const variant of variants) {
    const normalizedVariant = variant.toLowerCase();
    let position = 0;

    while (true) {
      position = normalizedContent.indexOf(normalizedVariant, position);
      if (position === -1) break;

      mentions.push({
        position,
        matchedTerm: variant,
      });

      position += normalizedVariant.length;
    }
  }

  // Sort by position and remove duplicates (same position)
  return mentions
    .sort((a, b) => a.position - b.position)
    .filter((mention, index, arr) => {
      if (index === 0) return true;
      return mention.position !== arr[index - 1].position;
    });
}

/**
 * Extract content windows around product mentions
 * Returns chunks of content centered on where the product is mentioned
 */
export function extractContentWindows(
  content: string,
  productName: string,
  windowSize: number = 5000,
  maxWindows: number = 5
): ContentWindow[] {
  const mentions = findProductMentions(content, productName);

  if (mentions.length === 0) {
    console.log(`⚠️ Product "${productName}" not found in content`);
    return [];
  }

  console.log(`✅ Found ${mentions.length} mentions of product variants`);

  const windows: ContentWindow[] = [];

  // Extract windows around each mention
  for (let i = 0; i < Math.min(mentions.length, maxWindows); i++) {
    const mention = mentions[i];
    const halfWindow = Math.floor(windowSize / 2);

    const startPosition = Math.max(0, mention.position - halfWindow);
    const endPosition = Math.min(content.length, mention.position + halfWindow);

    windows.push({
      content: content.substring(startPosition, endPosition),
      startPosition,
      endPosition,
      matchedTerm: mention.matchedTerm,
    });

    console.log(`  Window ${i + 1}: chars ${startPosition}-${endPosition} (matched "${mention.matchedTerm}")`);
  }

  return windows;
}

/**
 * Create optimized content for AI extraction
 * Combines windows with context and deduplication
 */
export function createOptimizedContent(
  windows: ContentWindow[],
  maxTotalChars: number = 30000
): string {
  if (windows.length === 0) {
    return '';
  }

  // If we only have one window, return it
  if (windows.length === 1) {
    return windows[0].content.substring(0, maxTotalChars);
  }

  // Combine windows with separators
  let combined = '';
  const separator = '\n\n--- SECTION ---\n\n';

  for (const window of windows) {
    if (combined.length + window.content.length + separator.length > maxTotalChars) {
      // Add as much of this window as we can
      const remaining = maxTotalChars - combined.length - separator.length;
      if (remaining > 500) {
        combined += separator + window.content.substring(0, remaining);
      }
      break;
    }

    if (combined.length > 0) {
      combined += separator;
    }
    combined += window.content;
  }

  return combined;
}

/**
 * Extract windows around version patterns
 * Similar to extractContentWindows but focuses on version numbers
 */
export function extractVersionWindows(
  content: string,
  windowSize: number = 5000,
  maxWindows: number = 5
): ContentWindow[] {
  const versionMatches = findVersionPatterns(content);

  if (versionMatches.length === 0) {
    return [];
  }

  console.log(`✅ Found ${versionMatches.length} version patterns`);

  const windows: ContentWindow[] = [];

  for (let i = 0; i < Math.min(versionMatches.length, maxWindows); i++) {
    const match = versionMatches[i];
    const halfWindow = Math.floor(windowSize / 2);

    const startPosition = Math.max(0, match.position - halfWindow);
    const endPosition = Math.min(content.length, match.position + halfWindow);

    windows.push({
      content: content.substring(startPosition, endPosition),
      startPosition,
      endPosition,
      matchedTerm: match.matchedTerm,
      matchType: 'version',
    });

    console.log(`  Window ${i + 1}: chars ${startPosition}-${endPosition} (version: "${match.matchedTerm}")`);
  }

  return windows;
}

/**
 * Extract windows that contain BOTH product mentions AND version patterns
 * This is ideal for multi-product download pages where we need to filter by product
 */
export function extractProductVersionWindows(
  content: string,
  productName: string,
  windowSize: number = 5000,
  maxWindows: number = 15
): ContentWindow[] {
  const versionMatches = findVersionPatterns(content);
  const productMentions = findProductMentions(content, productName);

  if (versionMatches.length === 0 || productMentions.length === 0) {
    return [];
  }

  console.log(`✅ Found ${versionMatches.length} version patterns and ${productMentions.length} product mentions`);

  // Find version patterns that are near product mentions
  const productVersionWindows: ContentWindow[] = [];

  for (const versionMatch of versionMatches) {
    // Check if any product mention is within windowSize of this version
    const nearbyProduct = productMentions.find(productMention => {
      const distance = Math.abs(versionMatch.position - productMention.position);
      return distance < windowSize;
    });

    if (nearbyProduct) {
      // This version is near a product mention - create a window around the version
      const halfWindow = Math.floor(windowSize / 2);
      const startPosition = Math.max(0, versionMatch.position - halfWindow);
      const endPosition = Math.min(content.length, versionMatch.position + halfWindow);

      productVersionWindows.push({
        content: content.substring(startPosition, endPosition),
        startPosition,
        endPosition,
        matchedTerm: versionMatch.matchedTerm,
        matchType: 'both',
      });

      // Stop if we have enough windows
      if (productVersionWindows.length >= maxWindows) {
        break;
      }
    }
  }

  if (productVersionWindows.length > 0) {
    console.log(`✅ Found ${productVersionWindows.length} windows with both product and version`);
    for (let i = 0; i < Math.min(5, productVersionWindows.length); i++) {
      const window = productVersionWindows[i];
      console.log(`  Window ${i + 1}: chars ${window.startPosition}-${window.endPosition} (version: "${window.matchedTerm}")`);
    }
  }

  return productVersionWindows;
}

/**
 * Smart content extraction - PRODUCT-VERSION STRATEGY
 * 1. First tries to find windows with BOTH product name AND version patterns (best for multi-product pages)
 * 2. Falls back to version patterns alone (best for single-product release notes pages)
 * 3. Falls back to product name mentions if no versions found
 * 4. Returns optimized content for AI analysis
 */
export function extractSmartContent(
  fullContent: string,
  productName: string,
  maxChars: number = 60000  // Increased from 30000 to capture more versions on long changelog pages
): { content: string; foundProduct: boolean; method: string } {
  console.log(`\n🔍 Smart extraction for "${productName}" (${fullContent.length} total chars)`);

  // STRATEGY 0: Look for windows with BOTH product AND version (best for multi-product downloads pages)
  console.log('📍 Strategy 0: Searching for product+version windows...');
  const productVersionWindows = extractProductVersionWindows(fullContent, productName, 5000, 15);

  if (productVersionWindows.length > 0) {
    // Found windows with both product and version! This is the best case.
    const optimized = createOptimizedContent(productVersionWindows, maxChars);
    console.log(`✅ Product+version extraction: ${optimized.length} chars from ${productVersionWindows.length} windows`);

    return {
      content: optimized,
      foundProduct: true,
      method: 'product_version',
    };
  }

  // STRATEGY 1: Look for version patterns first (best for single-product release notes pages)
  console.log('📍 Strategy 1: Searching for version patterns...');
  const versionWindows = extractVersionWindows(fullContent, 5000, 15);  // Increased from 5 to 15 windows to capture more versions

  if (versionWindows.length > 0) {
    // Found versions! Use those windows
    const optimized = createOptimizedContent(versionWindows, maxChars);
    console.log(`✅ Version-first extraction: ${optimized.length} chars from ${versionWindows.length} windows`);

    return {
      content: optimized,
      foundProduct: true, // Assume product is in version windows
      method: 'version_first',
    };
  }

  // STRATEGY 2: Look for product name mentions (fallback)
  console.log('📍 Strategy 2: Searching for product mentions...');
  const productWindows = extractContentWindows(fullContent, productName, 5000, 15);  // Increased from 5 to 15 windows

  if (productWindows.length > 0) {
    const optimized = createOptimizedContent(productWindows, maxChars);
    console.log(`✅ Product-based extraction: ${optimized.length} chars from ${productWindows.length} windows`);

    return {
      content: optimized,
      foundProduct: true,
      method: 'product_mentions',
    };
  }

  // STRATEGY 3: Return first chunk (no versions or product mentions found)
  console.log('⚠️ Falling back to first chunk (no versions or product mentions found)');
  return {
    content: fullContent.substring(0, maxChars),
    foundProduct: false,
    method: 'fallback_first_chunk',
  };
}
