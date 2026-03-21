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
  visits int not null default 1,                   -- how many times they switched to this tab
  date date not null default current_date,         -- group by day securely
  last_updated timestamptz not null default now(), -- track most recent activity
  
  -- Prevent duplicate rows for the same domain on the same day for a user
  CONSTRAINT unique_daily_domain_usage UNIQUE (user_id, domain, date)
);

-- CALENDAR ACTIVITY TABLE
create table if not exists calendar_activity (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade not null,
  work_minutes int not null default 0,
  weekend_work boolean not null default false,
  date date not null default current_date
);

-- INDEXES
create index if not exists idx_browser_usage_user_id_date on browser_usage (user_id, date);
create index if not exists idx_calendar_activity_user_id_date on calendar_activity (user_id, date);

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

-- ATOMIC UPSERT FUNCTION FOR BROWSER USAGE
create or replace function increment_browser_usage(
  p_user_id uuid,
  p_domain text,
  p_category text,
  p_duration int
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.browser_usage (user_id, domain, category, duration_seconds, visits, date, last_updated)
  values (p_user_id, p_domain, p_category, p_duration, 1, current_date, now())
  on conflict (user_id, domain, date)
  do update set 
    duration_seconds = browser_usage.duration_seconds + p_duration,
    visits = browser_usage.visits + 1,
    last_updated = now();
end;
$$;
