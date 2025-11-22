-- Create cameras table
CREATE TABLE public.cameras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  stream_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'online',
  resolution TEXT,
  fps INTEGER,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cameras ENABLE ROW LEVEL SECURITY;

-- Create policies for cameras (all authenticated users are admin)
CREATE POLICY "Authenticated users can view cameras"
  ON public.cameras
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert cameras"
  ON public.cameras
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update cameras"
  ON public.cameras
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete cameras"
  ON public.cameras
  FOR DELETE
  TO authenticated
  USING (true);

-- Create recordings table
CREATE TABLE public.recordings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  camera_id UUID NOT NULL REFERENCES public.cameras(id) ON DELETE CASCADE,
  file_url TEXT,
  thumbnail_url TEXT,
  description TEXT,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration TEXT,
  size INTEGER,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;

-- Create policies for recordings (all authenticated users are admin)
CREATE POLICY "Authenticated users can view recordings"
  ON public.recordings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert recordings"
  ON public.recordings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update recordings"
  ON public.recordings
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete recordings"
  ON public.recordings
  FOR DELETE
  TO authenticated
  USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for cameras updated_at
CREATE TRIGGER update_cameras_updated_at
  BEFORE UPDATE ON public.cameras
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();