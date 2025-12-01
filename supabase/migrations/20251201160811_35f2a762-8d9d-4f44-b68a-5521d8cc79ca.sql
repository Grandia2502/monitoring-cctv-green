-- Add last_ping column to cameras table for heartbeat monitoring
ALTER TABLE public.cameras 
ADD COLUMN last_ping timestamp with time zone DEFAULT now();

-- Create index for efficient heartbeat queries
CREATE INDEX idx_cameras_last_ping ON public.cameras(last_ping);