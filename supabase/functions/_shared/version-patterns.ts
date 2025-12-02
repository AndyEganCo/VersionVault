/**
 * Known version patterns for specific manufacturers and products
 * Used to extract versions and prevent mixing up products from the same manufacturer
 */

export interface VersionPattern {
  productName: string;
  pattern: RegExp;
  excludePatterns?: RegExp[];
  notes?: string;
}

export interface ManufacturerPatterns {
  [productName: string]: VersionPattern;
}

/**
 * Pre-defined patterns for known manufacturers
 * Key: manufacturer domain or name (lowercase, hyphenated)
 */
export const MANUFACTURER_PATTERNS: Record<string, ManufacturerPatterns> = {
  'blackmagic-design': {
    'davinci-resolve': {
      productName: 'DaVinci Resolve',
      pattern: /DaVinci\s+Resolve(?:\s+Studio)?\s+(\d+\.\d+(?:\.\d+)?)/i,
      excludePatterns: [
        /Fusion\s+Studio/i,
        /ATEM/i,
        /HyperDeck/i,
        /UltraStudio/i
      ],
      notes: 'Blackmagic has many products - exclude others'
    },
    'fusion-studio': {
      productName: 'Fusion Studio',
      pattern: /Fusion\s+Studio\s+(\d+\.\d+(?:\.\d+)?)/i,
      excludePatterns: [/DaVinci\s+Resolve/i, /ATEM/i],
      notes: 'Separate from DaVinci Resolve (though often same version)'
    },
    'atem-mini': {
      productName: 'ATEM Mini',
      pattern: /ATEM\s+Mini.*?(\d+\.\d+(?:\.\d+)?)/i,
      excludePatterns: [/DaVinci/i, /Fusion/i],
      notes: 'ATEM product line has different versioning'
    }
  },

  'figure53': {
    'qlab': {
      productName: 'QLab',
      pattern: /QLab\s+(?:version\s+)?(\d+\.\d+(?:\.\d+)?)/i,
      notes: 'Figure 53 only makes QLab, so no exclusions needed'
    }
  },

  'avid': {
    'pro-tools': {
      productName: 'Pro Tools',
      pattern: /Pro\s+Tools(?:\s+\|)?\s+(\d{4}\.\d+(?:\.\d+)?)/i,
      excludePatterns: [
        /Media\s+Composer/i,
        /Sibelius/i,
        /Venue/i
      ],
      notes: 'Avid uses YYYY.X format (e.g., 2024.10)'
    },
    'media-composer': {
      productName: 'Media Composer',
      pattern: /Media\s+Composer(?:\s+\|)?\s+(\d{4}\.\d+(?:\.\d+)?)/i,
      excludePatterns: [/Pro\s+Tools/i, /Sibelius/i],
      notes: 'Also uses YYYY.X format like Pro Tools'
    }
  },

  'disguise': {
    'disguise': {
      productName: 'disguise',
      pattern: /(?:disguise|d3).*?(?:r|version\s+)?(\d+\.\d+(?:\.\d+)?)/i,
      notes: 'disguise (formerly d3) server software'
    }
  },

  'resolume': {
    'resolume-arena': {
      productName: 'Resolume Arena',
      pattern: /Resolume\s+Arena\s+(\d+\.\d+(?:\.\d+)?)/i,
      excludePatterns: [/Avenue/i],
      notes: 'Arena is the pro version'
    },
    'resolume-avenue': {
      productName: 'Resolume Avenue',
      pattern: /Resolume\s+Avenue\s+(\d+\.\d+(?:\.\d+)?)/i,
      excludePatterns: [/Arena/i],
      notes: 'Avenue is the standard version'
    }
  },

  'watchout': {
    'watchout': {
      productName: 'WATCHOUT',
      pattern: /WATCHOUT\s+(?:version\s+)?(\d+\.\d+(?:\.\d+)?)/i,
      notes: 'WATCHOUT production software'
    }
  },

  'renewed-vision': {
    'propresenter': {
      productName: 'ProPresenter',
      pattern: /ProPresenter\s+(\d+(?:\.\d+)?(?:\.\d+)?)/i,
      notes: 'ProPresenter presentation software'
    }
  },

  'adobe': {
    'premiere-pro': {
      productName: 'Premiere Pro',
      pattern: /Premiere\s+Pro(?:\s+CC)?\s+(?:version\s+)?(\d{4}|\d+\.\d+)/i,
      excludePatterns: [
        /After\s+Effects/i,
        /Photoshop/i,
        /Illustrator/i
      ],
      notes: 'Adobe uses year-based versioning (2024) or X.X'
    },
    'after-effects': {
      productName: 'After Effects',
      pattern: /After\s+Effects(?:\s+CC)?\s+(?:version\s+)?(\d{4}|\d+\.\d+)/i,
      excludePatterns: [/Premiere/i, /Photoshop/i],
      notes: 'Year-based or X.X format'
    }
  },

  'green-hippo': {
    'hippotizer': {
      productName: 'Hippotizer',
      pattern: /Hippotizer.*?(?:v|version\s+)?(\d+\.\d+(?:\.\d+)?)/i,
      notes: 'Green Hippo media server software'
    }
  },

  'etc': {
    'eos': {
      productName: 'EOS',
      pattern: /EOS(?:\s+Family)?\s+(?:v|version\s+)?(\d+\.\d+(?:\.\d+)?)/i,
      excludePatterns: [/ColorSource/i, /Gio/i],
      notes: 'ETC Eos lighting console software'
    },
    'cobalt': {
      productName: 'Cobalt',
      pattern: /Cobalt\s+(?:v|version\s+)?(\d+\.\d+(?:\.\d+)?)/i,
      excludePatterns: [/EOS/i],
      notes: 'ETC Cobalt lighting console software'
    }
  },

  'ma-lighting': {
    'grandma2': {
      productName: 'grandMA2',
      pattern: /grandMA2\s+(?:software\s+)?(?:v|version\s+)?(\d+\.\d+(?:\.\d+)?)/i,
      excludePatterns: [/grandMA3/i],
      notes: 'grandMA2 lighting console - separate from MA3'
    },
    'grandma3': {
      productName: 'grandMA3',
      pattern: /grandMA3\s+(?:software\s+)?(?:v|version\s+)?(\d+\.\d+(?:\.\d+)?)/i,
      excludePatterns: [/grandMA2/i],
      notes: 'grandMA3 lighting console - separate from MA2'
    }
  }
};

