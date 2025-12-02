/**
 * Product validation and verification utilities
 * Used to ensure extracted versions match the intended software product
 */

export interface ValidationResult {
  valid: boolean;
  confidence: number;
  reason: string;
  warnings: string[];
}

export interface Software {
  name: string;
  manufacturer?: string;
  product_identifier?: string;
}

export interface ExtractedInfo {
  currentVersion?: string;
  releaseDate?: string;
  confidence?: number;
  productNameFound?: boolean;
  validationNotes?: string;
}

/**
 * Check if the product name appears in the page content
 */
export function validateProductName(
  productName: string,
  pageContent: string
): boolean {
  if (!productName || !pageContent) return false;

  const normalizedName = productName.toLowerCase().trim();
  const normalizedContent = pageContent.toLowerCase();

  // Check for exact match
  if (normalizedContent.includes(normalizedName)) {
    return true;
  }

  // Check for partial matches (handle names like "DaVinci Resolve Studio")
  const words = normalizedName.split(/\s+/);
  if (words.length > 1) {
    // Check if all major words appear (skip common words like "the", "and")
    const majorWords = words.filter(w => w.length > 3);
    return majorWords.every(word => normalizedContent.includes(word));
  }

  return false;
}

/**
 * Calculate the proximity (distance in characters) between product name and version string
 * Returns -1 if either string is not found
 */
export function calculateProximity(
  productName: string,
  versionString: string,
  pageContent: string
): number {
  if (!productName || !versionString || !pageContent) return -1;

  const normalizedContent = pageContent.toLowerCase();
  const normalizedProduct = productName.toLowerCase();
  const normalizedVersion = versionString.toLowerCase();

  const productIndex = normalizedContent.indexOf(normalizedProduct);
  const versionIndex = normalizedContent.indexOf(normalizedVersion);

  if (productIndex === -1 || versionIndex === -1) return -1;

  return Math.abs(productIndex - versionIndex);
}

/**
 * Main validation function - validates an AI extraction result
 */
export function validateExtraction(
  software: Software,
  extracted: ExtractedInfo,
  pageContent: string
): ValidationResult {
  const warnings: string[] = [];
  let confidence = extracted.confidence || 50;

  // If no version was extracted, that's valid (just means version not found)
  if (!extracted.currentVersion) {
    return {
      valid: true,
      confidence: 100,
      reason: 'No version found - this is valid (version may not be on page)',
      warnings: []
    };
  }

  // Check 1: Product name appears on page
  const productNameFound = validateProductName(software.name, pageContent);

  if (!productNameFound) {
    // This is a critical failure - version found but product name not on page
    return {
      valid: false,
      confidence: 0,
      reason: `Product name "${software.name}" not found on page, but version "${extracted.currentVersion}" was extracted. Likely wrong product.`,
      warnings: ['Product name not found on page']
    };
  }

  // Check 2: Version appears near product name
  const proximity = calculateProximity(
    software.name,
    extracted.currentVersion,
    pageContent
  );

  if (proximity > 500) {
    warnings.push(
      `Version "${extracted.currentVersion}" found ${proximity} characters away from product name. May be incorrect.`
    );
    confidence = Math.min(confidence, 60);
  } else if (proximity > 200) {
    warnings.push(
      `Version found ${proximity} characters from product name (moderate distance)`
    );
    confidence = Math.min(confidence, 80);
  }

  // Check 3: AI confidence threshold
  if (extracted.confidence && extracted.confidence < 70) {
    warnings.push(`AI confidence below recommended threshold: ${extracted.confidence}%`);
    confidence = extracted.confidence;
  }

  // Check 4: Product name found flag (from AI)
  if (extracted.productNameFound === false) {
    warnings.push('AI reported product name not found in content');
    confidence = Math.min(confidence, 50);
  }

  // Determine if valid based on confidence and warnings
  const valid = confidence >= 70 && warnings.length === 0;

  return {
    valid,
    confidence,
    reason: valid
      ? 'All validation checks passed'
      : `Validation concerns: ${warnings.join('; ')}`,
    warnings
  };
}

