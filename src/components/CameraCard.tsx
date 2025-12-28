import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlayCircle, Circle, Square, Radio } from 'lucide-react';
import { useRecording } from '@/hooks/useRecording';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { sendCameraHeartbeat, startCameraHeartbeat } from '@/lib/cameraHeartbeat';
import { toast } from 'sonner';
import { StreamWrapper } from '@/components/streams/StreamWrapper';
import { detectStreamType, isRecordingSupported } from '@/lib/streamUtils';

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

// Removed MjpegStreamPreview - now using StreamWrapper

export default function CameraCard({ camera, onRecord, onOpen }: CameraCardProps) {
  const { user } = useAuth();
  const [isAutoPingActive, setIsAutoPingActive] = useState(false);
  const stopHeartbeatRef = useRef<(() => void) | null>(null);
  const hasAutoStarted = useRef(false);
  
  const streamType = (camera as any).streamType || detectStreamType(camera.streamUrl);
  const canRecord = isRecordingSupported(streamType);

  const {
    isRecording,
    formattedDuration,
    isStarting,
    isStopping,
    startRecording,
    stopRecording,
    setImgRef,
  } = useRecording(camera.id, camera.status, camera.name, camera.fps);

  // Handle element ref from StreamWrapper
  const handleElementRef = useCallback((el: HTMLImageElement | HTMLVideoElement | null, type: 'img' | 'video') => {
    if (canRecord && el && type === 'img') {
      setImgRef(el as HTMLImageElement);
    }
  }, [canRecord, setImgRef]);
  
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

  // Handle stream load for heartbeat
  const handleStreamLoad = useCallback(async () => {
    console.log(`Stream loaded for ${camera.name}, sending heartbeat`);
    await sendCameraHeartbeat(camera.id);
    handleStreamSuccess();
  }, [camera.id, camera.name, handleStreamSuccess]);

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

        {/* Stream Preview - Supports MJPEG, HLS, YouTube */}
        <div className="mb-3">
          <StreamWrapper
            streamUrl={camera.streamUrl}
            cameraName={camera.name}
            cameraId={camera.id}
            streamType={streamType}
            isOffline={isOffline}
            onLoad={handleStreamLoad}
            onElementRef={handleElementRef}
          />
        </div>

        {/* Footer: Recording */}
        <div className="space-y-2">
          {isAutoPingActive && (
            <div className="flex items-center justify-end text-xs">
              <span className="text-primary text-[10px] font-medium">Auto Ping Active</span>
            </div>
          )}
          
          {/* Recording Button - Only show if stream type supports recording */}
          {isAdmin && onRecord && canRecord && (
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
