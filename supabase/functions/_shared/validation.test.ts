/**
 * Tests and examples for validation utilities
 * Run with: deno test validation.test.ts
 */

import {
  validateProductName,
  calculateProximity,
  validateExtraction,
  getVersionFormat,
  compareVersions,
  detectVersionAnomaly,
  calculateConfidenceScore,
} from './validation.ts';

// Test validateProductName
Deno.test('validateProductName - exact match', () => {
  const content = 'DaVinci Resolve 19.1.3 is now available';
  const result = validateProductName('DaVinci Resolve', content);
  if (!result) throw new Error('Expected true');
});

Deno.test('validateProductName - case insensitive', () => {
  const content = 'davinci resolve 19.1.3 is now available';
  const result = validateProductName('DaVinci Resolve', content);
  if (!result) throw new Error('Expected true');
});

Deno.test('validateProductName - partial match with major words', () => {
  const content = 'New DaVinci features in Resolve 19.1.3';
  const result = validateProductName('DaVinci Resolve', content);
  if (!result) throw new Error('Expected true');
});

Deno.test('validateProductName - no match', () => {
  const content = 'ATEM Mini 9.6.1 is now available';
  const result = validateProductName('DaVinci Resolve', content);
  if (result) throw new Error('Expected false');
});

// Test calculateProximity
Deno.test('calculateProximity - close proximity', () => {
  const content = 'DaVinci Resolve 19.1.3 released today';
  const proximity = calculateProximity('DaVinci Resolve', '19.1.3', content);
  if (proximity < 0 || proximity > 20) {
    throw new Error(`Expected proximity < 20, got ${proximity}`);
  }
});

Deno.test('calculateProximity - far apart', () => {
  const content =
    'DaVinci Resolve is the best. '.repeat(50) + 'Version 19.1.3 available';
  const proximity = calculateProximity('DaVinci Resolve', '19.1.3', content);
  if (proximity < 100) {
    throw new Error(`Expected large proximity, got ${proximity}`);
  }
});

Deno.test('calculateProximity - version not found', () => {
  const content = 'DaVinci Resolve is great';
  const proximity = calculateProximity('DaVinci Resolve', '19.1.3', content);
  if (proximity !== -1) throw new Error('Expected -1 when version not found');
});

// Test validateExtraction
Deno.test('validateExtraction - valid extraction', () => {
  const software = { name: 'DaVinci Resolve' };
  const extracted = {
    currentVersion: '19.1.3',
    confidence: 95,
    productNameFound: true,
  };
  const content = 'DaVinci Resolve 19.1.3 released Nov 29, 2024';

  const result = validateExtraction(software, extracted, content);

  if (!result.valid) {
    throw new Error(`Expected valid, got: ${result.reason}`);
  }
  if (result.confidence < 90) {
    throw new Error(`Expected high confidence, got ${result.confidence}`);
  }
});

Deno.test('validateExtraction - wrong product (name not found)', () => {
  const software = { name: 'DaVinci Resolve' };
  const extracted = {
    currentVersion: '9.6.1',
    confidence: 95,
  };
  const content = 'ATEM Mini 9.6.1 is now available';

  const result = validateExtraction(software, extracted, content);

  if (result.valid) {
    throw new Error('Expected invalid when product name not found');
  }
  if (result.confidence !== 0) {
    throw new Error(`Expected 0 confidence, got ${result.confidence}`);
  }
});

Deno.test('validateExtraction - no version found (valid)', () => {
  const software = { name: 'DaVinci Resolve' };
  const extracted = {}; // No version extracted
  const content = 'DaVinci Resolve is great software';

  const result = validateExtraction(software, extracted, content);

  if (!result.valid) {
    throw new Error('Expected valid when no version found');
  }
});

// Test getVersionFormat
Deno.test('getVersionFormat - semantic versioning', () => {
  const format = getVersionFormat('1.2.3');
  if (format !== 'X.X.X') throw new Error(`Expected X.X.X, got ${format}`);
});

