-- =============================================
-- INTELLIGENT VERSION DETECTION - PHASE 1 MIGRATION
-- =============================================
-- This migration adds new fields and tables to support intelligent version detection
-- with product differentiation and validation capabilities.
--
-- SAFE TO RUN: All changes are backward compatible
-- - All new columns are nullable
-- - Existing queries will continue to work
-- - Can be rolled back by simply not using the new fields
--
-- Run this in your Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. EXTEND SOFTWARE TABLE
-- =============================================
-- Add new fields for product identification and scraping strategies

ALTER TABLE software
  ADD COLUMN IF NOT EXISTS product_identifier TEXT,
  ADD COLUMN IF NOT EXISTS scraping_strategy JSONB,
  ADD COLUMN IF NOT EXISTS manufacturer_product_page TEXT;

-- Add comments for documentation
COMMENT ON COLUMN software.product_identifier IS 'Canonical identifier for the product (e.g., "davinci-resolve"). Used to prevent mixing up products from the same manufacturer.';
COMMENT ON COLUMN software.scraping_strategy IS 'JSON object containing custom scraping rules for this software (e.g., which buttons to click, selectors to use)';
COMMENT ON COLUMN software.manufacturer_product_page IS 'Direct link to the manufacturer''s product page (separate from version_website)';

-- Create index for product_identifier lookups
CREATE INDEX IF NOT EXISTS idx_software_product_identifier
  ON software(product_identifier)
  WHERE product_identifier IS NOT NULL;

-- =============================================
-- 2. EXTEND SOFTWARE_VERSION_HISTORY TABLE
-- =============================================
-- Add validation and confidence tracking fields

ALTER TABLE software_version_history
  ADD COLUMN IF NOT EXISTS confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
  ADD COLUMN IF NOT EXISTS validation_notes TEXT,
  ADD COLUMN IF NOT EXISTS requires_manual_review BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS extraction_method TEXT;

-- Add comments for documentation
COMMENT ON COLUMN software_version_history.confidence_score IS 'AI confidence score (0-100) for this version extraction';
COMMENT ON COLUMN software_version_history.validation_notes IS 'Explanation of why this version was flagged or validation details';
COMMENT ON COLUMN software_version_history.requires_manual_review IS 'Flag indicating this version needs human review';
COMMENT ON COLUMN software_version_history.extraction_method IS 'Method used to extract this version (e.g., "enhanced_ai", "legacy", "interactive_scraping")';

-- Create index for manual review queries (only index rows that need review)
CREATE INDEX IF NOT EXISTS idx_version_history_manual_review
  ON software_version_history(requires_manual_review, created_at DESC)
  WHERE requires_manual_review = true;

-- Create index for confidence score queries
CREATE INDEX IF NOT EXISTS idx_version_history_confidence
  ON software_version_history(confidence_score)
  WHERE confidence_score IS NOT NULL;

-- =============================================
-- 3. CREATE SCRAPING_PATTERNS TABLE
-- =============================================
-- Store successful scraping strategies learned from past extractions

