/**
 * Tests and examples for version-patterns utilities
 * Run with: deno test version-patterns.test.ts
 */

import {
  getPatternForProduct,
  extractVersionWithPattern,
  getManufacturerPatterns,
  hasPatternForManufacturer,
  createProductIdentifier,
  extractVersionGeneric,
  MANUFACTURER_PATTERNS,
} from './version-patterns.ts';

// Test getPatternForProduct
Deno.test('getPatternForProduct - Blackmagic DaVinci Resolve', () => {
  const pattern = getPatternForProduct('Blackmagic Design', 'davinci-resolve');

  if (!pattern) throw new Error('Expected pattern to be found');
  if (pattern.productName !== 'DaVinci Resolve') {
    throw new Error(`Expected DaVinci Resolve, got ${pattern.productName}`);
  }
});

Deno.test('getPatternForProduct - case and space insensitive', () => {
  const pattern = getPatternForProduct('blackmagic design', 'davinci resolve');

  if (!pattern) throw new Error('Expected pattern to be found');
});

Deno.test('getPatternForProduct - nonexistent product', () => {
  const pattern = getPatternForProduct('Blackmagic Design', 'fake-product');

  if (pattern !== null) throw new Error('Expected null for nonexistent product');
});

// Test extractVersionWithPattern
Deno.test('extractVersionWithPattern - DaVinci Resolve version', () => {
  const pattern = MANUFACTURER_PATTERNS['blackmagic-design']['davinci-resolve'];
  const content = 'DaVinci Resolve 19.1.3 released today with new features';

  const result = extractVersionWithPattern(content, pattern);

  if (!result.version) throw new Error('Expected version to be found');
  if (result.version !== '19.1.3') {
    throw new Error(`Expected 19.1.3, got ${result.version}`);
  }
  if (result.warnings.length > 0) {
    throw new Error('Expected no warnings for clean extraction');
  }
});

Deno.test('extractVersionWithPattern - with excluded pattern present', () => {
  const pattern = MANUFACTURER_PATTERNS['blackmagic-design']['davinci-resolve'];
  const content =
    'DaVinci Resolve 19.1.3 and Fusion Studio 19.1.3 are both available';

  const result = extractVersionWithPattern(content, pattern);

  if (!result.version) throw new Error('Expected version to be found');
  if (result.version !== '19.1.3') {
    throw new Error(`Expected 19.1.3, got ${result.version}`);
  }
  if (result.warnings.length === 0) {
    throw new Error('Expected warnings about excluded pattern');
  }
  if (!result.warnings[0].includes('excluded pattern')) {
    throw new Error('Expected warning about excluded pattern');
  }
});

Deno.test('extractVersionWithPattern - ATEM Mini', () => {
  const pattern = MANUFACTURER_PATTERNS['blackmagic-design']['atem-mini'];
  const content = 'ATEM Mini Pro 9.6.1 is now available';

  const result = extractVersionWithPattern(content, pattern);

  if (!result.version) throw new Error('Expected version to be found');
  if (result.version !== '9.6.1') {
    throw new Error(`Expected 9.6.1, got ${result.version}`);
  }
});

Deno.test('extractVersionWithPattern - Pro Tools year-based', () => {
  const pattern = MANUFACTURER_PATTERNS['avid']['pro-tools'];
  const content = 'Pro Tools | 2024.10 introduces new features';

  const result = extractVersionWithPattern(content, pattern);

  if (!result.version) throw new Error('Expected version to be found');
  if (result.version !== '2024.10') {
    throw new Error(`Expected 2024.10, got ${result.version}`);
  }
});

Deno.test('extractVersionWithPattern - version not found', () => {
  const pattern = MANUFACTURER_PATTERNS['blackmagic-design']['davinci-resolve'];
  const content = 'DaVinci Resolve is great software';

  const result = extractVersionWithPattern(content, pattern);

  if (result.version !== null) {
    throw new Error(`Expected null, got ${result.version}`);
  }
});

// Test getManufacturerPatterns
Deno.test('getManufacturerPatterns - Blackmagic Design', () => {
  const patterns = getManufacturerPatterns('Blackmagic Design');

  if (!patterns) throw new Error('Expected patterns to be found');
  if (!patterns['davinci-resolve']) {
    throw new Error('Expected davinci-resolve pattern');
  }
  if (!patterns['fusion-studio']) {
    throw new Error('Expected fusion-studio pattern');
  }
  if (!patterns['atem-mini']) {
    throw new Error('Expected atem-mini pattern');
  }
});

Deno.test('getManufacturerPatterns - nonexistent manufacturer', () => {
  const patterns = getManufacturerPatterns('Fake Company');

  if (patterns !== null) {
    throw new Error('Expected null for nonexistent manufacturer');
  }
});

