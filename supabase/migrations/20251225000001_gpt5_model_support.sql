-- =============================================
-- GPT-5 MODEL SUPPORT MIGRATION
-- =============================================
-- This migration adds support for GPT-5 model variants
-- and adds new AI configuration options for granular
-- model selection per operation type.
-- =============================================

-- Update track_ai_usage function to include GPT-5 pricing
DROP FUNCTION IF EXISTS track_ai_usage(text, text, integer, integer, integer);

CREATE OR REPLACE FUNCTION track_ai_usage(
  p_operation_type text,
  p_model text,
  p_tokens_input integer DEFAULT 0,
  p_tokens_output integer DEFAULT 0,
  p_tool_calls integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cost numeric(10,6);
BEGIN
  -- Calculate cost based on model and operation
  -- Pricing as of December 2025
  v_cost := CASE
    -- GPT-5 variants (newest models)
    WHEN p_model = 'gpt-5.1' THEN
      (p_tokens_input * 1.75 / 1000000) + (p_tokens_output * 14.00 / 1000000)
    WHEN p_model = 'gpt-5' THEN
      (p_tokens_input * 1.75 / 1000000) + (p_tokens_output * 14.00 / 1000000)
    WHEN p_model = 'gpt-5-mini' THEN
      (p_tokens_input * 0.30 / 1000000) + (p_tokens_output * 1.20 / 1000000)
    WHEN p_model = 'gpt-5-nano' THEN
      (p_tokens_input * 0.10 / 1000000) + (p_tokens_output * 0.40 / 1000000)
    -- GPT-4 variants (older models - keep for backward compatibility)
    WHEN p_model = 'gpt-4o' THEN
      (p_tokens_input * 2.50 / 1000000) + (p_tokens_output * 10.00 / 1000000)
    WHEN p_model = 'gpt-4o-mini' THEN
      (p_tokens_input * 0.15 / 1000000) + (p_tokens_output * 0.60 / 1000000)
    ELSE 0
  END;

  -- Add tool call costs (web search)
  IF p_operation_type = 'web_search' AND p_tool_calls > 0 THEN
    v_cost := v_cost + (p_tool_calls * 10.00 / 1000);
  END IF;

  -- Insert or update usage
  INSERT INTO ai_usage_tracking (
    date, operation_type, model_used,
    tokens_input, tokens_output, tool_calls, estimated_cost_usd
  )
  VALUES (
    CURRENT_DATE, p_operation_type, p_model,
    p_tokens_input, p_tokens_output, p_tool_calls, v_cost
  )
  ON CONFLICT (date, operation_type, model_used) DO UPDATE SET
    tokens_input = ai_usage_tracking.tokens_input + EXCLUDED.tokens_input,
    tokens_output = ai_usage_tracking.tokens_output + EXCLUDED.tokens_output,
    tool_calls = ai_usage_tracking.tool_calls + EXCLUDED.tool_calls,
    estimated_cost_usd = ai_usage_tracking.estimated_cost_usd + EXCLUDED.estimated_cost_usd;
END;
$$;

COMMENT ON FUNCTION track_ai_usage IS
  'Track AI API usage and automatically calculate costs (updated for GPT-5 models)';

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION track_ai_usage(text, text, integer, integer, integer) TO service_role;

-- Add new AI config entries for granular model selection
-- (Uses INSERT ... ON CONFLICT to be idempotent)
INSERT INTO ai_config (key, value)
VALUES
  ('preferred_parsing_model', '"gpt-5-mini"'),
  ('preferred_enrichment_model', '"gpt-5-mini"')
ON CONFLICT (key) DO NOTHING;

-- Update existing model preferences to GPT-5 variants (optional - only if not already set)
-- This updates the defaults but won't override user-configured values
UPDATE ai_config
SET value = '"gpt-5.1"'
WHERE key = 'preferred_extraction_model'
  AND value = '"gpt-5"';

UPDATE ai_config
SET value = '"gpt-5-mini"'
WHERE key = 'preferred_merge_model'
  AND value = '"gpt-4o"';

COMMENT ON TABLE ai_config IS
  'AI configuration including model preferences for different operation types';
