-- Add user_id column to cameras table for ownership
ALTER TABLE public.cameras 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop existing overly permissive RLS policies on cameras
DROP POLICY IF EXISTS "Authenticated users can delete cameras" ON public.cameras;
DROP POLICY IF EXISTS "Authenticated users can insert cameras" ON public.cameras;
DROP POLICY IF EXISTS "Authenticated users can update cameras" ON public.cameras;
DROP POLICY IF EXISTS "Authenticated users can view cameras" ON public.cameras;

-- Create owner-based RLS policies for cameras
CREATE POLICY "Users can view own cameras"
ON public.cameras FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own cameras"
ON public.cameras FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own cameras"
ON public.cameras FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own cameras"
ON public.cameras FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Drop existing overly permissive RLS policies on recordings
DROP POLICY IF EXISTS "Authenticated users can delete recordings" ON public.recordings;
DROP POLICY IF EXISTS "Authenticated users can insert recordings" ON public.recordings;
DROP POLICY IF EXISTS "Authenticated users can update recordings" ON public.recordings;
DROP POLICY IF EXISTS "Authenticated users can view recordings" ON public.recordings;

-- Create owner-based RLS policies for recordings (via camera ownership)
CREATE POLICY "Users can view own recordings"
ON public.recordings FOR SELECT
TO authenticated
USING (
  camera_id IN (SELECT id FROM public.cameras WHERE user_id = auth.uid())
);

CREATE POLICY "Users can insert own recordings"
ON public.recordings FOR INSERT
TO authenticated
WITH CHECK (
  camera_id IN (SELECT id FROM public.cameras WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update own recordings"
ON public.recordings FOR UPDATE
TO authenticated
USING (
  camera_id IN (SELECT id FROM public.cameras WHERE user_id = auth.uid())
);

CREATE POLICY "Users can delete own recordings"
ON public.recordings FOR DELETE
TO authenticated
USING (
  camera_id IN (SELECT id FROM public.cameras WHERE user_id = auth.uid())
);

-- Make recordings bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'recordings';

-- Drop existing overly permissive storage policies
DROP POLICY IF EXISTS "Authenticated users can view recordings" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload recordings" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update recordings" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete recordings" ON storage.objects;

-- Create owner-based storage policies for recordings bucket
CREATE POLICY "Users can view own recordings files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'recordings' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.cameras WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can upload own recordings files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'recordings' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.cameras WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update own recordings files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'recordings' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.cameras WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own recordings files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'recordings' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.cameras WHERE user_id = auth.uid()
  )
);