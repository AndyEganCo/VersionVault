/**
 * Pattern Learning System
 * Automatically learns and reuses successful scraping strategies
 */

export interface LearnedPattern {
  domain: string;
  successRate: number;
  lastSuccessful: string;
  strategy: {
    selectors?: string[];
    releaseNotesSelectors?: string[];
    expandSelectors?: string[];
    waitTime?: number;
    customScript?: string;
  };
  notes?: string;
}

export interface ExtractionAttempt {
  domain: string;
  productName: string;
  success: boolean;
  confidence: number;
  method: string;
  strategy?: any;
  timestamp: string;
}

/**
 * Learn from a successful extraction
 */
export function learnFromSuccess(
  attempt: ExtractionAttempt
): LearnedPattern | null {
  if (!attempt.success || attempt.confidence < 70) {
    return null; // Only learn from high-confidence successes
  }

  const domain = new URL(attempt.domain).hostname;

  const pattern: LearnedPattern = {
    domain,
    successRate: 100, // Start with 100% since this succeeded
    lastSuccessful: attempt.timestamp,
    strategy: attempt.strategy || {},
    notes: `Learned from ${attempt.productName} extraction (${attempt.method}, ${attempt.confidence}% confidence)`,
  };

  return pattern;
}

/**
 * Update success rate for an existing pattern
 */
export function updateSuccessRate(
  pattern: LearnedPattern,
  newAttempt: ExtractionAttempt
): LearnedPattern {
  // Simple moving average for success rate
  const currentRate = pattern.successRate;
  const newSuccess = newAttempt.success ? 100 : 0;

  // Weight recent attempts more heavily (80% current, 20% new)
  const updatedRate = currentRate * 0.8 + newSuccess * 0.2;

  return {
    ...pattern,
    successRate: Math.round(updatedRate),
    lastSuccessful: newAttempt.success
      ? newAttempt.timestamp
      : pattern.lastSuccessful,
  };
}

/**
 * Find best pattern for a domain
 */
export function findBestPattern(
  patterns: LearnedPattern[],
  domain: string
): LearnedPattern | null {
  const hostname = new URL(domain).hostname;

  // Find patterns for this domain
  const matchingPatterns = patterns.filter((p) => p.domain === hostname);

  if (matchingPatterns.length === 0) {
    return null;
  }

  // Sort by success rate (descending)
  matchingPatterns.sort((a, b) => b.successRate - a.successRate);

  // Return best pattern if success rate is decent (>60%)
  const bestPattern = matchingPatterns[0];
  return bestPattern.successRate > 60 ? bestPattern : null;
}

/**
 * Detect common patterns across similar domains
 */
export function detectCommonPatterns(
  patterns: LearnedPattern[]
): Map<string, string[]> {
  const commonSelectors = new Map<string, string[]>();

  // Group by TLD (e.g., .com, .org)
  const groupedByTLD = new Map<string, LearnedPattern[]>();

  for (const pattern of patterns) {
    const tld = pattern.domain.split('.').pop() || '';
    if (!groupedByTLD.has(tld)) {
      groupedByTLD.set(tld, []);
    }
    groupedByTLD.get(tld)!.push(pattern);
  }

  // Find selectors that appear frequently
  for (const [tld, patternsInGroup] of groupedByTLD) {
    const selectorCounts = new Map<string, number>();

    for (const pattern of patternsInGroup) {
      const allSelectors = [
        ...(pattern.strategy.selectors || []),
        ...(pattern.strategy.releaseNotesSelectors || []),
        ...(pattern.strategy.expandSelectors || []),
      ];

      for (const selector of allSelectors) {
        selectorCounts.set(selector, (selectorCounts.get(selector) || 0) + 1);
      }
    }

    // Selectors that appear in >50% of patterns are "common"
    const threshold = patternsInGroup.length * 0.5;
    const common = Array.from(selectorCounts.entries())
      .filter(([_, count]) => count >= threshold)
      .map(([selector, _]) => selector);

    if (common.length > 0) {
      commonSelectors.set(tld, common);
    }
  }

  return commonSelectors;
}

/**
 * Generate suggested strategy based on learned patterns
 */
export function suggestStrategy(
  domain: string,
  patterns: LearnedPattern[]
): LearnedPattern['strategy'] | null {
  // Try exact domain match first
  const exactMatch = findBestPattern(patterns, domain);
  if (exactMatch) {
    return exactMatch.strategy;
  }

  // Try similar domains (same TLD)
  const hostname = new URL(domain).hostname;
  const tld = hostname.split('.').pop() || '';

  const similarPatterns = patterns.filter((p) => p.domain.endsWith(`.${tld}`));

  if (similarPatterns.length === 0) {
    return null;
  }

  // Merge strategies from similar domains
  const mergedStrategy: LearnedPattern['strategy'] = {
    selectors: [],
    releaseNotesSelectors: [],
    expandSelectors: [],
  };

  for (const pattern of similarPatterns) {
    if (pattern.successRate > 60) {
      mergedStrategy.selectors!.push(...(pattern.strategy.selectors || []));
      mergedStrategy.releaseNotesSelectors!.push(
        ...(pattern.strategy.releaseNotesSelectors || [])
      );
      mergedStrategy.expandSelectors!.push(
        ...(pattern.strategy.expandSelectors || [])
      );
    }
  }

  // Remove duplicates
  mergedStrategy.selectors = [...new Set(mergedStrategy.selectors)];
  mergedStrategy.releaseNotesSelectors = [
    ...new Set(mergedStrategy.releaseNotesSelectors),
  ];
  mergedStrategy.expandSelectors = [
    ...new Set(mergedStrategy.expandSelectors),
  ];

  return mergedStrategy;
}

/**
 * Store pattern in database
 */
export async function storePattern(
  pattern: LearnedPattern,
  supabase: any,
  softwareId?: string
): Promise<void> {
  const { error } = await supabase.from('scraping_patterns').upsert(
    {
      software_id: softwareId || null,
      domain: pattern.domain,
      success_rate: pattern.successRate,
      last_successful_at: pattern.lastSuccessful,
      strategy: pattern.strategy,
      notes: pattern.notes,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'domain',
    }
  );

  if (error) {
    console.error('Error storing pattern:', error);
    throw error;
  }
}

/**
 * Load patterns from database
 */
export async function loadPatterns(
  supabase: any,
  domain?: string
): Promise<LearnedPattern[]> {
  let query = supabase.from('scraping_patterns').select('*');

  if (domain) {
    const hostname = new URL(domain).hostname;
    query = query.eq('domain', hostname);
  }

  const { data, error } = await query.order('success_rate', {
    ascending: false,
  });

  if (error) {
    console.error('Error loading patterns:', error);
    return [];
  }

  return (
    data?.map((row: any) => ({
      domain: row.domain,
      successRate: row.success_rate || 0,
      lastSuccessful: row.last_successful_at || '',
      strategy: row.strategy || {},
      notes: row.notes || '',
    })) || []
  );
}
