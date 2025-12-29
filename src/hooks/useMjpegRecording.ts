import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface MjpegRecordingFile {
  filename: string;
  size: number;
  date: string;
  playUrl: string;
  downloadUrl: string;
}

export interface MjpegRecordingState {
  isRecording: boolean;
  isStarting: boolean;
  isStopping: boolean;
  isCheckingStatus: boolean;
  lastStatusCheck: Date | null;
}

interface UseMjpegRecordingOptions {
  cameraId: string;
  enabled?: boolean;
  pollingInterval?: number; // ms, default 3000
}

export function useMjpegRecording({ 
  cameraId, 
  enabled = true,
  pollingInterval = 3000 
}: UseMjpegRecordingOptions) {
  const [state, setState] = useState<MjpegRecordingState>({
    isRecording: false,
    isStarting: false,
    isStopping: false,
    isCheckingStatus: false,
    lastStatusCheck: null,
  });
  
  const [recordings, setRecordings] = useState<MjpegRecordingFile[]>([]);
  const [isLoadingRecordings, setIsLoadingRecordings] = useState(false);
  
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  // Call edge function
  const callApi = useCallback(async (action: string) => {
    const { data, error } = await supabase.functions.invoke('mjpeg-recording', {
      body: { action, cameraId }
    });
    
    if (error) {
      throw new Error(error.message);
    }
    
    if (data && !data.success) {
      throw new Error(data.error || 'Unknown error');
    }
    
    return data;
  }, [cameraId]);

  // Check recording status
  const checkStatus = useCallback(async () => {
    if (!enabled || !mountedRef.current) return;
    
    try {
      setState(s => ({ ...s, isCheckingStatus: true }));
      const data = await callApi('status');
      
      if (mountedRef.current) {
        setState(s => ({ 
          ...s, 
          isRecording: data.running === true,
          isCheckingStatus: false,
          lastStatusCheck: new Date()
        }));
      }
      
      return data.running;
    } catch (error: any) {
      console.error('[useMjpegRecording] Status check failed:', error);
      if (mountedRef.current) {
        setState(s => ({ ...s, isCheckingStatus: false }));
      }
      return false;
    }
  }, [callApi, enabled]);

  // Start polling for status
  const startPolling = useCallback(() => {
    stopPolling();
    pollingRef.current = setInterval(checkStatus, pollingInterval);
  }, [checkStatus, pollingInterval, stopPolling]);

  // Start recording
  const startRecording = useCallback(async () => {
    if (state.isStarting || state.isRecording) return;
    
    setState(s => ({ ...s, isStarting: true }));
    
    try {
      const data = await callApi('start');
      
      if (data.success) {
        setState(s => ({ 
          ...s, 
          isRecording: true, 
          isStarting: false 
        }));
        
        toast({
          title: 'Recording Started',
          description: 'MJPEG recording started on server',
        });
        
        // Start polling for status
        startPolling();
      }
    } catch (error: any) {
      console.error('[useMjpegRecording] Start failed:', error);
      setState(s => ({ ...s, isStarting: false }));
      
      toast({
        title: 'Recording Failed',
        description: error.message || 'Failed to start recording',
        variant: 'destructive',
      });
    }
  }, [callApi, state.isStarting, state.isRecording, startPolling]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    if (state.isStopping || !state.isRecording) return;
    
    setState(s => ({ ...s, isStopping: true }));
    
    try {
      const data = await callApi('stop');
      
      if (data.success) {
        setState(s => ({ 
          ...s, 
          isRecording: false, 
          isStopping: false 
        }));
        
        toast({
          title: 'Recording Stopped',
          description: 'MJPEG recording saved on server',
        });
        
        // Stop polling
        stopPolling();
      }
    } catch (error: any) {
      console.error('[useMjpegRecording] Stop failed:', error);
      setState(s => ({ ...s, isStopping: false }));
      
      toast({
        title: 'Stop Recording Failed',
        description: error.message || 'Failed to stop recording',
        variant: 'destructive',
      });
    }
  }, [callApi, state.isStopping, state.isRecording, stopPolling]);

  // Fetch recordings list
  const fetchRecordings = useCallback(async () => {
    setIsLoadingRecordings(true);
    
    try {
      const data = await callApi('list');
      
      if (data.files) {
        setRecordings(data.files);
      }
      
      return data.files || [];
    } catch (error: any) {
      console.error('[useMjpegRecording] Fetch recordings failed:', error);
      toast({
        title: 'Failed to load recordings',
        description: error.message,
        variant: 'destructive',
      });
      return [];
    } finally {
      setIsLoadingRecordings(false);
    }
  }, [callApi]);

  // Initial status check when enabled
  useEffect(() => {
    if (enabled) {
      checkStatus().then(isRunning => {
        if (isRunning) {
          startPolling();
        }
      });
    }
    
    return () => {
      stopPolling();
    };
  }, [enabled, checkStatus, startPolling, stopPolling]);

  return {
    ...state,
    recordings,
    isLoadingRecordings,
    startRecording,
    stopRecording,
    checkStatus,
    fetchRecordings,
    startPolling,
    stopPolling,
  };
}
