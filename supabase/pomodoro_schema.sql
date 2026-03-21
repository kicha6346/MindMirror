-- Migration: Create Pomodoro Sessions Table
-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS pomodoro_sessions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    focus_minutes integer NOT NULL DEFAULT 25,
    break_minutes integer NOT NULL DEFAULT 5,
    distractions integer DEFAULT 0,
    doomscroll_cycles integer DEFAULT 0,
    tab_switches integer DEFAULT 0,
    final_focus_score integer DEFAULT 100, -- 0-100 scale
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for fast querying by user and date ranges
CREATE INDEX IF NOT EXISTS idx_pomodoro_user_time ON pomodoro_sessions(user_id, start_time DESC);

-- Allow RLS (optional, depends on your dashboard setup, but good practice)
ALTER TABLE pomodoro_sessions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to see and insert their own data
CREATE POLICY "Users can insert their own pomodoro sessions" ON pomodoro_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own pomodoro sessions" ON pomodoro_sessions
    FOR SELECT USING (auth.uid() = user_id);
