-- Add a column to track the latest commit timestamp for that given day
-- This is used by the scoring engine (Phase 20) to calculate Sleep Debt Penalties
ALTER TABLE public.github_activity 
ADD COLUMN IF NOT EXISTS latest_commit_timestamp timestamptz;
