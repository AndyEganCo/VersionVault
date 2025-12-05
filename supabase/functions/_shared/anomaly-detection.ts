/**
 * Anomaly Detection System
 * Detects unusual patterns in version extraction that may indicate errors
 */

import { compareVersions, getVersionFormat } from './validation.ts';

export interface Anomaly {
  type:
    | 'version_downgrade'
    | 'format_change'
    | 'major_version_jump'
    | 'suspicious_date'
    | 'confidence_drop'
    | 'extraction_method_change';
  severity: 'low' | 'medium' | 'high';
  message: string;
  details: any;
}

export interface VersionHistory {
  version: string;
  releaseDate: string | null;
  confidence: number;
  extractionMethod: string;
  checkedAt: string;
}

/**
 * Detect version downgrade (newer version followed by older version)
 */
export function detectVersionDowngrade(
  currentVersion: string,
  previousVersion: string
): Anomaly | null {
  const comparison = compareVersions(currentVersion, previousVersion);

  // -1 means current < previous (downgrade)
  if (comparison === -1) {
    return {
      type: 'version_downgrade',
      severity: 'high',
      message: `Version downgrade detected: ${previousVersion} → ${currentVersion}`,
      details: {
        currentVersion,
        previousVersion,
        comparison,
      },
    };
  }

  return null;
}

/**
 * Detect major version jump (e.g., 5.x → 19.x)
 */
export function detectMajorVersionJump(
  currentVersion: string,
  previousVersion: string
): Anomaly | null {
  // Extract major version numbers
  const currentMajor = parseInt(currentVersion.split(/[.-]/)[0]) || 0;
  const previousMajor = parseInt(previousVersion.split(/[.-]/)[0]) || 0;

  const jump = currentMajor - previousMajor;

  // Jump of 5+ major versions is suspicious
  if (jump >= 5) {
    return {
      type: 'major_version_jump',
      severity: 'medium',
      message: `Large version jump detected: ${previousVersion} → ${currentVersion} (${jump} major versions)`,
      details: {
        currentVersion,
        previousVersion,
        jump,
        currentMajor,
        previousMajor,
      },
    };
  }

  return null;
}

/**
 * Detect version format change (e.g., X.X.X → YYYY.X)
 */
export function detectFormatChange(
  currentVersion: string,
  previousVersion: string
): Anomaly | null {
  const currentFormat = getVersionFormat(currentVersion);
  const previousFormat = getVersionFormat(previousVersion);

  if (currentFormat !== previousFormat) {
    return {
      type: 'format_change',
      severity: 'medium',
      message: `Version format changed: ${previousFormat} → ${currentFormat}`,
      details: {
        currentVersion,
        previousVersion,
        currentFormat,
        previousFormat,
      },
    };
  }

  return null;
}

/**
 * Detect suspicious release date (future date or very old date)
 */
export function detectSuspiciousDate(releaseDate: string): Anomaly | null {
  const date = new Date(releaseDate);
  const now = new Date();
  const daysDiff = (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  // Future date (more than 30 days ahead)
  if (daysDiff > 30) {
    return {
      type: 'suspicious_date',
      severity: 'medium',
      message: `Release date is ${Math.round(daysDiff)} days in the future`,
      details: {
        releaseDate,
        daysInFuture: Math.round(daysDiff),
      },
    };
  }

  // Very old date (more than 5 years ago for a "latest" version)
  const yearsAgo = Math.abs(daysDiff) / 365;
  if (daysDiff < 0 && yearsAgo > 5) {
    return {
      type: 'suspicious_date',
      severity: 'low',
      message: `Release date is ${Math.round(yearsAgo)} years old (may not be latest version)`,
      details: {
        releaseDate,
        yearsAgo: Math.round(yearsAgo),
      },
    };
  }

  return null;
}

/**
 * Detect confidence drop (significant decrease in extraction confidence)
 */
export function detectConfidenceDrop(
  currentConfidence: number,
  previousConfidence: number
): Anomaly | null {
  const drop = previousConfidence - currentConfidence;

  // Drop of 30+ points is suspicious
  if (drop >= 30) {
    return {
      type: 'confidence_drop',
      severity: 'medium',
      message: `Confidence dropped significantly: ${previousConfidence}% → ${currentConfidence}%`,
      details: {
        currentConfidence,
        previousConfidence,
        drop,
      },
    };
  }

  return null;
}

/**
 * Detect extraction method change (e.g., static → interactive)
 */
export function detectExtractionMethodChange(
  currentMethod: string,
  previousMethod: string
): Anomaly | null {
  if (currentMethod !== previousMethod) {
    return {
      type: 'extraction_method_change',
      severity: 'low',
      message: `Extraction method changed: ${previousMethod} → ${currentMethod}`,
      details: {
        currentMethod,
        previousMethod,
      },
    };
  }

  return null;
}

/**
 * Run all anomaly detections
 */
export function detectAnomalies(
  current: {
    version: string;
    releaseDate?: string | null;
    confidence: number;
    extractionMethod: string;
  },
  previous?: {
    version: string;
    releaseDate?: string | null;
    confidence: number;
    extractionMethod: string;
  }
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  // Check release date anomalies
  if (current.releaseDate) {
    const dateAnomaly = detectSuspiciousDate(current.releaseDate);
    if (dateAnomaly) anomalies.push(dateAnomaly);
  }

  // If we have previous data, run comparative checks
  if (previous) {
    // Version downgrade
    const downgradeAnomaly = detectVersionDowngrade(
      current.version,
      previous.version
    );
    if (downgradeAnomaly) anomalies.push(downgradeAnomaly);

    // Major version jump
    const jumpAnomaly = detectMajorVersionJump(
      current.version,
      previous.version
    );
    if (jumpAnomaly) anomalies.push(jumpAnomaly);

    // Format change
    const formatAnomaly = detectFormatChange(current.version, previous.version);
    if (formatAnomaly) anomalies.push(formatAnomaly);

    // Confidence drop
    const confidenceAnomaly = detectConfidenceDrop(
      current.confidence,
      previous.confidence
    );
    if (confidenceAnomaly) anomalies.push(confidenceAnomaly);

    // Extraction method change
    const methodAnomaly = detectExtractionMethodChange(
      current.extractionMethod,
      previous.extractionMethod
    );
    if (methodAnomaly) anomalies.push(methodAnomaly);
  }

  return anomalies;
}

/**
 * Determine if anomalies require manual review
 */
export function requiresManualReview(anomalies: Anomaly[]): boolean {
  // High severity anomalies always require review
  if (anomalies.some((a) => a.severity === 'high')) {
    return true;
  }

  // Multiple medium severity anomalies require review
  const mediumCount = anomalies.filter((a) => a.severity === 'medium').length;
  if (mediumCount >= 2) {
    return true;
  }

  return false;
}

/**
 * Format anomalies for display/storage
 */
export function formatAnomalies(anomalies: Anomaly[]): string {
  if (anomalies.length === 0) {
    return 'No anomalies detected';
  }

  return anomalies
    .map((a) => {
      const emoji =
        a.severity === 'high' ? '🚨' : a.severity === 'medium' ? '⚠️' : 'ℹ️';
      return `${emoji} ${a.message}`;
    })
    .join('\n');
}
