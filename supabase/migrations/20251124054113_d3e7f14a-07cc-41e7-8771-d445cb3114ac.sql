-- Create storage bucket for recordings
INSERT INTO storage.buckets (id, name, public)
VALUES ('recordings', 'recordings', true);

-- Create storage policies for recordings bucket
CREATE POLICY "Authenticated users can upload recordings"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'recordings');

CREATE POLICY "Authenticated users can view recordings"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'recordings');

CREATE POLICY "Authenticated users can delete recordings"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'recordings');