import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Play,
  Pause,
  Maximize,
  Minimize,
  Camera as CameraIcon,
  Circle,
  Square,
  RefreshCw,
  Download,
  MapPin,
  Monitor,
  Film,
  Youtube,
} from 'lucide-react';
import { useRecording } from '@/hooks/useRecording';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { StreamWrapper } from '@/components/streams/StreamWrapper';
import { detectStreamType, isRecordingSupported, getStreamTypeLabel, StreamType } from '@/lib/streamUtils';

interface ViewStreamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  camera: Camera | null;
}

function getStatusBadge(status: string) {
  const variants = {
    online: 'bg-status-online text-white',
    offline: 'bg-status-offline text-white',
    recording: 'bg-destructive text-white',
  };
  return variants[status as keyof typeof variants] || 'bg-muted';
}

function getStreamTypeIcon(type: StreamType) {
  switch (type) {
    case 'hls':
      return <Film className="w-3 h-3" />;
    case 'youtube':
      return <Youtube className="w-3 h-3" />;
    default:
      return <CameraIcon className="w-3 h-3" />;
  }
}

export function ViewStreamModal({ open, onOpenChange, camera }: ViewStreamModalProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [streamLoaded, setStreamLoaded] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  
  const elementRef = useRef<HTMLImageElement | HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Detect stream type
  const streamType = camera ? (camera as any).streamType || detectStreamType(camera.streamUrl) : 'mjpeg';
  const canRecord = isRecordingSupported(streamType);
  const canSnapshot = streamType !== 'youtube'; // YouTube doesn't allow canvas capture

  const {
    isRecording,
    formattedDuration,
    isStarting,
    isStopping,
    startRecording,
    stopRecording,
    setImgRef,
  } = useRecording(
    camera?.id || '',
    camera?.status || 'offline',
    camera?.name,
    camera?.fps
  );

  const isOffline = camera?.status === 'offline';

  // Reset states when modal opens/closes or camera changes
  useEffect(() => {
    if (open && camera) {
      setIsPlaying(true);
      setStreamLoaded(false);
      setRetryKey(prev => prev + 1);
    }
  }, [open, camera?.id]);

  // Handle fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Handle stream load
  const handleStreamLoad = useCallback(() => {
    setStreamLoaded(true);
  }, []);

  // Handle element ref from StreamWrapper
  const handleElementRef = useCallback((el: HTMLImageElement | HTMLVideoElement | null, type: 'img' | 'video') => {
    elementRef.current = el;
    // Only register for MJPEG recording
    if (canRecord && el && type === 'img') {
      setImgRef(el as HTMLImageElement);
    }
  }, [canRecord, setImgRef]);

  const handleManualRetry = () => {
    setStreamLoaded(false);
    setRetryKey(prev => prev + 1);
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  const handleSnapshot = useCallback(() => {
    if (!elementRef.current || !camera) return;

    const canvas = canvasRef.current || document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const el = elementRef.current;
    
    // Handle both img and video elements
    if (el instanceof HTMLImageElement) {
      canvas.width = el.naturalWidth || el.width;
      canvas.height = el.naturalHeight || el.height;
    } else if (el instanceof HTMLVideoElement) {
      canvas.width = el.videoWidth || el.width;
      canvas.height = el.videoHeight || el.height;
    }

    try {
      ctx.drawImage(el, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) {
          toast({
            title: 'Snapshot failed',
            description: 'Could not capture snapshot. The stream may be cross-origin protected.',
            variant: 'destructive',
          });
          return;
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        a.href = url;
        a.download = `${camera.name.replace(/\s+/g, '_')}_${timestamp}.png`;
        a.click();
        URL.revokeObjectURL(url);

        toast({
          title: 'Snapshot saved',
          description: `Screenshot captured from ${camera.name}`,
        });
      }, 'image/png');
    } catch (err) {
      toast({
        title: 'Snapshot failed',
        description: 'Could not capture snapshot due to CORS restrictions.',
        variant: 'destructive',
      });
    }
  }, [camera]);

  const handleRecordClick = async () => {
    if (!camera) return;
    
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording(camera.streamUrl);
    }
  };

  if (!camera) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-primary" />
            {camera.name}
            <Badge variant="outline" className="ml-2 text-xs gap-1">
              {getStreamTypeIcon(streamType)}
              {getStreamTypeLabel(streamType)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col lg:flex-row">
          {/* Video Player Section */}
          <div className="flex-1 p-4 pt-2">
            <div
              ref={containerRef}
              className={cn(
                "relative bg-black rounded-lg overflow-hidden",
                isFullscreen ? "fixed inset-0 z-50 rounded-none" : "aspect-video"
              )}
            >
              {/* Recording Indicator */}
              {isRecording && (
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-destructive/90 backdrop-blur-sm px-3 py-1.5 rounded-full z-20">
                  <Circle className="w-3 h-3 fill-white text-white animate-pulse" />
                  <span className="text-sm font-semibold text-white">
                    REC {formattedDuration}
                  </span>
                </div>
              )}

              {/* Status Badge */}
              <div className="absolute top-4 right-4 z-20">
                <Badge className={cn(getStatusBadge(camera.status), "text-sm")}>
                  {camera.status}
                </Badge>
              </div>

              {/* Stream using StreamWrapper */}
              <StreamWrapper
                key={retryKey}
                streamUrl={camera.streamUrl}
                cameraName={camera.name}
                cameraId={camera.id}
                streamType={streamType}
                isOffline={isOffline}
                isPlaying={isPlaying}
                onLoad={handleStreamLoad}
                onElementRef={handleElementRef}
                className="w-full h-full"
              />

              {/* Hidden canvas for snapshot */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Control Bar */}
              <div className={cn(
                "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 z-20",
                "flex items-center justify-between gap-2"
              )}>
                <div className="flex items-center gap-2">
                  {/* Play/Pause - Only for MJPEG */}
                  {streamType === 'mjpeg' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 text-white hover:bg-white/20"
                      onClick={togglePlay}
                      disabled={isOffline}
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </Button>
                  )}

                  {/* Refresh */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 text-white hover:bg-white/20"
                    onClick={handleManualRetry}
                    disabled={isOffline}
                  >
                    <RefreshCw className="w-5 h-5" />
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  {/* Snapshot - Not available for YouTube */}
                  {canSnapshot && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 px-3 text-white hover:bg-white/20"
                      onClick={handleSnapshot}
                      disabled={isOffline || !streamLoaded}
                    >
                      <CameraIcon className="w-4 h-4 mr-2" />
                      Snapshot
                    </Button>
                  )}

                  {/* Record - Not available for YouTube */}
                  {canRecord && (
                    <Button
                      variant={isRecording ? 'destructive' : 'ghost'}
                      size="sm"
                      className={cn(
                        "h-9 px-3",
                        !isRecording && "text-white hover:bg-white/20"
                      )}
                      onClick={handleRecordClick}
                      disabled={isOffline || isStarting || isStopping}
                    >
                      {isRecording ? (
                        <>
                          <Square className="w-4 h-4 mr-2" />
                          {isStopping ? 'Stopping...' : 'Stop'}
                        </>
                      ) : (
                        <>
                          <Circle className="w-4 h-4 mr-2" />
                          {isStarting ? 'Starting...' : 'Record'}
                        </>
                      )}
                    </Button>
                  )}

                  {/* Fullscreen */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 text-white hover:bg-white/20"
                    onClick={toggleFullscreen}
                  >
                    {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Info Panel */}
          <div className="lg:w-72 p-4 border-t lg:border-t-0 lg:border-l border-border bg-muted/30">
            <h3 className="text-sm font-semibold text-foreground mb-4">Camera Information</h3>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Location</p>
                  <p className="text-sm font-medium text-foreground">{camera.location}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                {getStreamTypeIcon(streamType)}
                <div>
                  <p className="text-xs text-muted-foreground">Stream Type</p>
                  <p className="text-sm font-medium text-foreground">{getStreamTypeLabel(streamType)}</p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-6 pt-4 border-t border-border">
              <h4 className="text-xs text-muted-foreground mb-3">Quick Actions</h4>
              <div className="space-y-2">
                {canSnapshot && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={handleSnapshot}
                    disabled={isOffline || !streamLoaded}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Snapshot
                  </Button>
                )}
                {!canSnapshot && (
                  <p className="text-xs text-muted-foreground">
                    Snapshot not available for YouTube streams
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
