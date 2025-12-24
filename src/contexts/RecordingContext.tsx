import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { 
  createCanvasRecorder, 
  downloadBlob, 
  uploadToStorage, 
  generateFilename,
  startFrameCapture 
} from "@/lib/mediaRecorder";
import { SaveRecordingDialog, SaveRecordingOptions } from "@/components/modals/SaveRecordingDialog";

export type CameraRecordingState = {
  isRecording: boolean;
  recordingId: string | null;
  startedAt: number | null;
  timerSeconds: number;
  isStarting: boolean;
  isStopping: boolean;
};

type RecordingStateMap = Record<string, CameraRecordingState>;

// Internal state for media recording per camera
type MediaRecordingState = {
  recorder: MediaRecorder | null;
  chunks: Blob[];
  canvas: HTMLCanvasElement | null;
  stopFrameCapture: (() => void) | null;
  cameraName: string;
  hasFrames?: boolean;
  hadCaptureError?: boolean;
};

type MediaRecordingMap = Record<string, MediaRecordingState>;

// State for save dialog
type SaveDialogState = {
  open: boolean;
  cameraId: string | null;
  cameraName: string;
  recordingId: string | null;
  duration: string;
  videoBlob: Blob | null;
};

type RecordingContextValue = {
  recordingState: RecordingStateMap;
  startRecording: (args: { 
    cameraId: string; 
    streamUrl: string; 
    cameraStatus: string;
    imgElement?: HTMLImageElement | null;
    cameraName?: string;
    fps?: number;
  }) => Promise<void>;
  stopRecording: (args: { cameraId: string }) => Promise<void>;
  registerImgRef: (cameraId: string, imgElement: HTMLImageElement | null, cameraName: string, fps: number) => void;
};

const RecordingContext = createContext<RecordingContextValue | null>(null);

