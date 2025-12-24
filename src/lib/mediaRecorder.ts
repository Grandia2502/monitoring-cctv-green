import { supabase } from "@/integrations/supabase/client";

/**
 * Creates a MediaRecorder from a canvas element
 */
export function createCanvasRecorder(
  canvas: HTMLCanvasElement,
  fps: number = 15
): { recorder: MediaRecorder; chunks: Blob[]; waitForStart: () => Promise<void> } {
  const stream = canvas.captureStream(fps);
  console.log("[mediaRecorder:stream]", { 
    tracks: stream.getTracks().length,
    videoTracks: stream.getVideoTracks().length,
  });

  const chunks: Blob[] = [];
  
  // Try to use VP9 codec first, fallback to VP8, then default
  let mimeType = 'video/webm;codecs=vp9';
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm;codecs=vp8';
  }
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm';
  }
  
  console.log("[mediaRecorder:mimeType]", { mimeType, supported: MediaRecorder.isTypeSupported(mimeType) });

  const recorder = new MediaRecorder(stream, { 
    mimeType,
    videoBitsPerSecond: 2500000, // 2.5 Mbps
  });

  // Promise that resolves when recorder actually starts
  // Use a flag to handle race condition where onstart fires before waitForStart is called
  let hasStarted = false;
  let resolveStart: (() => void) | null = null;
  
  const waitForStart = () => new Promise<void>((resolve) => {
    if (hasStarted) {
      // Already started, resolve immediately
      resolve();
    } else {
      resolveStart = resolve;
    }
  });

  recorder.ondataavailable = (event) => {
    console.log("[mediaRecorder:dataavailable]", { size: event.data.size, chunksCount: chunks.length });
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  recorder.onstart = () => {
    console.log("[mediaRecorder:onstart]", { state: recorder.state });
    hasStarted = true;
    resolveStart?.();
  };

  recorder.onerror = (event) => {
    console.error("[mediaRecorder:error]", event);
  };

  return { recorder, chunks, waitForStart };
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Upload a blob to Supabase Storage
 * Folder structure: recordings/{camera_id}/{filename}
 */
export async function uploadToStorage(
  blob: Blob,
  cameraId: string,
  recordingId: string,
  filename: string
): Promise<{ path: string; publicUrl: string } | null> {
  // Store in record/ folder with camera subfolder
  const filePath = `record/${cameraId}/${recordingId}_${filename}`;

  const { data, error } = await supabase.storage
    .from('recordings')
    .upload(filePath, blob, {
      contentType: 'video/webm',
      upsert: true,
    });

  if (error) {
    console.error('[storage:upload:error]', error);
    throw new Error(`Failed to upload: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('recordings')
    .getPublicUrl(filePath);

  return {
    path: data.path,
    publicUrl: urlData.publicUrl,
  };
}

/**
 * Generate a filename based on camera name and timestamp
 */
export function generateFilename(cameraName: string): string {
  const timestamp = new Date().toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19);
  const safeName = cameraName.replace(/[^a-zA-Z0-9]/g, '_');
  return `${safeName}_${timestamp}.webm`;
}

/**
 * Start capturing frames from an img element to a canvas
 * Returns a cleanup function to stop capturing
 */
export function startFrameCapture(
  imgElement: HTMLImageElement,
  canvas: HTMLCanvasElement,
  fps: number = 15,
  callbacks?: {
    onFirstFrame?: (info: { width: number; height: number }) => void;
    onError?: (err: unknown) => void;
  }
): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  // Match canvas size to image
  const updateCanvasSize = () => {
    if (imgElement.naturalWidth && imgElement.naturalHeight) {
      canvas.width = imgElement.naturalWidth;
      canvas.height = imgElement.naturalHeight;
    } else {
      // Default size if image dimensions not available
      canvas.width = 640;
      canvas.height = 480;
    }
  };

  updateCanvasSize();

  let frameCount = 0;
  let errorLogged = false;

  // Capture frames at specified FPS
  const intervalId = window.setInterval(() => {
    try {
      if (imgElement.complete && imgElement.naturalWidth > 0) {
        updateCanvasSize();
        ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
        frameCount++;
        if (frameCount === 1) {
          const info = { width: canvas.width, height: canvas.height };
          console.log('[frameCapture:firstFrame]', info);
          callbacks?.onFirstFrame?.(info);
        }
      }
    } catch (err) {
      // Log CORS/tainted canvas error only once
      if (!errorLogged) {
        console.error('[frameCapture:error]', err);
        callbacks?.onError?.(err);
        errorLogged = true;
      }
    }
  }, 1000 / fps);

  // Return cleanup function
  return () => {
    window.clearInterval(intervalId);
  };
}
