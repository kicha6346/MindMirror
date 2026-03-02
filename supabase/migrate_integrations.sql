-- 1. Create User Integrations Table
-- This stores the user's external usernames so the backend knows who to query.
CREATE TABLE IF NOT EXISTS public.user_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  github_username text,
  leetcode_username text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  CONSTRAINT unique_user_integration UNIQUE (user_id)
);

-- 2. Create GitHub Activity Table
-- Stores daily aggregated data for the user's Github activity.
CREATE TABLE IF NOT EXISTS public.github_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  commit_count int not null default 0,
  pr_count int not null default 0,
  issue_count int not null default 0,
  created_at timestamptz default now(),
  CONSTRAINT unique_github_user_date UNIQUE (user_id, date)
);

-- 3. Create LeetCode Activity Table
-- Stores daily aggregated data for LeetCode submissions.
CREATE TABLE IF NOT EXISTS public.leetcode_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  easy_solved int not null default 0,
  medium_solved int not null default 0,
  hard_solved int not null default 0,
  total_solved int not null default 0,
  created_at timestamptz default now(),
  CONSTRAINT unique_leetcode_user_date UNIQUE (user_id, date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_github_user_date ON public.github_activity(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_leetcode_user_date ON public.leetcode_activity(user_id, date DESC);
