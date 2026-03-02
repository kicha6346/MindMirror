-- 1. Completely drop the conflicted table
DROP TABLE IF EXISTS public.pomodoro_sessions;

-- 2. Recreate cleanly with only the new columns
CREATE TABLE public.pomodoro_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'completed',
  target_minutes int not null,
  completed_minutes int not null,
  total_tab_switches int not null default 0,
  blocked_site_visits int not null default 0,
  doomscroll_cycles int not null default 0,
  detailed_action_log jsonb not null default '[]'::jsonb,
  focus_score int not null default 100,
  created_at timestamptz default now()
);

-- 3. Re-create the performance index
CREATE INDEX idx_pomodoro_user_time ON public.pomodoro_sessions(user_id, start_time DESC);
