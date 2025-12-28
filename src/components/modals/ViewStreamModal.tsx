import { useState, useRef, useEffect, useCallback } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
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
  Loader2,
  Download,
  MapPin,
  Monitor,
} from 'lucide-react';
import { useRecording } from '@/hooks/useRecording';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

// Auto-retry configuration
const RETRY_INTERVAL_MS = 10000; // 10 seconds
const MAX_RETRIES = 5;

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

export function ViewStreamModal({ open, onOpenChange, camera }: ViewStreamModalProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [countdown, setCountdown] = useState(0);
  
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Register img ref for recording
  useEffect(() => {
    if (imgRef.current && camera) {
      setImgRef(imgRef.current);
    }
  }, [camera, setImgRef, retryKey]);

  // Reset states when modal opens/closes or camera changes
  useEffect(() => {
    if (open && camera) {
      setIsLoading(true);
      setHasError(false);
      setIsPlaying(true);
      setRetryCount(0);
      setCountdown(0);
      setRetryKey(prev => prev + 1);
    }
    
    // Cleanup timers when modal closes
    if (!open) {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
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

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  // Auto-retry logic
  useEffect(() => {
    if (hasError && retryCount < MAX_RETRIES && !isOffline && open) {
      // Start countdown
      setCountdown(RETRY_INTERVAL_MS / 1000);
      
      countdownIntervalRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      retryTimeoutRef.current = setTimeout(() => {
        console.log(`Auto-retry ${retryCount + 1}/${MAX_RETRIES} for modal stream`);
        setIsLoading(true);
        setHasError(false);
        setRetryCount(prev => prev + 1);
        setRetryKey(prev => prev + 1);
      }, RETRY_INTERVAL_MS);

      return () => {
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      };
    }
  }, [hasError, retryCount, isOffline, open]);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
    setRetryCount(0);
    setCountdown(0);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const handleManualRetry = () => {
    // Clear any pending auto-retry
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    
    setIsLoading(true);
    setHasError(false);
    setRetryCount(0);
    setCountdown(0);
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
    if (!imgRef.current || !camera) return;

    const canvas = canvasRef.current || document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imgRef.current;
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;

    try {
      ctx.drawImage(img, 0, 0);
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

  const isAutoRetrying = hasError && retryCount < MAX_RETRIES && countdown > 0;
  const hasExhaustedRetries = hasError && retryCount >= MAX_RETRIES;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-primary" />
            {camera.name}
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
              {/* Loading State */}
              {!isOffline && isLoading && !hasError && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-black">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                    <span className="text-sm text-muted-foreground">
                      {retryCount > 0 ? `Reconnecting... (${retryCount}/${MAX_RETRIES})` : 'Loading stream...'}
                    </span>
                  </div>
                </div>
              )}

              {/* Offline State */}
              {isOffline && (
                <div className="absolute inset-0 bg-black flex flex-col items-center justify-center z-10">
                  <Monitor className="w-12 h-12 text-muted-foreground mb-3" />
                  <span className="text-lg font-semibold text-muted-foreground">Camera Offline</span>
                </div>
              )}

              {/* Auto-Retry State */}
              {!isOffline && isAutoRetrying && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black">
                  <RefreshCw className="w-8 h-8 text-primary animate-spin mb-3" />
                  <span className="text-lg text-muted-foreground mb-1">Reconnecting in {countdown}s...</span>
                  <span className="text-sm text-muted-foreground mb-3">Attempt {retryCount + 1}/{MAX_RETRIES}</span>
                  <Button variant="outline" onClick={handleManualRetry}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry Now
                  </Button>
                </div>
              )}

              {/* Error State - Exhausted Retries */}
              {!isOffline && hasExhaustedRetries && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black">
                  <Monitor className="w-12 h-12 text-muted-foreground mb-3" />
                  <span className="text-lg text-muted-foreground mb-3">Stream unavailable</span>
                  <Button variant="outline" onClick={handleManualRetry}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry Connection
                  </Button>
                </div>
              )}

              {/* Paused Overlay */}
              {!isPlaying && !isOffline && !hasError && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                  <Button
                    variant="ghost"
                    size="lg"
                    className="w-16 h-16 rounded-full bg-white/20 hover:bg-white/30"
                    onClick={togglePlay}
                  >
                    <Play className="w-8 h-8 text-white" />
                  </Button>
                </div>
              )}

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

              {/* MJPEG Stream */}
              <img
                key={retryKey}
                ref={imgRef}
                src={!isOffline && !hasError && isPlaying ? camera.streamUrl : undefined}
                alt={`Live stream from ${camera.name}`}
                crossOrigin="anonymous"
                className={cn(
                  "w-full h-full object-contain",
                  (isLoading || hasError || isOffline || !isPlaying) && "opacity-0"
                )}
                onLoad={handleLoad}
                onError={handleError}
              />

              {/* Hidden canvas for snapshot */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Control Bar */}
              <div className={cn(
                "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 z-20",
                "flex items-center justify-between gap-2"
              )}>
                <div className="flex items-center gap-2">
                  {/* Play/Pause */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 text-white hover:bg-white/20"
                    onClick={togglePlay}
                    disabled={isOffline || hasError}
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </Button>

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
                  {/* Snapshot */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-3 text-white hover:bg-white/20"
                    onClick={handleSnapshot}
                    disabled={isOffline || hasError || isLoading}
                  >
                    <CameraIcon className="w-4 h-4 mr-2" />
                    Snapshot
                  </Button>

                  {/* Record */}
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

            </div>

            {/* Quick Actions */}
            <div className="mt-6 pt-4 border-t border-border">
              <h4 className="text-xs text-muted-foreground mb-3">Quick Actions</h4>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={handleSnapshot}
                  disabled={isOffline || hasError || isLoading}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Snapshot
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
