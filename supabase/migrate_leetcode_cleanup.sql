-- Drop unused difficulty columns from leetcode_activity
ALTER TABLE public.leetcode_activity
DROP COLUMN IF EXISTS easy_solved,
DROP COLUMN IF EXISTS medium_solved,
DROP COLUMN IF EXISTS hard_solved;
