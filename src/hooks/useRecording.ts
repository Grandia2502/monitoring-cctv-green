import { useMemo, useEffect, useCallback } from 'react';
import { useRecordingContext } from '@/contexts/RecordingContext';

// Backwards-compatible hook: returns per-camera recording state + actions.
export const useRecording = (cameraId: string, cameraStatus: string, cameraName?: string, fps?: number) => {
  const { recordingState, startRecording, stopRecording, registerImgRef } = useRecordingContext();

  const state = recordingState[cameraId] ?? {
    isRecording: false,
    recordingId: null,
    startedAt: null,
    timerSeconds: 0,
    isStarting: false,
    isStopping: false,
  };

  const formattedDuration = useMemo(() => {
    const seconds = state.timerSeconds;
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, [state.timerSeconds]);

  // Function to register img element for video capture
  const setImgRef = useCallback((imgElement: HTMLImageElement | null) => {
    registerImgRef(cameraId, imgElement, cameraName || 'Camera', fps || 15);
  }, [cameraId, cameraName, fps, registerImgRef]);

  return {
    isRecording: state.isRecording,
    recordingId: state.recordingId,
    duration: state.timerSeconds,
    formattedDuration,
    isStarting: state.isStarting,
    isStopping: state.isStopping,
    setImgRef,
    startRecording: (streamUrl: string) =>
      startRecording({ cameraId, streamUrl, cameraStatus, cameraName, fps }),
    stopRecording: () => stopRecording({ cameraId }),
  };
};
