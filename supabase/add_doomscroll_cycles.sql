-- Non-Destructive Update to add Doomscroll Cycles
-- Run this in the Supabase SQL Editor

-- 1. Add the new column (default 0)
ALTER TABLE browser_usage
ADD COLUMN doomscroll_cycles integer DEFAULT 0;

-- 2. Update the RPC function to accept and accumulate the new parameter
CREATE OR REPLACE FUNCTION increment_browser_usage(
  p_user_id uuid,
  p_domain text,
  p_category text,
  p_duration integer,
  p_scroll_depth integer,
  p_max_tabs integer,
  p_doomscroll_cycles integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO browser_usage (
    user_id, 
    domain, 
    date, 
    category, 
    duration_seconds, 
    visits,
    scroll_depth_pixels,
    max_concurrent_tabs,
    doomscroll_cycles,
    last_updated
  )
  VALUES (
    p_user_id, 
    p_domain, 
    CURRENT_DATE, 
    p_category, 
    p_duration, 
    1,
    p_scroll_depth,
    p_max_tabs,
    p_doomscroll_cycles,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT (user_id, domain, date)
  DO UPDATE SET
    duration_seconds = browser_usage.duration_seconds + EXCLUDED.duration_seconds,
    visits = browser_usage.visits + 1,
    scroll_depth_pixels = browser_usage.scroll_depth_pixels + EXCLUDED.scroll_depth_pixels,
    max_concurrent_tabs = GREATEST(browser_usage.max_concurrent_tabs, EXCLUDED.max_concurrent_tabs),
    doomscroll_cycles = browser_usage.doomscroll_cycles + EXCLUDED.doomscroll_cycles,
    category = EXCLUDED.category,
    last_updated = CURRENT_TIMESTAMP;
END;
$$;
