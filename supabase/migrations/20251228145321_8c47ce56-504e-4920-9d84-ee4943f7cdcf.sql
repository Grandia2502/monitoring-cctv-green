-- Fix recordings storage bucket security - make private with owner-based access

-- Make bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'recordings';

-- Drop all existing policies on storage.objects for recordings bucket
DROP POLICY IF EXISTS "Public read access for recordings" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload recordings for their cameras" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their recordings" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their recordings" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload recordings" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update recordings" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete recordings" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own recordings files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own recordings files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own recordings files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own recordings files" ON storage.objects;

-- Create owner-based policies for recordings bucket
-- Files should be stored as: {camera_id}/{filename}

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