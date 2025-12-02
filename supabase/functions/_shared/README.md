# Shared Utilities for Intelligent Version Detection

This directory contains shared utilities used across Supabase Edge Functions for intelligent version detection and validation.

## Files

### `validation.ts`
Product validation and verification utilities to ensure extracted versions match the intended software product.

**Key Functions:**
- `validateProductName()` - Check if product name appears on page
- `calculateProximity()` - Measure distance between product name and version
- `validateExtraction()` - Main validation function for AI extractions
- `getVersionFormat()` - Get version format pattern (e.g., "X.X.X")
- `compareVersions()` - Semantic version comparison
- `detectVersionAnomaly()` - Detect suspicious version changes
- `calculateConfidenceScore()` - Calculate overall confidence score

**Example Usage:**
```typescript
import { validateExtraction } from './_shared/validation.ts';

const validation = validateExtraction(
  { name: 'DaVinci Resolve', manufacturer: 'Blackmagic Design' },
  { currentVersion: '19.1.3', confidence: 95 },
  pageContent
);

console.log(`Valid: ${validation.valid}`);
console.log(`Confidence: ${validation.confidence}%`);
console.log(`Reason: ${validation.reason}`);
```

---

### `version-patterns.ts`
Known version patterns for specific manufacturers and products to prevent mixing up software from the same manufacturer.

**Key Functions:**
- `getPatternForProduct()` - Get regex pattern for a specific product
- `extractVersionWithPattern()` - Extract version using a pattern
- `getManufacturerPatterns()` - Get all patterns for a manufacturer
- `hasPatternForManufacturer()` - Check if patterns exist
- `createProductIdentifier()` - Generate product identifier from name
- `extractVersionGeneric()` - Fallback generic extraction

**Supported Manufacturers:**
- Blackmagic Design (DaVinci Resolve, Fusion Studio, ATEM Mini)
- Figure 53 (QLab)
- Avid (Pro Tools, Media Composer)
- disguise
- Resolume (Arena, Avenue)
- WATCHOUT
- Renewed Vision (ProPresenter)
- Adobe (Premiere Pro, After Effects)
- Green Hippo (Hippotizer)
- ETC (EOS, Cobalt)
- MA Lighting (grandMA2, grandMA3)

**Example Usage:**
```typescript
import { getPatternForProduct, extractVersionWithPattern } from './_shared/version-patterns.ts';

// Get pattern for DaVinci Resolve
const pattern = getPatternForProduct('Blackmagic Design', 'davinci-resolve');

// Extract version from content
const result = extractVersionWithPattern(pageContent, pattern);

if (result.version) {
  console.log(`Version: ${result.version}`);
}

if (result.warnings.length > 0) {
  console.warn('Warnings:', result.warnings);
}
```

---

## Running Tests

Both utilities have comprehensive test suites.

### Run All Tests
```bash
# From the _shared directory
deno test

# Or specific files
deno test validation.test.ts
deno test version-patterns.test.ts
```

### Test Coverage

**validation.test.ts:**
- Product name validation (exact, case-insensitive, partial)
- Proximity calculations
- Full extraction validation
- Version format detection
- Version comparison
- Anomaly detection
- Confidence scoring

**version-patterns.test.ts:**
- Pattern retrieval for known products
- Version extraction with patterns
- Exclude pattern handling
- Manufacturer pattern queries
- Product identifier generation
- Generic version extraction
- Integration tests for multi-product pages

---

## Adding New Manufacturer Patterns

To add patterns for a new manufacturer:

1. **Open `version-patterns.ts`**

2. **Add to `MANUFACTURER_PATTERNS`:**
```typescript
export const MANUFACTURER_PATTERNS: Record<string, ManufacturerPatterns> = {
  // ... existing patterns ...

  'your-manufacturer': {
    'product-identifier': {
      productName: 'Product Name',
      pattern: /Product\s+Name\s+(\d+\.\d+(?:\.\d+)?)/i,
      excludePatterns: [/Other\s+Product/i],
      notes: 'Description of version format'
    }
  }
};
```

3. **Test your pattern:**
```typescript
const pattern = getPatternForProduct('Your Manufacturer', 'product-identifier');
const result = extractVersionWithPattern(testContent, pattern);
```

4. **Add test cases** to `version-patterns.test.ts`

---

## Integration with Edge Functions

These utilities are designed to be imported into Supabase Edge Functions:

```typescript
// In your edge function
import { validateExtraction, calculateConfidenceScore } from '../_shared/validation.ts';
import { getPatternForProduct, extractVersionWithPattern } from '../_shared/version-patterns.ts';

// Use in your extraction logic
const validation = validateExtraction(software, extracted, pageContent);

if (!validation.valid) {
  console.warn('Validation failed:', validation.reason);
  // Flag for manual review
  extracted.requires_manual_review = true;
  extracted.validation_notes = validation.reason;
}

extracted.confidence_score = validation.confidence;
```

---

## Best Practices

1. **Always validate extractions** - Use `validateExtraction()` after AI extraction
2. **Use manufacturer patterns when available** - They're more accurate than generic extraction
3. **Check confidence scores** - Flag anything below 70% for review
4. **Log warnings** - Warnings indicate potential issues even if extraction succeeded
5. **Add new patterns** - As you encounter new manufacturers, add their patterns

---

## Confidence Score Guidelines

| Score | Meaning | Action |
|-------|---------|--------|
| 90-100 | Very high confidence | Auto-approve |
| 70-89 | Good confidence | Auto-approve but log |
| 50-69 | Moderate confidence | Flag for review |
| 20-49 | Low confidence | Require manual review |
| 0-19 | Very low confidence | Likely wrong, manual review required |

---

## Version Format Patterns

Common version formats and their patterns:

| Format | Example | Pattern |
|--------|---------|---------|
| Semantic | 1.2.3 | `X.X.X` |
| Two-part | 5.4 | `X.X` |
| Year-based | 2024.10 | `YYYY.X` |
| Release | r32.1.3 | `X.X.X` |
| Build | Build 12345 | `X` |

---

## Troubleshooting

**Problem:** Pattern not extracting version
**Solution:** Check regex in browser console, test with actual content

**Problem:** Extracting wrong product's version
**Solution:** Add more specific excludePatterns, check proximity

**Problem:** Low confidence scores
**Solution:** Check if product name appears near version, verify content quality

**Problem:** Version format keeps changing
**Solution:** May indicate mixing up products, add anomaly detection

---

## Future Enhancements

- [ ] Machine learning-based pattern generation
- [ ] Auto-learning from successful extractions
- [ ] Fuzzy matching for product names
- [ ] Multi-language support
- [ ] Version prediction based on release cycles
