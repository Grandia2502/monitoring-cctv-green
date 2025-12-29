import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlayCircle, Circle, Square, Radio } from 'lucide-react';
import { useRecording } from '@/hooks/useRecording';
import { useMjpegRecording } from '@/hooks/useMjpegRecording';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { sendCameraHeartbeat, startCameraHeartbeat, setCameraOffline } from '@/lib/cameraHeartbeat';
import { toast } from 'sonner';
import { StreamWrapper } from '@/components/streams/StreamWrapper';
import { detectStreamType, isRecordingSupported } from '@/lib/streamUtils';

const AUTO_PING_INTERVAL_MS = 5000; // 5 seconds

interface CameraCardProps {
  camera: Camera;
  onRecord?: () => void;
  onOpen?: () => void;
  isPlaying?: boolean; // Allow external control of stream playback
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

export default function CameraCard({ camera, onRecord, onOpen, isPlaying = true }: CameraCardProps) {
  const { user } = useAuth();
  const [isAutoPingActive, setIsAutoPingActive] = useState(false);
  const stopHeartbeatRef = useRef<(() => void) | null>(null);
  
  const streamType = (camera as any).streamType || detectStreamType(camera.streamUrl);
  const isMjpeg = streamType === 'mjpeg';
  const canRecord = isRecordingSupported(streamType);

  // HLS recording (browser-side MediaRecorder)
  const {
    isRecording: isHlsRecording,
    formattedDuration: hlsFormattedDuration,
    isStarting: isHlsStarting,
    isStopping: isHlsStopping,
    startRecording: startHlsRecording,
    stopRecording: stopHlsRecording,
    setImgRef,
    setVideoRef,
  } = useRecording(camera.id, camera.status, camera.name, camera.fps);

  // MJPEG recording (server-side via Raspberry Pi API)
  const {
    isRecording: isMjpegRecording,
    isStarting: isMjpegStarting,
    isStopping: isMjpegStopping,
    startRecording: startMjpegRecording,
    stopRecording: stopMjpegRecording,
  } = useMjpegRecording({ 
    cameraId: camera.id, 
    enabled: isMjpeg 
  });

  // Determine which recording state to use based on stream type
  const isRecording = isMjpeg ? isMjpegRecording : isHlsRecording;
  const isStarting = isMjpeg ? isMjpegStarting : isHlsStarting;
  const isStopping = isMjpeg ? isMjpegStopping : isHlsStopping;
  const formattedDuration = isMjpeg ? '' : hlsFormattedDuration;

  // Handle element ref from StreamWrapper - only register for HLS (browser recording)
  const handleElementRef = useCallback((el: HTMLImageElement | HTMLVideoElement | null, type: 'img' | 'video') => {
    // Only register refs for HLS recording (browser-side)
    if (!isMjpeg && canRecord && el) {
      if (type === 'img') {
        setImgRef(el as HTMLImageElement);
      } else if (type === 'video') {
        setVideoRef(el as HTMLVideoElement);
      }
    }
  }, [isMjpeg, canRecord, setImgRef, setVideoRef]);
  
  const isAdmin = !!user;
  const isOffline = camera.status === 'offline';

  // Cleanup heartbeat on unmount
  useEffect(() => {
    return () => {
      if (stopHeartbeatRef.current) {
        stopHeartbeatRef.current();
      }
    };
  }, []);

  // Handle stream load success - start heartbeat and mark online
  const handleStreamLoad = useCallback(async () => {
    console.log(`Stream loaded for ${camera.name}, sending heartbeat`);
    await sendCameraHeartbeat(camera.id);
    
    // Start auto-ping if not already active
    if (!stopHeartbeatRef.current) {
      stopHeartbeatRef.current = startCameraHeartbeat(camera.id, AUTO_PING_INTERVAL_MS);
      setIsAutoPingActive(true);
      console.log(`Auto-started ping for ${camera.name} after stream load`);
    }
  }, [camera.id, camera.name]);

  // Handle stream error - stop heartbeat and mark offline
  const handleStreamError = useCallback(async () => {
    console.log(`Stream error for ${camera.name}, marking offline`);
    
    // Stop heartbeat
    if (stopHeartbeatRef.current) {
      stopHeartbeatRef.current();
      stopHeartbeatRef.current = null;
    }
    setIsAutoPingActive(false);
    
    // Mark camera as offline in database
    await setCameraOffline(camera.id);
  }, [camera.id, camera.name]);

  const handleRecordClick = async () => {
    if (isRecording) {
      // Stop recording
      if (isMjpeg) {
        await stopMjpegRecording();
      } else {
        await stopHlsRecording();
      }
    } else {
      // Start recording
      if (isMjpeg) {
        await startMjpegRecording();
      } else {
        await startHlsRecording(camera.streamUrl);
      }
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
              {isMjpeg ? 'Recording (Server)' : `Recording ${formattedDuration}`}
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
            {/* Stream Type Badge */}
            {isMjpeg && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                MJPEG
              </Badge>
            )}
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
            isPlaying={isPlaying}
            onLoad={handleStreamLoad}
            onError={handleStreamError}
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
                  {isStopping ? 'Stopping…' : isMjpeg ? 'Stop Recording' : `Stop Recording (${formattedDuration})`}
                </>
              ) : (
                <>
                  <Circle className="h-3 w-3 mr-1.5" />
                  {isStarting ? 'Starting…' : isMjpeg ? 'Start Recording (Server)' : 'Start Recording'}
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
