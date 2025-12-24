import { supabase } from "@/integrations/supabase/client";

/**
 * Creates a MediaRecorder from a canvas element
 */
export function createCanvasRecorder(
  canvas: HTMLCanvasElement,
  fps: number = 15
): { recorder: MediaRecorder; chunks: Blob[] } {
  const stream = canvas.captureStream(fps);
  const chunks: Blob[] = [];
  
  // Try to use VP9 codec first, fallback to VP8
  let mimeType = 'video/webm;codecs=vp9';
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm;codecs=vp8';
  }
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm';
  }

  const recorder = new MediaRecorder(stream, { mimeType });

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  return { recorder, chunks };
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
  fps: number = 15
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

  // Capture frames at specified FPS
  const intervalId = window.setInterval(() => {
    if (imgElement.complete && imgElement.naturalWidth > 0) {
      updateCanvasSize();
      ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
    }
  }, 1000 / fps);

  // Return cleanup function
  return () => {
    window.clearInterval(intervalId);
  };
}
