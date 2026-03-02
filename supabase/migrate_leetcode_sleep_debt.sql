-- Add a column to track the absolute latest accepted submission timestamp for that given day
-- This is used by the Master scoring engine (Phase 20) to calculate LeetCode Sleep Debt Penalties
ALTER TABLE public.leetcode_activity 
ADD COLUMN IF NOT EXISTS latest_submission_timestamp timestamptz;