CREATE TABLE IF NOT EXISTS scraping_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  software_id UUID REFERENCES software(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  success_rate DECIMAL(5,2) DEFAULT 0 CHECK (success_rate >= 0 AND success_rate <= 100),
  last_successful_at TIMESTAMP WITH TIME ZONE,
  strategy JSONB NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments for documentation
COMMENT ON TABLE scraping_patterns IS 'Stores successful scraping strategies learned from past extractions. Used to optimize future scraping attempts.';
COMMENT ON COLUMN scraping_patterns.software_id IS 'The software this pattern applies to (nullable for domain-wide patterns)';
COMMENT ON COLUMN scraping_patterns.domain IS 'The domain this pattern works for (e.g., "blackmagicdesign.com")';
COMMENT ON COLUMN scraping_patterns.success_rate IS 'Percentage of successful extractions using this pattern';
COMMENT ON COLUMN scraping_patterns.strategy IS 'JSON object containing the scraping strategy (selectors, patterns, etc.)';

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_scraping_patterns_software_id
  ON scraping_patterns(software_id)
  WHERE software_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scraping_patterns_domain
  ON scraping_patterns(domain);

CREATE INDEX IF NOT EXISTS idx_scraping_patterns_success_rate
  ON scraping_patterns(success_rate DESC);

-- =============================================
-- 4. CREATE UPDATED_AT TRIGGER FOR SCRAPING_PATTERNS
-- =============================================
-- Automatically update the updated_at timestamp

CREATE OR REPLACE FUNCTION update_scraping_patterns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_scraping_patterns_updated_at ON scraping_patterns;
CREATE TRIGGER set_scraping_patterns_updated_at
  BEFORE UPDATE ON scraping_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_scraping_patterns_updated_at();

-- =============================================
-- 5. CREATE VIEW FOR FLAGGED VERSIONS
-- =============================================
-- Easy query for versions requiring manual review

CREATE OR REPLACE VIEW flagged_versions AS
SELECT
  vh.id,
  vh.software_id,
  s.name AS software_name,
  s.manufacturer,
  vh.version,
  vh.confidence_score,
  vh.validation_notes,
  vh.extraction_method,
  vh.release_date,
  vh.created_at,
  vh.notes
FROM software_version_history vh
JOIN software s ON s.id = vh.software_id
WHERE vh.requires_manual_review = true
ORDER BY vh.created_at DESC;

COMMENT ON VIEW flagged_versions IS 'View of all versions requiring manual review, with software details joined';

-- =============================================
-- 6. INSERT DEFAULT SCRAPING PATTERNS
-- =============================================
-- Add some common patterns for well-known manufacturers

INSERT INTO scraping_patterns (domain, strategy, notes, success_rate)
VALUES
  (
    'blackmagicdesign.com',
    '{
      "versionPatterns": {
        "DaVinci Resolve": "DaVinci\\\\s+Resolve(?:\\\\s+Studio)?\\\\s+(\\\\d+\\\\.\\\\d+(?:\\\\.\\\\d+)?)",
        "Fusion Studio": "Fusion\\\\s+Studio\\\\s+(\\\\d+\\\\.\\\\d+(?:\\\\.\\\\d+)?)",
        "ATEM Mini": "ATEM.*?(\\\\d+\\\\.\\\\d+(?:\\\\.\\\\d+)?)"
      },
      "releaseNotesSelectors": [
        ".support-version-info",
        ".release-notes-content"
      ]
    }'::jsonb,
    'Default patterns for Blackmagic Design products',
    0
  ),
  (
    'figure53.com',
    '{
      "versionPatterns": {
        "QLab": "QLab\\\\s+(\\\\d+\\\\.\\\\d+(?:\\\\.\\\\d+)?)"
      },
      "releaseNotesSelectors": [
        ".release-notes",
        "#release-notes"
      ]
    }'::jsonb,
    'Default patterns for Figure 53 QLab',
    0
  ),
  (
    'avid.com',
    '{
      "versionPatterns": {
        "Pro Tools": "Pro\\\\s+Tools\\\\s+(\\\\d{4}\\\\.\\\\d+(?:\\\\.\\\\d+)?)",
        "Media Composer": "Media\\\\s+Composer\\\\s+(\\\\d{4}\\\\.\\\\d+(?:\\\\.\\\\d+)?)"
      }
    }'::jsonb,
    'Default patterns for Avid products',
    0
  )
ON CONFLICT DO NOTHING;

-- =============================================
-- 7. VERIFICATION QUERIES
-- =============================================
-- Run these to verify the migration was successful

-- Check new columns exist on software table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'software'
  AND column_name IN ('product_identifier', 'scraping_strategy', 'manufacturer_product_page')
ORDER BY column_name;

-- Check new columns exist on software_version_history table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'software_version_history'
  AND column_name IN ('confidence_score', 'validation_notes', 'requires_manual_review', 'extraction_method')
ORDER BY column_name;

-- Check scraping_patterns table exists
SELECT COUNT(*) as default_patterns_count
FROM scraping_patterns;

-- Verify indexes were created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('software', 'software_version_history', 'scraping_patterns')
  AND indexname LIKE '%product_identifier%'
     OR indexname LIKE '%manual_review%'
     OR indexname LIKE '%confidence%'
     OR indexname LIKE '%scraping_patterns%'
ORDER BY tablename, indexname;

-- =============================================
-- MIGRATION COMPLETE
-- =============================================
-- All backward-compatible changes have been applied.
-- Existing queries will continue to work.
-- New fields are ready to use when enhanced extraction is enabled.
-- =============================================