/**
 * Get the pattern for a specific product
 * @param manufacturer - Manufacturer domain or name (e.g., "blackmagic-design" or "Blackmagic Design")
 * @param productIdentifier - Product identifier (e.g., "davinci-resolve")
 */
export function getPatternForProduct(
  manufacturer: string,
  productIdentifier: string
): VersionPattern | null {
  if (!manufacturer || !productIdentifier) return null;

  // Normalize manufacturer name to key format
  const manufacturerKey = manufacturer
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  const patterns = MANUFACTURER_PATTERNS[manufacturerKey];
  if (!patterns) return null;

  // Normalize product identifier
  const productKey = productIdentifier
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  return patterns[productKey] || null;
}

/**
 * Extract version using a specific pattern
 * @param content - Page content to search
 * @param pattern - Version pattern to use
 * @returns Extracted version string or null
 */
export function extractVersionWithPattern(
  content: string,
  pattern: VersionPattern
): { version: string | null; warnings: string[] } {
  const warnings: string[] = [];

  if (!content || !pattern) {
    return { version: null, warnings: ['Invalid content or pattern'] };
  }

  // Check for excluded patterns first
  if (pattern.excludePatterns) {
    for (const excludePattern of pattern.excludePatterns) {
      if (excludePattern.test(content)) {
        warnings.push(
          `Content contains excluded pattern: ${excludePattern}. May be wrong product.`
        );
      }
    }
  }

  // Try to match the version pattern
  const match = content.match(pattern.pattern);

  if (!match || !match[1]) {
    return { version: null, warnings };
  }

  const version = match[1].trim();

  // If we found excluded patterns, reduce confidence even though we found a version
  if (warnings.length > 0) {
    warnings.push(
      `Version "${version}" found, but excluded patterns detected. Please verify.`
    );
  }

  return { version, warnings };
}

/**
 * Get all patterns for a manufacturer
 * Useful for showing all products from a manufacturer
 */
export function getManufacturerPatterns(
  manufacturer: string
): ManufacturerPatterns | null {
  const manufacturerKey = manufacturer
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  return MANUFACTURER_PATTERNS[manufacturerKey] || null;
}

/**
 * Get a list of all supported manufacturers
 */
export function getSupportedManufacturers(): string[] {
  return Object.keys(MANUFACTURER_PATTERNS);
}

/**
 * Check if a manufacturer has pre-defined patterns
 */
export function hasPatternForManufacturer(manufacturer: string): boolean {
  const manufacturerKey = manufacturer
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  return manufacturerKey in MANUFACTURER_PATTERNS;
}

/**
 * Create a product identifier from a product name
 * Useful for generating product_identifier field
 */
export function createProductIdentifier(productName: string): string {
  return productName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/**
 * Generic version pattern that works for most software
 * Use this as fallback when no specific pattern exists
 */
export const GENERIC_VERSION_PATTERNS = [
  // Semantic versioning: 1.2.3, v1.2.3
  /(?:version\s+)?v?(\d+\.\d+\.\d+)/i,
  // Two-part version: 1.2, v1.2
  /(?:version\s+)?v?(\d+\.\d+)/i,
  // Year-based: 2024.1, 2024.10.1
  /(?:version\s+)?(\d{4}\.\d+(?:\.\d+)?)/i,
  // Release notation: r32.1.3
  /r(\d+\.\d+(?:\.\d+)?)/i,
  // Build numbers: Build 12345
  /build\s+(\d+)/i
];

/**
 * Try to extract version using generic patterns
 * Use this when no manufacturer-specific pattern is available
 */
export function extractVersionGeneric(content: string): string | null {
  if (!content) return null;

  for (const pattern of GENERIC_VERSION_PATTERNS) {
    const match = content.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}
