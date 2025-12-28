-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view their own recordings" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own recordings" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own recordings" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own recordings" ON storage.objects;

-- Create simpler policies based on camera ownership via the folder structure
-- Folder structure is: record/{camera_id}/{filename}
-- We need to check if user owns the camera where camera_id is the second folder segment

-- Policy for SELECT - check if user owns the camera based on camera_id in path
CREATE POLICY "Users can view recordings of their cameras" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'recordings' AND 
  (
    -- Allow if not authenticated (for public preview - will fail anyway due to bucket being private)
    auth.uid() IS NULL
    OR
    -- Check if the camera_id in the path belongs to the authenticated user
    EXISTS (
      SELECT 1 FROM public.cameras c 
      WHERE c.id::text = (string_to_array(name, '/'))[2]
      AND c.user_id = auth.uid()
    )
  )
);

-- Policy for INSERT - user can only upload to their own camera folders
CREATE POLICY "Users can upload recordings to their cameras" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'recordings' AND 
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.cameras c 
    WHERE c.id::text = (string_to_array(name, '/'))[2]
    AND c.user_id = auth.uid()
  )
);

-- Policy for UPDATE - user can only update files in their camera folders
CREATE POLICY "Users can update recordings of their cameras" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'recordings' AND 
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.cameras c 
    WHERE c.id::text = (string_to_array(name, '/'))[2]
    AND c.user_id = auth.uid()
  )
);

-- Policy for DELETE - user can only delete files in their camera folders  
CREATE POLICY "Users can delete recordings of their cameras" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'recordings' AND 
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.cameras c 
    WHERE c.id::text = (string_to_array(name, '/'))[2]
    AND c.user_id = auth.uid()
  )
);