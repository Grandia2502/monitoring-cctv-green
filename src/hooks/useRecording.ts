import { useMemo } from 'react';
import { useRecordingContext } from '@/contexts/RecordingContext';

// Backwards-compatible hook: returns per-camera recording state + actions.
export const useRecording = (cameraId: string, cameraStatus: string) => {
  const { recordingState, startRecording, stopRecording } = useRecordingContext();

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

  return {
    isRecording: state.isRecording,
    recordingId: state.recordingId,
    duration: state.timerSeconds,
    formattedDuration,
    isStarting: state.isStarting,
    isStopping: state.isStopping,
    startRecording: (streamUrl: string) =>
      startRecording({ cameraId, streamUrl, cameraStatus }),
    stopRecording: () => stopRecording({ cameraId }),
  };
};
