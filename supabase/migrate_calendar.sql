-- Drop existing table
DROP TABLE IF EXISTS calendar_activity;

-- Recreate CALENDAR ACTIVITY TABLE with event-level tracking
CREATE TABLE calendar_activity (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade not null,
  event_id text not null, -- Google Calendar's unique event ID
  summary text,           -- The title of the meeting
  description text,       -- The meeting description/notes
  start_time timestamptz not null,
  end_time timestamptz not null,
  work_minutes int not null default 0,
  weekend_work boolean not null default false,
  
  -- Prevent duplicate insertions of the same calendar event for the same user
  CONSTRAINT unique_user_event UNIQUE (user_id, event_id)
);

-- Re-create index for faster querying
CREATE INDEX idx_calendar_activity_user_id_time ON calendar_activity (user_id, start_time);
