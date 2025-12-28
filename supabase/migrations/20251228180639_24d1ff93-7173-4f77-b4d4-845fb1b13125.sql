-- Revoke public access from google_drive_tokens table
-- This table contains sensitive OAuth tokens and should NEVER be publicly accessible

-- Revoke SELECT permission from anon role
REVOKE SELECT ON public.google_drive_tokens FROM anon;

-- Revoke all other permissions from anon role to be safe
REVOKE INSERT, UPDATE, DELETE ON public.google_drive_tokens FROM anon;

-- Also revoke from public role as additional safety measure
REVOKE ALL ON public.google_drive_tokens FROM public;