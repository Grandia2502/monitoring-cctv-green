import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type CameraRecordingState = {
  isRecording: boolean;
  recordingId: string | null;
  startedAt: number | null;
  timerSeconds: number;
  isStarting: boolean;
  isStopping: boolean;
};

type RecordingStateMap = Record<string, CameraRecordingState>;

type RecordingContextValue = {
  recordingState: RecordingStateMap;
  startRecording: (args: { cameraId: string; streamUrl: string; cameraStatus: string }) => Promise<void>;
  stopRecording: (args: { cameraId: string }) => Promise<void>;
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

export function RecordingProvider({ children }: { children: React.ReactNode }) {
  const [recordingState, setRecordingState] = useState<RecordingStateMap>({});
  const intervalsRef = useRef<Record<string, number>>({});

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

  const startRecording = async ({
    cameraId,
    streamUrl,
    cameraStatus,
  }: {
    cameraId: string;
    streamUrl: string;
    cameraStatus: string;
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

      const {
        data: { session },
      } = await supabase.auth.getSession();
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
      const payload = { recording_id: cur.recordingId };
      console.log("[recording:stop]", { cameraId, recordingId: cur.recordingId, payload });

      const response = await supabase.functions.invoke("stop-recording", { body: payload });
      if (response.error) throw new Error(response.error.message);

      console.log("[recording:stop:response]", { cameraId, recordingId: cur.recordingId, response: response.data });
      console.log("masuk");
      clearCameraInterval(cameraId);

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

      toast({ title: "Recording stopped", description: "Recording stopped" });
    } catch (e: any) {
      console.log("[recording:stop:error]", { cameraId, recordingId: cur.recordingId, error: e?.message });
      // Keep isRecording=true, only remove loading state
      setRecordingState((prev) => {
        const s = ensureCameraState(prev, cameraId);
        return { ...prev, [cameraId]: { ...s, isStopping: false } };
      });

      toast({ title: "Failed to Stop Recording", description: e?.message ?? "Unknown error", variant: "destructive" });
    }
  };

  // Cleanup on unmount: clear ALL intervals
  useEffect(() => {
    return () => {
      const ids = Object.values(intervalsRef.current);
      ids.forEach((id) => window.clearInterval(id));
      intervalsRef.current = {};
    };
  }, []);

  const value = useMemo<RecordingContextValue>(
    () => ({ recordingState, startRecording, stopRecording }),
    [recordingState],
  );

  return <RecordingContext.Provider value={value}>{children}</RecordingContext.Provider>;
}

export function useRecordingContext() {
  const ctx = useContext(RecordingContext);
  if (!ctx) throw new Error("useRecordingContext must be used within RecordingProvider");
  return ctx;
}
