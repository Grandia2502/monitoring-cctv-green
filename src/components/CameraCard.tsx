import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlayCircle, Circle, Square, RefreshCw, Loader2, Radio } from 'lucide-react';
import { useRecording } from '@/hooks/useRecording';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { sendCameraHeartbeat, setCameraOffline, startCameraHeartbeat } from '@/lib/cameraHeartbeat';
import { toast } from 'sonner';

// Auto-retry configuration
const RETRY_INTERVAL_MS = 10000; // 10 seconds
const MAX_RETRIES = 5;
const AUTO_PING_INTERVAL_MS = 5000; // 5 seconds

interface CameraCardProps {
  camera: Camera;
  onRecord?: () => void;
  onOpen?: () => void;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'online':
      return 'text-status-online';
    case 'recording':
      return 'text-destructive';
    case 'offline':
      return 'text-status-offline';
    default:
      return 'text-muted-foreground';
  }
}

function getStatusBadge(status: string) {
  const variants = {
    online: 'bg-status-online text-white',
    offline: 'bg-status-offline text-white',
    recording: 'bg-destructive text-white'
  };
  return variants[status as keyof typeof variants] || 'bg-muted';
}

interface MjpegStreamPreviewProps {
  streamUrl: string;
  isOffline: boolean;
  cameraName: string;
  cameraId: string;
  onImgRefChange: (el: HTMLImageElement | null) => void;
  onStreamStatusChange?: (isAvailable: boolean) => void;
  onStreamSuccess?: () => void;
}

function MjpegStreamPreview({ 
  streamUrl, 
  isOffline, 
  cameraName, 
  cameraId, 
  onImgRefChange, 
  onStreamStatusChange,
  onStreamSuccess 
}: MjpegStreamPreviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);
  const hasReportedError = useRef(false);
  const hasReportedOnline = useRef(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Notify parent when img ref changes
  useEffect(() => {
    onImgRefChange(imgRef.current);
  }, [onImgRefChange, retryKey]);

  // Reset error tracking on retry
  useEffect(() => {
    hasReportedError.current = false;
    hasReportedOnline.current = false;
  }, [retryKey]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  // Auto-retry logic
  useEffect(() => {
    if (hasError && retryCount < MAX_RETRIES && !isOffline) {
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
        console.log(`Auto-retry ${retryCount + 1}/${MAX_RETRIES} for ${cameraName}`);
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
  }, [hasError, retryCount, cameraName, isOffline]);

  const handleLoad = useCallback(async () => {
    setIsLoading(false);
    setHasError(false);
    setRetryCount(0); // Reset retry count on success
    setCountdown(0);
    onStreamStatusChange?.(true);
    onStreamSuccess?.();
    
    // Send heartbeat when stream successfully loads (only once per retry cycle)
    if (!hasReportedOnline.current) {
      hasReportedOnline.current = true;
      console.log(`Stream loaded for ${cameraName}, sending heartbeat`);
      await sendCameraHeartbeat(cameraId);
    }
  }, [cameraId, cameraName, onStreamStatusChange, onStreamSuccess]);

  const handleError = useCallback(async () => {
    setIsLoading(false);
    setHasError(true);
    onStreamStatusChange?.(false);
    
    // Set camera offline when stream fails (only once per retry cycle)
    if (!hasReportedError.current) {
      hasReportedError.current = true;
      console.log(`Stream error for ${cameraName}, setting offline`);
      await setCameraOffline(cameraId);
    }
  }, [cameraId, cameraName, onStreamStatusChange]);

  const handleManualRetry = () => {
    // Clear any pending auto-retry
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    
    setIsLoading(true);
    setHasError(false);
    setRetryCount(0); // Reset retry count on manual retry
    setCountdown(0);
    setRetryKey(prev => prev + 1);
  };

  const isAutoRetrying = hasError && retryCount < MAX_RETRIES && countdown > 0;
  const hasExhaustedRetries = hasError && retryCount >= MAX_RETRIES;

  return (
    <div className="relative aspect-video bg-muted rounded-md overflow-hidden">
      {/* Loading Indicator */}
      {!isOffline && isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-muted">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
            <span className="text-xs text-muted-foreground">
              {retryCount > 0 ? `Reconnecting... (${retryCount}/${MAX_RETRIES})` : 'Loading stream...'}
            </span>
          </div>
        </div>
      )}
      
      {/* Offline State */}
      {isOffline && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
          <span className="text-xs font-semibold text-muted-foreground">Camera Offline</span>
        </div>
      )}
      
      {/* Auto-Retry State */}
      {!isOffline && isAutoRetrying && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-muted">
          <RefreshCw className="w-5 h-5 text-primary animate-spin mb-2" />
          <span className="text-xs text-muted-foreground mb-1">Reconnecting in {countdown}s...</span>
          <span className="text-[10px] text-muted-foreground">Attempt {retryCount + 1}/{MAX_RETRIES}</span>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleManualRetry}
            className="h-6 text-[10px] mt-2"
          >
            Retry Now
          </Button>
        </div>
      )}
      
      {/* Error State - Exhausted Retries */}
      {!isOffline && hasExhaustedRetries && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-muted">
          <span className="text-xs text-muted-foreground mb-2">Stream unavailable</span>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleManualRetry}
            className="h-7 text-xs"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Retry
          </Button>
        </div>
      )}
      
      {/* MJPEG Stream Image - Always render for ref registration */}
      <img
        key={retryKey}
        ref={imgRef}
        src={!isOffline && !hasError ? streamUrl : undefined}
        alt={`Live stream from ${cameraName}`}
        crossOrigin="anonymous"
        className={cn(
          "w-full h-full object-cover",
          (isLoading || hasError || isOffline) && "opacity-0 absolute pointer-events-none"
        )}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
}