/**
 * Get version format pattern (e.g., "X.X.X", "YYYY.X")
 * Useful for detecting format changes that might indicate wrong product
 */
export function getVersionFormat(version: string): string {
  if (!version) return 'UNKNOWN';

  // Remove common prefixes
  const cleaned = version.replace(/^[vr]|version\s*/i, '').trim();

  // Replace numbers with patterns
  // "1.2.3" → "X.X.X"
  // "2024.1" → "YYYY.X" (4-digit number)
  // "v5.4" → "X.X"
  const format = cleaned.replace(/\d+/g, (match) => {
    if (match.length >= 4) return 'YYYY';
    return 'X';
  });

  return format;
}

/**
 * Compare two version strings (semantic versioning)
 * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
  if (!v1 || !v2) return 0;

  // Remove common prefixes like 'v', 'r', 'version', etc.
  const clean1 = v1.replace(/^[vr]|version\s*/i, '').trim();
  const clean2 = v2.replace(/^[vr]|version\s*/i, '').trim();

  // Split into parts (1.5.0 -> [1, 5, 0])
  const parts1 = clean1.split(/[.-]/).map((p) => parseInt(p) || 0);
  const parts2 = clean2.split(/[.-]/).map((p) => parseInt(p) || 0);

  // Compare each part
  const maxLength = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLength; i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }

  return 0;
}

/**
 * Detect version anomalies (e.g., version downgrade, major jumps)
 */
export function detectVersionAnomaly(
  previousVersion: string | null,
  newVersion: string,
  software: Software
): { hasAnomaly: boolean; reason: string } {
  if (!previousVersion) {
    return { hasAnomaly: false, reason: 'No previous version to compare' };
  }

  // Check 1: Version decreased (major red flag)
  const comparison = compareVersions(newVersion, previousVersion);
  if (comparison < 0) {
    return {
      hasAnomaly: true,
      reason: `Version DOWNGRADE detected: ${previousVersion} → ${newVersion}. Likely wrong product.`
    };
  }

  // Check 2: Version format changed
  const oldFormat = getVersionFormat(previousVersion);
  const newFormat = getVersionFormat(newVersion);

  if (oldFormat !== newFormat && oldFormat !== 'UNKNOWN' && newFormat !== 'UNKNOWN') {
    return {
      hasAnomaly: true,
      reason: `Version format changed from ${oldFormat} to ${newFormat}. May indicate wrong product.`
    };
  }

  // Check 3: Major version jumped by more than 2 (suspicious but not always wrong)
  const oldParts = previousVersion.replace(/^[vr]/i, '').split(/[.-]/);
  const newParts = newVersion.replace(/^[vr]/i, '').split(/[.-]/);

  const oldMajor = parseInt(oldParts[0]) || 0;
  const newMajor = parseInt(newParts[0]) || 0;

  if (newMajor - oldMajor > 2) {
    return {
      hasAnomaly: true,
      reason: `Major version jumped from ${oldMajor} to ${newMajor}. Unusual but may be valid.`
    };
  }

  return { hasAnomaly: false, reason: 'No anomalies detected' };
}

/**
 * Calculate overall confidence score based on multiple factors
 */
export function calculateConfidenceScore(params: {
  aiConfidence?: number;
  productNameFound: boolean;
  proximity: number;
  hasAnomaly: boolean;
  previousVersion?: string;
}): number {
  let score = params.aiConfidence || 50;

  // Product name not found is critical
  if (!params.productNameFound) {
    return 0;
  }

  // Proximity adjustments
  if (params.proximity >= 0 && params.proximity <= 100) {
    score = Math.min(100, score + 20); // Very close - boost confidence
  } else if (params.proximity > 500) {
    score = Math.max(0, score - 30); // Far apart - reduce confidence
  } else if (params.proximity > 200) {
    score = Math.max(0, score - 15); // Moderate distance - slight reduction
  }

  // Anomaly detection
  if (params.hasAnomaly) {
    score = Math.max(0, score - 40); // Significant reduction for anomalies
  }

  // Cap at 0-100
  return Math.max(0, Math.min(100, Math.round(score)));
}
