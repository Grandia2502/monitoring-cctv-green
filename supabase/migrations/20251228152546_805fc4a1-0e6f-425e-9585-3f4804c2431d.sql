-- Fix recordings bucket RLS policies: remove conflicting/incorrect ones and add correct path-based ownership checks

-- Drop incorrect/conflicting policies (both the older '* files' ones and the newer ones we added)
DROP POLICY IF EXISTS "Users can view own recordings files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own recordings files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own recordings files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own recordings files" ON storage.objects;

DROP POLICY IF EXISTS "Users can view recordings of their cameras" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload recordings to their cameras" ON storage.objects;
DROP POLICY IF EXISTS "Users can update recordings of their cameras" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete recordings of their cameras" ON storage.objects;

-- Create correct policies for the private 'recordings' bucket
-- Expected object key format: record/{camera_id}/{filename}

CREATE POLICY "Users can view recordings of their cameras"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'recordings'
  AND EXISTS (
    SELECT 1
    FROM public.cameras cam
    WHERE cam.id::text = (string_to_array(storage.objects.name, '/'))[2]
      AND cam.user_id = auth.uid()
  )
);

CREATE POLICY "Users can upload recordings to their cameras"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'recordings'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.cameras cam
    WHERE cam.id::text = (string_to_array(storage.objects.name, '/'))[2]
      AND cam.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update recordings of their cameras"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'recordings'
  AND EXISTS (
    SELECT 1
    FROM public.cameras cam
    WHERE cam.id::text = (string_to_array(storage.objects.name, '/'))[2]
      AND cam.user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'recordings'
  AND EXISTS (
    SELECT 1
    FROM public.cameras cam
    WHERE cam.id::text = (string_to_array(storage.objects.name, '/'))[2]
      AND cam.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete recordings of their cameras"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'recordings'
  AND EXISTS (
    SELECT 1
    FROM public.cameras cam
    WHERE cam.id::text = (string_to_array(storage.objects.name, '/'))[2]
      AND cam.user_id = auth.uid()
  )
);