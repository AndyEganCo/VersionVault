-- =============================================
-- FIX FUNCTION SEARCH PATH SECURITY WARNINGS
-- =============================================
-- This migration fixes the mutable search_path warnings
-- by explicitly setting search_path on the functions
-- created in the enhanced release notes migration.
-- =============================================

-- Drop and recreate check_web_search_limit with fixed search_path
DROP FUNCTION IF EXISTS check_web_search_limit();

CREATE OR REPLACE FUNCTION check_web_search_limit()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  daily_searches integer;
  max_searches integer;
BEGIN
  -- Get today's search count
  SELECT COALESCE(SUM(tool_calls), 0)
  INTO daily_searches
  FROM ai_usage_tracking
  WHERE date = CURRENT_DATE
    AND operation_type = 'web_search';

  -- Get max limit from config
  SELECT (value::text)::integer
  INTO max_searches
  FROM ai_config
  WHERE key = 'max_web_searches_per_day';

  RETURN daily_searches < max_searches;
END;
$$;

COMMENT ON FUNCTION check_web_search_limit() IS
  'Check if daily web search limit has been reached (returns true if under limit)';

-- Drop and recreate track_ai_usage with fixed search_path
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
  v_cost := CASE
    WHEN p_model = 'gpt-5' THEN
      (p_tokens_input * 1.75 / 1000000) + (p_tokens_output * 14.00 / 1000000)
    WHEN p_model = 'gpt-4o' THEN
      (p_tokens_input * 2.50 / 1000000) + (p_tokens_output * 10.00 / 1000000)
    WHEN p_model = 'gpt-4o-mini' THEN
      (p_tokens_input * 0.15 / 1000000) + (p_tokens_output * 0.60 / 1000000)
    ELSE 0
  END;

  -- Add tool call costs
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
  'Track AI API usage and automatically calculate costs';

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION check_web_search_limit() TO service_role;
GRANT EXECUTE ON FUNCTION track_ai_usage(text, text, integer, integer, integer) TO service_role;
