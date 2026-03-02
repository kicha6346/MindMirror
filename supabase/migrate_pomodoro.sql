-- 1. Create User Blocklists Table
CREATE TABLE IF NOT EXISTS user_blocklists (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade not null,
  domain text not null,      -- e.g., 'instagram.com', 'twitter.com'
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  
  -- Prevent users from adding duplicate domains
  CONSTRAINT unique_user_domain UNIQUE (user_id, domain)
);

-- 2. Upgrade the Existing pomodoro_sessions Table
-- If the table exists, we ALTER it safely to add the new highly detailed tracking columns.

DO $$ 
BEGIN
  -- We use a DO block to safely add columns only if they don't already exist
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pomodoro_sessions') THEN
    
    ALTER TABLE public.pomodoro_sessions 
      ADD COLUMN IF NOT EXISTS "status" text not null default 'completed',
      ADD COLUMN IF NOT EXISTS "target_minutes" int not null default 25,
      ADD COLUMN IF NOT EXISTS "completed_minutes" int not null default 25,
      ADD COLUMN IF NOT EXISTS "total_tab_switches" int not null default 0,
      ADD COLUMN IF NOT EXISTS "blocked_site_visits" int not null default 0,
      ADD COLUMN IF NOT EXISTS "doomscroll_cycles" int not null default 0,
      ADD COLUMN IF NOT EXISTS "detailed_action_log" jsonb not null default '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS "focus_score" int not null default 100;
      
  ELSE 
    -- If the user actually deleted the table or it never properly initialized, recreate it from scratch
    CREATE TABLE public.pomodoro_sessions (
      id uuid primary key default uuid_generate_v4(),
      user_id uuid references users(id) on delete cascade not null,
      start_time timestamptz not null,
      end_time timestamptz not null,
      status text not null default 'completed',
      target_minutes int not null default 25,
      completed_minutes int not null default 25,
      total_tab_switches int not null default 0,
      blocked_site_visits int not null default 0,
      doomscroll_cycles int not null default 0,
      detailed_action_log jsonb not null default '[]'::jsonb,
      focus_score int not null default 100
    );
  END IF;
END $$;

-- 3. Create Indexes for performance
CREATE INDEX IF NOT EXISTS idx_blocklists_user ON user_blocklists (user_id);
CREATE INDEX IF NOT EXISTS idx_pomodoro_user_time ON pomodoro_sessions (user_id, start_time);
