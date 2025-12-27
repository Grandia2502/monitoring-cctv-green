-- Add stream_type column to cameras table
ALTER TABLE public.cameras ADD COLUMN IF NOT EXISTS stream_type TEXT DEFAULT 'mjpeg';

-- Add comment for documentation
COMMENT ON COLUMN public.cameras.stream_type IS 'Type of stream: mjpeg, hls, or youtube';