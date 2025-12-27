// Stream type detection and utilities

export type StreamType = 'mjpeg' | 'hls' | 'youtube';

/**
 * Detect stream type from URL
 */
export function detectStreamType(url: string): StreamType {
  if (!url) return 'mjpeg';
  
  const lowerUrl = url.toLowerCase();
  
  // HLS detection (.m3u8)
  if (lowerUrl.includes('.m3u8')) {
    return 'hls';
  }
  
  // YouTube detection
  if (
    lowerUrl.includes('youtube.com') ||
    lowerUrl.includes('youtu.be') ||
    lowerUrl.includes('youtube.com/live') ||
    lowerUrl.includes('youtube.com/watch')
  ) {
    return 'youtube';
  }
  
  // Default to MJPEG
  return 'mjpeg';
}

/**
 * Get stream type display label
 */
export function getStreamTypeLabel(type: StreamType): string {
  switch (type) {
    case 'hls':
      return 'HLS Stream';
    case 'youtube':
      return 'YouTube Live';
    case 'mjpeg':
    default:
      return 'MJPEG Stream';
  }
}

/**
 * Check if stream type supports recording
 */
export function isRecordingSupported(type: StreamType): boolean {
  // YouTube cannot be recorded due to DRM
  return type !== 'youtube';
}

/**
 * Get stream type icon name (for Lucide icons)
 */
export function getStreamTypeIcon(type: StreamType): string {
  switch (type) {
    case 'hls':
      return 'Film';
    case 'youtube':
      return 'Youtube';
    case 'mjpeg':
    default:
      return 'Camera';
  }
}
