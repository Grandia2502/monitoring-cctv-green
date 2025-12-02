import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface RecordingState {
  isRecording: boolean;
  recordingId: string | null;
  duration: number;
  error: string | null;
}

export const useRecording = (cameraId: string, cameraStatus: string) => {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    recordingId: null,
    duration: 0,
    error: null,
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  // Start recording
  const startRecording = useCallback(async (streamUrl: string) => {
    if (cameraStatus === 'offline') {
      toast({
        title: 'Cannot Start Recording',
        description: 'Camera is offline',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('start-recording', {
        body: {
          camera_id: cameraId,
          stream_url: streamUrl,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const { recording_id } = response.data;

      setState({
        isRecording: true,
        recordingId: recording_id,
        duration: 0,
        error: null,
      });

      startTimeRef.current = new Date();

      // Start timer
      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000);
          setState((prev) => ({ ...prev, duration: elapsed }));
        }
      }, 1000);

      toast({
        title: 'Recording Started',
        description: 'Camera is now recording',
      });
    } catch (error: any) {
      console.error('Failed to start recording:', error);
      setState((prev) => ({
        ...prev,
        error: error.message,
      }));
      toast({
        title: 'Recording Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [cameraId, cameraStatus]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    if (!state.recordingId) return;

    try {
      const response = await supabase.functions.invoke('stop-recording', {
        body: {
          recording_id: state.recordingId,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      setState({
        isRecording: false,
        recordingId: null,
        duration: 0,
        error: null,
      });

      startTimeRef.current = null;

      toast({
        title: 'Recording Stopped',
        description: `Recording saved (${state.duration}s)`,
      });
    } catch (error: any) {
      console.error('Failed to stop recording:', error);
      toast({
        title: 'Failed to Stop Recording',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [state.recordingId, state.duration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Format duration as HH:MM:SS
  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    isRecording: state.isRecording,
    recordingId: state.recordingId,
    duration: state.duration,
    formattedDuration: formatDuration(state.duration),
    error: state.error,
    startRecording,
    stopRecording,
  };
};
