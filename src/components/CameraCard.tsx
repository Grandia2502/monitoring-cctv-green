import { useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { Camera } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlayCircle, Circle, Square, RefreshCw, Loader2 } from 'lucide-react';
import { useRecording } from '@/hooks/useRecording';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

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
    case 'warning':
      return 'text-status-warning';
    default:
      return 'text-muted-foreground';
  }
}

function getStatusBadge(status: string) {
  const variants = {
    online: 'bg-status-online text-white',
    offline: 'bg-status-offline text-white',
    warning: 'bg-status-warning text-white',
    recording: 'bg-destructive text-white'
  };
  return variants[status as keyof typeof variants] || 'bg-muted';
}

interface MjpegStreamPreviewProps {
  streamUrl: string;
  isOffline: boolean;
  cameraName: string;
  imgRef?: (el: HTMLImageElement | null) => void;
}

function MjpegStreamPreview({ streamUrl, isOffline, cameraName, imgRef }: MjpegStreamPreviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const handleRetry = () => {
    setIsLoading(true);
    setHasError(false);
    setRetryKey(prev => prev + 1);
  };

  if (isOffline) {
    return (
      <div className="relative h-[180px] bg-muted rounded-md overflow-hidden mb-3">
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
          <span className="text-xs font-semibold text-muted-foreground">Camera Offline</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[180px] bg-muted rounded-md overflow-hidden mb-3">
      {/* Loading Indicator */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-muted">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
            <span className="text-xs text-muted-foreground">Loading stream...</span>
          </div>
        </div>
      )}
      
      {/* Error State */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-muted">
          <span className="text-xs text-muted-foreground mb-2">Stream unavailable</span>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleRetry}
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
        src={!hasError ? streamUrl : undefined}
        alt={`Live stream from ${cameraName}`}
        className={cn(
          "w-full h-full object-cover",
          (isLoading || hasError) && "opacity-0 absolute"
        )}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
}

export default function CameraCard({ camera, onRecord, onOpen }: CameraCardProps) {
  const { user } = useAuth();
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
  
  const isAdmin = !!user; // All authenticated users are treated as admin

  const isOffline = camera.status === 'offline';

  const lastSeenText = camera.lastSeen
    ? formatDistanceToNowStrict(new Date(camera.lastSeen), { addSuffix: true })
    : 'no data';

  const handleRecordClick = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording(camera.streamUrl);
    }
    onRecord?.();
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

        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 flex-1">
            <Circle 
              className={`w-3 h-3 ${getStatusColor(camera.status)} ${camera.status === 'online' || camera.status === 'recording' ? 'animate-pulse' : ''} fill-current`}
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
          <div className="flex items-center gap-2 ml-2">
            {isAdmin && onRecord && (
              <Button
                size="sm"
                variant={isRecording ? 'destructive' : 'default'}
                className="h-7 text-xs px-2"
                onClick={handleRecordClick}
                disabled={isOffline || isStarting || (isRecording && isStopping) || (!isRecording && isStarting)}
              >
                {isRecording ? (
                  <>
                    <Square className="h-3 w-3 mr-1" />
                    {isStopping ? 'Stopping…' : 'Stop Recording'}
                  </>
                ) : (
                  <>
                    <Circle className="h-3 w-3 mr-1" />
                    {isStarting ? 'Starting…' : 'Start Recording'}
                  </>
                )}
              </Button>
            )}
            {onOpen && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={onOpen}
              >
                <PlayCircle className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* MJPEG Stream Preview */}
        <MjpegStreamPreview 
          streamUrl={camera.streamUrl} 
          isOffline={isOffline}
          cameraName={camera.name}
          imgRef={setImgRef}
        />

        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Status:</span>
            <Badge className={getStatusBadge(camera.status)} variant="secondary">
              {camera.status}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Resolution:</span>
            <span className="font-medium text-card-foreground">{camera.resolution}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>FPS:</span>
            <span className="font-medium text-card-foreground">{camera.fps}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Last seen:</span>
            <span className="font-medium text-card-foreground">{lastSeenText}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
