-- Non-destructive ALTER script to add advanced behavioral metrics
-- Run this in your Supabase SQL Editor. It will preserve all your existing data!

-- 1. Add the new columns
alter table public.browser_usage 
add column if not exists scroll_depth_pixels int not null default 0,
add column if not exists max_concurrent_tabs int not null default 1;

-- 2. Update the RPC function to handle the new metrics dynamically
create or replace function increment_browser_usage(
  p_user_id uuid,
  p_domain text,
  p_category text,
  p_duration int,
  p_scroll_depth int default 0,
  p_max_tabs int default 1
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.browser_usage (
    user_id, domain, category, duration_seconds, visits, date, scroll_depth_pixels, max_concurrent_tabs, last_updated
  )
  values (
    p_user_id, p_domain, p_category, p_duration, 1, current_date, p_scroll_depth, p_max_tabs, now()
  )
  on conflict (user_id, domain, date)
  do update set 
    duration_seconds = browser_usage.duration_seconds + p_duration,
    visits = browser_usage.visits + 1,
    -- Accumulate total scroll depth
    scroll_depth_pixels = browser_usage.scroll_depth_pixels + p_scroll_depth,
    -- Keep the absolute HIGHEST number of tabs recorded for this domain on this day
    max_concurrent_tabs = greatest(browser_usage.max_concurrent_tabs, p_max_tabs),
    last_updated = now();
end;
$$;
