-- Jadikan bucket "recordings" public agar file bisa diakses via link
UPDATE storage.buckets SET public = true WHERE id = 'recordings';

-- Tambah policy supaya semua orang bisa baca file di bucket recordings
CREATE POLICY "Public read access for recordings"
ON storage.objects FOR SELECT
USING (bucket_id = 'recordings');

-- Policy untuk user upload file recording mereka sendiri
CREATE POLICY "Users can upload recordings for their cameras"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'recordings' AND
  auth.uid() IS NOT NULL
);

-- Policy untuk user update file recording mereka sendiri  
CREATE POLICY "Users can update their recordings"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'recordings' AND
  auth.uid() IS NOT NULL
);

-- Policy untuk user delete file recording mereka sendiri
CREATE POLICY "Users can delete their recordings"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'recordings' AND
  auth.uid() IS NOT NULL
);