Deno.test('getVersionFormat - year-based', () => {
  const format = getVersionFormat('2024.10.1');
  if (format !== 'YYYY.X.X') {
    throw new Error(`Expected YYYY.X.X, got ${format}`);
  }
});

Deno.test('getVersionFormat - with prefix', () => {
  const format = getVersionFormat('v5.4');
  if (format !== 'X.X') throw new Error(`Expected X.X, got ${format}`);
});

// Test compareVersions
Deno.test('compareVersions - v1 > v2', () => {
  const result = compareVersions('2.0.0', '1.5.3');
  if (result !== 1) throw new Error(`Expected 1, got ${result}`);
});

Deno.test('compareVersions - v1 < v2', () => {
  const result = compareVersions('1.5.3', '2.0.0');
  if (result !== -1) throw new Error(`Expected -1, got ${result}`);
});

Deno.test('compareVersions - equal', () => {
  const result = compareVersions('1.5.3', '1.5.3');
  if (result !== 0) throw new Error(`Expected 0, got ${result}`);
});

Deno.test('compareVersions - with prefixes', () => {
  const result = compareVersions('v2.0', 'r1.5');
  if (result !== 1) throw new Error(`Expected 1, got ${result}`);
});

// Test detectVersionAnomaly
Deno.test('detectVersionAnomaly - version downgrade', () => {
  const result = detectVersionAnomaly('19.1.3', '18.5.0', {
    name: 'DaVinci Resolve',
  });
  if (!result.hasAnomaly) throw new Error('Expected anomaly for downgrade');
  if (!result.reason.includes('DOWNGRADE')) {
    throw new Error('Expected DOWNGRADE in reason');
  }
});

Deno.test('detectVersionAnomaly - format change', () => {
  const result = detectVersionAnomaly('1.2.3', '2024.1', {
    name: 'Test Software',
  });
  if (!result.hasAnomaly) throw new Error('Expected anomaly for format change');
  if (!result.reason.includes('format changed')) {
    throw new Error('Expected format change in reason');
  }
});

Deno.test('detectVersionAnomaly - major jump', () => {
  const result = detectVersionAnomaly('1.5.3', '5.0.0', {
    name: 'Test Software',
  });
  if (!result.hasAnomaly) throw new Error('Expected anomaly for major jump');
});

Deno.test('detectVersionAnomaly - normal upgrade', () => {
  const result = detectVersionAnomaly('19.1.2', '19.1.3', {
    name: 'DaVinci Resolve',
  });
  if (result.hasAnomaly) {
    throw new Error(`Expected no anomaly, got: ${result.reason}`);
  }
});

// Test calculateConfidenceScore
Deno.test('calculateConfidenceScore - high confidence scenario', () => {
  const score = calculateConfidenceScore({
    aiConfidence: 95,
    productNameFound: true,
    proximity: 50,
    hasAnomaly: false,
  });
  if (score < 90) throw new Error(`Expected high score, got ${score}`);
});

Deno.test('calculateConfidenceScore - product name not found', () => {
  const score = calculateConfidenceScore({
    aiConfidence: 95,
    productNameFound: false,
    proximity: 50,
    hasAnomaly: false,
  });
  if (score !== 0) {
    throw new Error(`Expected 0 when product not found, got ${score}`);
  }
});

Deno.test('calculateConfidenceScore - anomaly detected', () => {
  const score = calculateConfidenceScore({
    aiConfidence: 95,
    productNameFound: true,
    proximity: 50,
    hasAnomaly: true,
  });
  if (score > 60) {
    throw new Error(`Expected reduced score with anomaly, got ${score}`);
  }
});

Deno.test('calculateConfidenceScore - far proximity', () => {
  const score = calculateConfidenceScore({
    aiConfidence: 90,
    productNameFound: true,
    proximity: 600,
    hasAnomaly: false,
  });
  if (score > 70) {
    throw new Error(`Expected reduced score with far proximity, got ${score}`);
  }
});

console.log('✅ All validation tests passed!');
