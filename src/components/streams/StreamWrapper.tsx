import { useCallback } from 'react';
import { detectStreamType, StreamType } from '@/lib/streamUtils';
import { MjpegStreamPlayer } from './MjpegStreamPlayer';
import { HlsStreamPlayer } from './HlsStreamPlayer';
import { YouTubeStreamPlayer } from './YouTubeStreamPlayer';
import { StreamWrapperProps } from './types';
import { cn } from '@/lib/utils';

export function StreamWrapper({
  streamUrl,
  cameraName,
  cameraId,
  streamType: explicitStreamType,
  isOffline = false,
  isPlaying = true,
  onLoad,
  onError,
  onElementRef,
  onStreamStatusChange,
  className,
}: StreamWrapperProps) {
  // Auto-detect stream type if not explicitly provided
  const streamType: StreamType = explicitStreamType || detectStreamType(streamUrl);

  const handleElementRef = useCallback((el: HTMLImageElement | HTMLVideoElement | null) => {
    const elementType = streamType === 'mjpeg' ? 'img' : 'video';
    onElementRef?.(el, elementType);
  }, [streamType, onElementRef]);

  const handleLoad = useCallback(() => {
    onLoad?.();
    onStreamStatusChange?.(true);
  }, [onLoad, onStreamStatusChange]);

  const handleError = useCallback(() => {
    onError?.();
    onStreamStatusChange?.(false);
  }, [onError, onStreamStatusChange]);

  const commonProps = {
    streamUrl,
    cameraName,
    cameraId,
    isOffline,
    isPlaying,
    onLoad: handleLoad,
    onError: handleError,
    onElementRef: handleElementRef,
  };

  return (
    <div className={cn("relative aspect-video bg-muted rounded-md overflow-hidden", className)}>
      {streamType === 'hls' && <HlsStreamPlayer {...commonProps} />}
      {streamType === 'youtube' && <YouTubeStreamPlayer {...commonProps} />}
      {streamType === 'mjpeg' && <MjpegStreamPlayer {...commonProps} />}
    </div>
  );
}

// Re-export for convenience
export { detectStreamType, type StreamType } from '@/lib/streamUtils';
