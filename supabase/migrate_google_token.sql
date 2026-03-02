ALTER TABLE public.user_integrations 
ADD COLUMN IF NOT EXISTS google_refresh_token text;
