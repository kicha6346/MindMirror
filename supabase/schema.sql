-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- USERS TABLE
create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade not null,
  email text unique not null,
  created_at timestamptz default now()
);

-- BROWSER USAGE TABLE
create table if not exists browser_usage (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade not null,
  domain text not null,
  category text not null,
  duration_seconds int not null default 0,
  timestamp timestamptz not null default now()
);

-- GITHUB ACTIVITY TABLE
create table if not exists github_activity (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade not null,
  commit_count int not null default 0,
  late_night_commits int not null default 0,
  date date not null default current_date
);

-- CALENDAR ACTIVITY TABLE
create table if not exists calendar_activity (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade not null,
  work_minutes int not null default 0,
  weekend_work boolean not null default false,
  date date not null default current_date
);

-- LEETCODE ACTIVITY TABLE
create table if not exists leetcode_activity (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade not null,
  minutes int not null default 0,
  streak_count int not null default 0,
  date date not null default current_date
);

-- MOOD LOGS TABLE
create table if not exists mood_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade not null,
  mood_score int not null check (mood_score >= 1 and mood_score <= 10),
  note text,
  date date not null default current_date
);

-- BURNOUT SCORES TABLE
create table if not exists burnout_scores (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade not null,
  daily_score int not null default 0,
  weekly_score int not null default 0,
  computed_at timestamptz not null default now()
);

-- FUTURE PROJECTION TABLE
create table if not exists future_projection (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade not null,
  projected_score_continue int not null default 0,
  projected_score_recovery int not null default 0,
  created_at timestamptz not null default now()
);

-- INDEXES
create index if not exists idx_browser_usage_user_id_timestamp on browser_usage (user_id, timestamp);
create index if not exists idx_github_activity_user_id_date on github_activity (user_id, date);
create index if not exists idx_calendar_activity_user_id_date on calendar_activity (user_id, date);
create index if not exists idx_leetcode_activity_user_id_date on leetcode_activity (user_id, date);
create index if not exists idx_burnout_scores_user_id_computed_at on burnout_scores (user_id, computed_at);

-- AUTH TRIGGER
-- Automatically sync Supabase auth users to the public users table 
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

-- Trigger the function every time a user is created
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
