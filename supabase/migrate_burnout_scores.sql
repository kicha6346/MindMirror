-- Persist daily burnout scores for 30-day historical tracking
-- This is populated by /api/score on every call, upserting today's score.
CREATE TABLE IF NOT EXISTS public.burnout_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  score int not null default 0,
  work_intensity int not null default 0,
  recovery_deficit int not null default 0,
  distraction_penalty int not null default 0,
  night_activity int not null default 0,
  sleep_debt_penalty int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  CONSTRAINT unique_burnout_score_per_day UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_burnout_scores_user_date ON public.burnout_scores(user_id, date DESC);