export default function CameraCard({ camera, onRecord, onOpen }: CameraCardProps) {
  const { user } = useAuth();
  const [isAutoPingActive, setIsAutoPingActive] = useState(false);
  const stopHeartbeatRef = useRef<(() => void) | null>(null);
  const hasAutoStarted = useRef(false);
  
  const {
    isRecording,
    formattedDuration,
    isStarting,
    isStopping,
    startRecording,
    stopRecording,
    recordingId,
    setImgRef,
  } = useRecording(camera.id, camera.status, camera.name, camera.fps);
  
  const isAdmin = !!user;
  const isOffline = camera.status === 'offline';

  // Auto-start heartbeat on mount (only once)
  useEffect(() => {
    if (!hasAutoStarted.current && !isOffline) {
      hasAutoStarted.current = true;
      stopHeartbeatRef.current = startCameraHeartbeat(camera.id, AUTO_PING_INTERVAL_MS);
      setIsAutoPingActive(true);
      console.log(`Auto-started ping for ${camera.name}`);
    }
    
    return () => {
      if (stopHeartbeatRef.current) {
        stopHeartbeatRef.current();
      }
    };
  }, [camera.id, camera.name, isOffline]);

  // Handle stream success - ensure heartbeat is active
  const handleStreamSuccess = useCallback(() => {
    if (!isAutoPingActive && !stopHeartbeatRef.current) {
      stopHeartbeatRef.current = startCameraHeartbeat(camera.id, AUTO_PING_INTERVAL_MS);
      setIsAutoPingActive(true);
    }
  }, [camera.id, isAutoPingActive]);

  const handleRecordClick = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording(camera.streamUrl);
    }
    onRecord?.();
  };

  const handleToggleAutoPing = () => {
    if (isAutoPingActive) {
      // Stop heartbeat
      if (stopHeartbeatRef.current) {
        stopHeartbeatRef.current();
        stopHeartbeatRef.current = null;
      }
      setIsAutoPingActive(false);
      toast.info(`Auto Ping stopped for ${camera.name}`);
    } else {
      // Start heartbeat with 5 second interval
      stopHeartbeatRef.current = startCameraHeartbeat(camera.id, AUTO_PING_INTERVAL_MS);
      setIsAutoPingActive(true);
      toast.success(`Auto Ping started for ${camera.name}`, {
        description: 'Sending ping every 5 seconds'
      });
    }
  };

  return (
    <Card className={cn(
      "transition-[var(--transition-smooth)] hover:shadow-[var(--shadow-lg)]",
      isOffline && "opacity-60 grayscale"
    )}>
      <CardContent className="p-4">
        {/* Recording Indicator */}
        {isRecording && (
          <div className="absolute top-2 right-2 flex items-center gap-2 bg-destructive/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-destructive/20 z-10">
            <Circle className="w-3 h-3 fill-destructive text-destructive animate-pulse" />
            <span className="text-xs font-semibold text-destructive">
              Recording {formattedDuration}
            </span>
          </div>
        )}

        {/* Header: Camera Info */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Circle 
              className={cn(
                "w-2.5 h-2.5 flex-shrink-0 fill-current",
                getStatusColor(camera.status),
                (camera.status === 'online' || camera.status === 'recording') && 'animate-pulse'
              )}
            />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-card-foreground truncate">
                {camera.name}
              </h3>
              <p className="text-xs text-muted-foreground truncate">
                {camera.location}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
            {/* Status Badge */}
            <Badge className={getStatusBadge(camera.status)} variant="secondary">
              {camera.status}
            </Badge>
            {/* Auto Ping Toggle */}
            <Button
              size="sm"
              variant={isAutoPingActive ? "default" : "outline"}
              className={cn(
                "h-7 w-7 p-0",
                isAutoPingActive && "bg-primary text-primary-foreground"
              )}
              onClick={handleToggleAutoPing}
              title={isAutoPingActive ? "Stop Auto Ping" : "Start Auto Ping"}
            >
              <Radio className={cn("h-3.5 w-3.5", isAutoPingActive && "animate-pulse")} />
            </Button>
            {/* Open Stream */}
            {onOpen && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={onOpen}
                title="Open Stream"
              >
                <PlayCircle className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* MJPEG Stream Preview - 16:9 Aspect Ratio */}
        <div className="mb-3">
          <MjpegStreamPreview 
            streamUrl={camera.streamUrl} 
            isOffline={isOffline}
            cameraName={camera.name}
            cameraId={camera.id}
            onImgRefChange={setImgRef}
            onStreamSuccess={handleStreamSuccess}
          />
        </div>

        {/* Footer: Recording */}
        <div className="space-y-2">
          {isAutoPingActive && (
            <div className="flex items-center justify-end text-xs">
              <span className="text-primary text-[10px] font-medium">Auto Ping Active</span>
            </div>
          )}
          
          {/* Recording Button */}
          {isAdmin && onRecord && (
            <Button
              size="sm"
              variant={isRecording ? 'destructive' : 'secondary'}
              className="w-full h-8 text-xs"
              onClick={handleRecordClick}
              disabled={isOffline || isStarting || (isRecording && isStopping)}
            >
              {isRecording ? (
                <>
                  <Square className="h-3 w-3 mr-1.5" />
                  {isStopping ? 'Stopping…' : `Stop Recording (${formattedDuration})`}
                </>
              ) : (
                <>
                  <Circle className="h-3 w-3 mr-1.5" />
                  {isStarting ? 'Starting…' : 'Start Recording'}
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
