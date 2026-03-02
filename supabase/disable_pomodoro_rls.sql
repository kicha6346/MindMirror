-- Fix for Pomodoro Sessions not saving from the API
-- Run this in the Supabase SQL Editor

-- Disable Row Level Security so the Next.js API can insert records using the anonymous key
ALTER TABLE pomodoro_sessions DISABLE ROW LEVEL SECURITY;
