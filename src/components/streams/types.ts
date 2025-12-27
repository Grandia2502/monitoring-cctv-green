import { StreamType } from '@/lib/streamUtils';

export interface StreamPlayerProps {
  streamUrl: string;
  cameraName: string;
  cameraId: string;
  isOffline?: boolean;
  isPlaying?: boolean;
  onLoad?: () => void;
  onError?: () => void;
  onElementRef?: (el: HTMLImageElement | HTMLVideoElement | null) => void;
}

export interface StreamWrapperProps extends Omit<StreamPlayerProps, 'onElementRef'> {
  streamType?: StreamType;
  onElementRef?: (el: HTMLImageElement | HTMLVideoElement | null, type: 'img' | 'video') => void;
  onStreamStatusChange?: (isAvailable: boolean) => void;
  className?: string;
}