// Test hasPatternForManufacturer
Deno.test('hasPatternForManufacturer - existing manufacturer', () => {
  const has = hasPatternForManufacturer('Blackmagic Design');
  if (!has) throw new Error('Expected true');
});

Deno.test('hasPatternForManufacturer - nonexistent manufacturer', () => {
  const has = hasPatternForManufacturer('Fake Company');
  if (has) throw new Error('Expected false');
});

// Test createProductIdentifier
Deno.test('createProductIdentifier - standard name', () => {
  const id = createProductIdentifier('DaVinci Resolve');
  if (id !== 'davinci-resolve') {
    throw new Error(`Expected davinci-resolve, got ${id}`);
  }
});

Deno.test('createProductIdentifier - with special characters', () => {
  const id = createProductIdentifier('Pro Tools | 2024');
  if (id !== 'pro-tools-2024') {
    throw new Error(`Expected pro-tools-2024, got ${id}`);
  }
});

Deno.test('createProductIdentifier - already lowercase', () => {
  const id = createProductIdentifier('qlab');
  if (id !== 'qlab') throw new Error(`Expected qlab, got ${id}`);
});

// Test extractVersionGeneric
Deno.test('extractVersionGeneric - semantic versioning', () => {
  const content = 'Version 1.2.3 is now available';
  const version = extractVersionGeneric(content);

  if (!version) throw new Error('Expected version to be found');
  if (version !== '1.2.3') {
    throw new Error(`Expected 1.2.3, got ${version}`);
  }
});

Deno.test('extractVersionGeneric - with v prefix', () => {
  const content = 'Download v5.4.1 today';
  const version = extractVersionGeneric(content);

  if (!version) throw new Error('Expected version to be found');
  if (version !== '5.4.1') throw new Error(`Expected 5.4.1, got ${version}`);
});

Deno.test('extractVersionGeneric - year-based', () => {
  const content = 'New in 2024.10 release';
  const version = extractVersionGeneric(content);

  if (!version) throw new Error('Expected version to be found');
  if (version !== '2024.10') {
    throw new Error(`Expected 2024.10, got ${version}`);
  }
});

Deno.test('extractVersionGeneric - release notation', () => {
  const content = 'r32.1.3 is the latest stable release';
  const version = extractVersionGeneric(content);

  if (!version) throw new Error('Expected version to be found');
  if (version !== '32.1.3') {
    throw new Error(`Expected 32.1.3, got ${version}`);
  }
});

Deno.test('extractVersionGeneric - build number', () => {
  const content = 'Build 12345 includes fixes';
  const version = extractVersionGeneric(content);

  if (!version) throw new Error('Expected version to be found');
  if (version !== '12345') throw new Error(`Expected 12345, got ${version}`);
});

Deno.test('extractVersionGeneric - no version found', () => {
  const content = 'This is great software';
  const version = extractVersionGeneric(content);

  if (version !== null) throw new Error(`Expected null, got ${version}`);
});

// Integration test: Full workflow
Deno.test('Integration - Extract DaVinci Resolve from multi-product page', () => {
  const content = `
    Blackmagic Design releases multiple updates today:

    DaVinci Resolve 19.1.3 - Released November 29, 2024
    - New color grading features
    - Performance improvements

    Fusion Studio 19.1.3 - Released November 29, 2024
    - VFX enhancements

    ATEM Mini Pro 9.6.1 - Released November 15, 2024
    - Bug fixes for switching
  `;

  // Extract DaVinci Resolve version
  const resolvePattern = getPatternForProduct(
    'Blackmagic Design',
    'davinci-resolve'
  );
  if (!resolvePattern) throw new Error('Pattern not found');

  const result = extractVersionWithPattern(content, resolvePattern);

  if (!result.version) throw new Error('Version not found');
  if (result.version !== '19.1.3') {
    throw new Error(`Expected 19.1.3, got ${result.version}`);
  }

  // Should have warnings about Fusion Studio being present
  if (result.warnings.length === 0) {
    throw new Error('Expected warnings about Fusion Studio');
  }
});

Deno.test('Integration - Extract ATEM version (should not get DaVinci)', () => {
  const content = `
    Blackmagic Design releases:
    DaVinci Resolve 19.1.3 and ATEM Mini Pro 9.6.1
  `;

  const atemPattern = getPatternForProduct('Blackmagic Design', 'atem-mini');
  if (!atemPattern) throw new Error('Pattern not found');

  const result = extractVersionWithPattern(content, atemPattern);

  if (!result.version) throw new Error('Version not found');
  if (result.version !== '9.6.1') {
    throw new Error(`Expected 9.6.1, got ${result.version}`);
  }
  if (result.version === '19.1.3') {
    throw new Error('Incorrectly extracted DaVinci version for ATEM');
  }
});

console.log('✅ All version-patterns tests passed!');
