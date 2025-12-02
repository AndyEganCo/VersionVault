/**
 * Smart Content Extraction Utilities
 * Intelligently extracts relevant portions of page content based on product name
 */

export interface ContentWindow {
  content: string;
  startPosition: number;
  endPosition: number;
  matchedTerm: string;
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
 * Smart content extraction - finds product mentions and extracts relevant chunks
 * Returns optimized content for AI analysis
 */
export function extractSmartContent(
  fullContent: string,
  productName: string,
  maxChars: number = 30000
): { content: string; foundProduct: boolean; method: string } {
  console.log(`\n🔍 Smart extraction for "${productName}" (${fullContent.length} total chars)`);

  // Find windows around product mentions
  const windows = extractContentWindows(fullContent, productName, 5000, 5);

  if (windows.length === 0) {
    // Product not found - return first chunk as fallback
    console.log('⚠️ Falling back to first chunk (product not found)');
    return {
      content: fullContent.substring(0, maxChars),
      foundProduct: false,
      method: 'fallback_first_chunk',
    };
  }

  // Create optimized content from windows
  const optimized = createOptimizedContent(windows, maxChars);

  console.log(`✅ Smart extraction: ${optimized.length} chars from ${windows.length} windows`);

  return {
    content: optimized,
    foundProduct: true,
    method: 'smart_windowing',
  };
}