function ensureCameraState(map: RecordingStateMap, cameraId: string): CameraRecordingState {
  return (
    map[cameraId] ?? {
      isRecording: false,
      recordingId: null,
      startedAt: null,
      timerSeconds: 0,
      isStarting: false,
      isStopping: false,
    }
  );
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`;
  }
  return `${mins}m ${secs}s`;
}

export function RecordingProvider({ children }: { children: React.ReactNode }) {
  const [recordingState, setRecordingState] = useState<RecordingStateMap>({});
  const intervalsRef = useRef<Record<string, number>>({});
  const mediaRecordingRef = useRef<MediaRecordingMap>({});
  const imgRefsRef = useRef<Record<string, { element: HTMLImageElement | null; cameraName: string; fps: number }>>({});
  
  const [saveDialog, setSaveDialog] = useState<SaveDialogState>({
    open: false,
    cameraId: null,
    cameraName: '',
    recordingId: null,
    duration: '',
    videoBlob: null,
  });

  const clearCameraInterval = (cameraId: string) => {
    const id = intervalsRef.current[cameraId];
    if (id) {
      window.clearInterval(id);
      delete intervalsRef.current[cameraId];
    }
  };

  const startTimer = (cameraId: string) => {
    clearCameraInterval(cameraId);
    intervalsRef.current[cameraId] = window.setInterval(() => {
      setRecordingState((prev) => {
        const cur = ensureCameraState(prev, cameraId);
        if (!cur.isRecording || !cur.startedAt) return prev;
        const timerSeconds = Math.max(0, Math.floor((Date.now() - cur.startedAt) / 1000));
        return { ...prev, [cameraId]: { ...cur, timerSeconds } };
      });
    }, 1000);
  };

  // Register img ref for a camera (called from CCTVStream/CameraCard)
  const registerImgRef = useCallback((
    cameraId: string, 
    imgElement: HTMLImageElement | null,
    cameraName: string,
    fps: number
  ) => {
    imgRefsRef.current[cameraId] = { element: imgElement, cameraName, fps };
  }, []);

  const startRecording = async ({ 
    cameraId, 
    streamUrl, 
    cameraStatus,
    imgElement,
    cameraName = 'Camera',
    fps = 15
  }: { 
    cameraId: string; 
    streamUrl: string; 
    cameraStatus: string;
    imgElement?: HTMLImageElement | null;
    cameraName?: string;
    fps?: number;
  }) => {
    if (cameraStatus === "offline") {
      toast({ title: "Cannot Start Recording", description: "Camera is offline", variant: "destructive" });
      return;
    }

    setRecordingState((prev) => {
      const cur = ensureCameraState(prev, cameraId);
      if (cur.isRecording || cur.isStarting) return prev;
      return { ...prev, [cameraId]: { ...cur, isStarting: true } };
    });

    const startedAt = Date.now();

    try {
      console.log("[recording:start]", { cameraId, startedAt, streamUrl });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("start-recording", {
        body: {
          camera_id: cameraId,
          stream_url: streamUrl,
          started_at: startedAt,
        },
      });

      if (response.error) throw new Error(response.error.message);

      const recordingId = response.data?.recording_id as string | undefined;
      console.log("[recording:start:response]", { cameraId, recordingId, response: response.data });

      if (!recordingId) throw new Error("recording_id tidak ditemukan dari backend");

      // Get img element from registered refs or passed parameter
      const imgRef = imgRefsRef.current[cameraId];
      const img = imgElement || imgRef?.element;
      const actualCameraName = cameraName || imgRef?.cameraName || 'Camera';
      const actualFps = fps || imgRef?.fps || 15;

      // Initialize MediaRecorder if we have an img element
      if (img) {
        try {
          const canvas = document.createElement('canvas');

          const mediaState: MediaRecordingState = {
            recorder: null,
            chunks: [],
            canvas,
            stopFrameCapture: null,
            cameraName: actualCameraName,
            hasFrames: false,
            hadCaptureError: false,
          };

          const stopCapture = startFrameCapture(img, canvas, actualFps, {
            onFirstFrame: () => {
              mediaState.hasFrames = true;
            },
            onError: () => {
              mediaState.hadCaptureError = true;
            },
          });

          const { recorder, chunks } = createCanvasRecorder(canvas, actualFps);
          mediaState.recorder = recorder;
          mediaState.chunks = chunks;
          mediaState.stopFrameCapture = stopCapture;

          mediaRecordingRef.current[cameraId] = mediaState;

          recorder.start(1000); // Collect data every second
          console.log("[recording:mediaRecorder:started]", { cameraId });
        } catch (mediaError) {
          console.error("[recording:mediaRecorder:error]", mediaError);
          // Continue without MediaRecorder - just track metadata
        }
      } else {
        console.warn("[recording:noImgRef]", { cameraId });
      }

      setRecordingState((prev) => {
        const cur = ensureCameraState(prev, cameraId);
        return {
          ...prev,
          [cameraId]: {
            ...cur,
            isRecording: true,
            recordingId,
            startedAt,
            timerSeconds: 0,
            isStarting: false,
            isStopping: false,
          },
        };
      });

      startTimer(cameraId);

      toast({ title: "Recording Started", description: "Camera is now recording" });
    } catch (e: any) {
      console.log("[recording:start:error]", { cameraId, error: e?.message });
      setRecordingState((prev) => {
        const cur = ensureCameraState(prev, cameraId);
        return { ...prev, [cameraId]: { ...cur, isStarting: false } };
      });
      toast({ title: "Recording Failed", description: e?.message ?? "Unknown error", variant: "destructive" });
    }
  };

  const stopRecording = async ({ cameraId }: { cameraId: string }) => {
    const cur = ensureCameraState(recordingState, cameraId);

    if (!cur.recordingId) {
      toast({
        title: "Stop Recording Failed",
        description: "recording_id tidak ditemukan, tidak bisa stop.",
        variant: "destructive",
      });
      console.log("[recording:stop:blocked]", { cameraId, recordingId: cur.recordingId });
      return;
    }

    if (cur.isStopping) return;

    setRecordingState((prev) => {
      const s = ensureCameraState(prev, cameraId);
      return { ...prev, [cameraId]: { ...s, isStopping: true } };
    });

    try {
      const mediaState = mediaRecordingRef.current[cameraId];
      let videoBlob: Blob | null = null;

      console.log("[recording:stop]", { 
        cameraId, 
        recordingId: cur.recordingId,
        hasMediaState: !!mediaState,
        recorderState: mediaState?.recorder?.state,
        chunksCount: mediaState?.chunks?.length
      });

      // Stop MediaRecorder and get video blob
      if (mediaState?.recorder && mediaState.recorder.state !== 'inactive') {
        // Request final data before stopping
        mediaState.recorder.requestData();
        
        // Small delay to ensure requestData is processed
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Stop frame capture
        mediaState.stopFrameCapture?.();

        // Wait for recorder to stop and collect final chunks
        videoBlob = await new Promise<Blob>((resolve) => {
          const recorder = mediaState.recorder!;
          
          const handleStop = () => {
            const blob = new Blob(mediaState.chunks, { type: 'video/webm' });
            console.log("[recording:mediaRecorder:stopped]", { 
              cameraId, 
              blobSize: blob.size,
              chunksCount: mediaState.chunks.length 
            });
            resolve(blob);
          };
          
          recorder.onstop = handleStop;
          
          // If already inactive (due to requestData triggering stop), handle immediately
          if (recorder.state === 'inactive') {
            handleStop();
          } else {
            recorder.stop();
          }
        });
      } else {
        console.warn("[recording:stop:noRecorder]", { 
          cameraId, 
          hasMediaState: !!mediaState,
          recorderState: mediaState?.recorder?.state 
        });
      }

      clearCameraInterval(cameraId);

      const duration = formatDuration(cur.timerSeconds);
      const cameraName = mediaState?.cameraName || 'Camera';

      console.log("[recording:stop:checkDialog]", { 
        cameraId, 
        hasBlog: !!videoBlob, 
        blobSize: videoBlob?.size,
        willShowDialog: videoBlob && videoBlob.size > 0
      });

      // If we have a video blob, show save dialog
      if (videoBlob && videoBlob.size > 0) {
        setSaveDialog({
          open: true,
          cameraId,
          cameraName,
          recordingId: cur.recordingId,
          duration,
          videoBlob,
        });
      } else {
        // No video captured
        if (mediaState?.hadCaptureError) {
          toast({
            title: "Gagal menyimpan video",
            description: "Stream tidak mengizinkan capture (CORS), sehingga video tidak bisa direkam dari browser.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Tidak ada video",
            description: "Tidak ada frame yang tertangkap, sehingga tidak ada file yang bisa disimpan.",
            variant: "destructive",
          });
        }
        console.log("[recording:stop:noVideo]", { cameraId });
        await finalizeRecording(cameraId, cur.recordingId, null);
      }

    } catch (e: any) {
      console.log("[recording:stop:error]", { cameraId, recordingId: cur.recordingId, error: e?.message });
      setRecordingState((prev) => {
        const s = ensureCameraState(prev, cameraId);
        return { ...prev, [cameraId]: { ...s, isStopping: false } };
      });

      toast({ title: "Failed to Stop Recording", description: e?.message ?? "Unknown error", variant: "destructive" });
    }
  };

  const finalizeRecording = async (
    cameraId: string, 
    recordingId: string, 
    filePath: string | null
  ) => {
    try {
      const payload = { recording_id: recordingId, file_path: filePath };
      console.log("[recording:stop]", { cameraId, recordingId, payload });

      const response = await supabase.functions.invoke("stop-recording", { body: payload });
      if (response.error) throw new Error(response.error.message);

      console.log("[recording:stop:response]", { cameraId, recordingId, response: response.data });

      // Cleanup media recording state
      delete mediaRecordingRef.current[cameraId];

      setRecordingState((prev) => {
        const s = ensureCameraState(prev, cameraId);
        return {
          ...prev,
          [cameraId]: {
            ...s,
            isRecording: false,
            recordingId: null,
            startedAt: null,
            timerSeconds: 0,
            isStarting: false,
            isStopping: false,
          },
        };
      });

      toast({ title: "Recording saved", description: "Recording saved successfully" });
    } catch (e: any) {
      console.error("[recording:finalize:error]", e);
      // Reset stopping state
      setRecordingState((prev) => {
        const s = ensureCameraState(prev, cameraId);
        return { ...prev, [cameraId]: { ...s, isStopping: false } };
      });
      toast({ title: "Failed to save recording", description: e?.message, variant: "destructive" });
    }
  };

  const handleSaveDialogSave = async (options: SaveRecordingOptions) => {
    const { cameraId, cameraName, recordingId, videoBlob } = saveDialog;
    
    if (!cameraId || !recordingId || !videoBlob) {
      throw new Error("Missing required data for saving");
    }

    let uploadedPath: string | null = null;
    const filename = generateFilename(cameraName);

    // Download locally if selected
    if (options.downloadLocal) {
      downloadBlob(videoBlob, filename);
      toast({ title: "Downloaded", description: `Saved as ${filename}` });
    }

    // Upload to cloud if selected
    if (options.uploadToCloud) {
      try {
        const result = await uploadToStorage(videoBlob, cameraId, recordingId, filename);
        if (result) {
          uploadedPath = result.path;
          toast({ title: "Uploaded", description: "Video saved to cloud storage" });
        }
      } catch (uploadError: any) {
        console.error("[recording:upload:error]", uploadError);
        toast({ 
          title: "Upload Failed", 
          description: uploadError.message, 
          variant: "destructive" 
        });
      }
    }

    // Finalize recording with file path
    await finalizeRecording(cameraId, recordingId, uploadedPath);
  };

  const handleSaveDialogClose = async () => {
    // User cancelled - still finalize the recording without saving video
    const { cameraId, recordingId } = saveDialog;
    
    if (cameraId && recordingId) {
      await finalizeRecording(cameraId, recordingId, null);
    }
    
    setSaveDialog({
      open: false,
      cameraId: null,
      cameraName: '',
      recordingId: null,
      duration: '',
      videoBlob: null,
    });
  };

  // Cleanup on unmount: clear ALL intervals
  useEffect(() => {
    return () => {
      const ids = Object.values(intervalsRef.current);
      ids.forEach((id) => window.clearInterval(id));
      intervalsRef.current = {};
      
      // Stop any active recorders
      Object.values(mediaRecordingRef.current).forEach((state) => {
        state.stopFrameCapture?.();
        if (state.recorder?.state !== 'inactive') {
          state.recorder?.stop();
        }
      });
    };
  }, []);

  const value = useMemo<RecordingContextValue>(
    () => ({ recordingState, startRecording, stopRecording, registerImgRef }),
    [recordingState, registerImgRef]
  );

  return (
    <RecordingContext.Provider value={value}>
      {children}
      <SaveRecordingDialog
        open={saveDialog.open}
        onClose={handleSaveDialogClose}
        onSave={handleSaveDialogSave}
        cameraName={saveDialog.cameraName}
        duration={saveDialog.duration}
      />
    </RecordingContext.Provider>
  );
}

export function useRecordingContext() {
  const ctx = useContext(RecordingContext);
  if (!ctx) throw new Error("useRecordingContext must be used within RecordingProvider");
  return ctx;
}
