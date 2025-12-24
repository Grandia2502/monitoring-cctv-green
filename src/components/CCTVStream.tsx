import { useState, useRef, useEffect } from 'react';
import { Play, AlertCircle, Wifi, WifiOff, Circle, Square, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera } from '@/types';
import { cn } from '@/lib/utils';
import { useRecording } from '@/hooks/useRecording';

interface CCTVStreamProps {
  camera: Camera;
  onViewDetails?: (camera: Camera) => void;
}

export const CCTVStream = ({ camera, onViewDetails }: CCTVStreamProps) => {
  const [isPlaying, setIsPlaying] = useState(true); // Auto-play MJPEG by default
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);

  const { isRecording, formattedDuration, isStarting, isStopping, startRecording, stopRecording, setImgRef } = useRecording(
    camera.id,
    camera.status,
    camera.name,
    camera.fps
  );

  // Register img ref whenever it changes
  useEffect(() => {
    setImgRef(imgRef.current);
  }, [setImgRef, retryKey]);

  const getStatusIcon = () => {
    switch (camera.status) {
      case 'online':
        return <Wifi className="h-4 w-4" />;
      case 'offline':
        return <WifiOff className="h-4 w-4" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <WifiOff className="h-4 w-4" />;
    }
  };

  const getStatusColor = () => {
    switch (camera.status) {
      case 'online':
        return 'bg-status-online text-white';
      case 'offline':
        return 'bg-status-offline text-white';
      case 'warning':
        return 'bg-status-warning text-white';
      default:
        return 'bg-muted';
    }
  };

  const handleStreamLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleStreamError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const handleRetry = () => {
    setIsLoading(true);
    setHasError(false);
    setRetryKey(prev => prev + 1);
  };

  const handlePlayClick = () => {
    if (camera.status === 'offline' || !camera.streamUrl) {
      setHasError(true);
      return;
    }
    if (!isPlaying) {
      setIsLoading(true);
      setHasError(false);
      setRetryKey(prev => prev + 1);
    }
    setIsPlaying(!isPlaying);
  };

  const handleRecordClick = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording(camera.streamUrl);
    }
  };

  const isOffline = camera.status === 'offline';

  return (
    <div className="bg-card rounded-lg border shadow-[var(--shadow-card)] overflow-hidden hover:shadow-[var(--shadow-lg)] transition-[var(--transition-smooth)]">
      {/* Camera Stream Area - MJPEG via <img> */}
      <div className="relative h-[240px] bg-muted">
        {/* Loading Indicator */}
        {isPlaying && isLoading && !hasError && camera.streamUrl && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-muted">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
              <span className="text-sm text-muted-foreground">Loading stream...</span>
            </div>
          </div>
        )}

        {/* Error State or Stream Unavailable */}
        {(hasError || !camera.streamUrl || isOffline) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-muted">
            <AlertCircle className="h-12 w-12 mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-3">
              {isOffline ? 'Camera Offline' : 'Stream unavailable'}
            </p>
            {!isOffline && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleRetry}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Retry
              </Button>
            )}
          </div>
        )}

        {/* Not Playing State */}
        {!isPlaying && !hasError && !isOffline && camera.streamUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-muted">
            <Play className="h-12 w-12 mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Click Play to view stream</p>
          </div>
        )}

        {/* MJPEG Stream Image - Always render for recording */}
        <img
          key={retryKey}
          ref={imgRef}
          src={!isOffline && camera.streamUrl && isPlaying && !hasError ? camera.streamUrl : undefined}
          alt={`Live stream from ${camera.name}`}
          crossOrigin="anonymous"
          className={cn(
            "w-full h-full object-cover",
            (!isPlaying || isLoading || hasError || isOffline || !camera.streamUrl) && "opacity-0 absolute pointer-events-none"
          )}
          onLoad={handleStreamLoad}
          onError={handleStreamError}
        />
        
        {/* Status Badge */}
        <Badge 
          className={`absolute top-2 right-2 ${getStatusColor()}`}
        >
          {getStatusIcon()}
          <span className="ml-1 capitalize">{camera.status}</span>
        </Badge>

        {/* Recording Indicator */}
        {isRecording && (
          <div className="absolute top-2 left-2 flex items-center gap-2 bg-destructive text-destructive-foreground px-3 py-1.5 rounded-full">
            <Circle className="h-3 w-3 fill-current animate-pulse" />
            <span className="text-xs font-medium">Recording {formattedDuration}</span>
          </div>
        )}
      </div>

      {/* Camera Info */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-semibold text-card-foreground">{camera.name}</h3>
            <p className="text-sm text-muted-foreground">{camera.location}</p>
          </div>
        </div>
        
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
          <span>{camera.resolution}</span>
          <span>{camera.fps} FPS</span>
        </div>
        
        <div className="flex gap-2">
          <Button 
            size="sm" 
            onClick={handlePlayClick}
            disabled={camera.status === 'offline'}
            className="flex-1"
          >
            <Play className="h-4 w-4 mr-1" />
            {isPlaying ? 'Stop' : 'Play'}
          </Button>

          <Button
            size="sm"
            variant={isRecording ? 'destructive' : 'default'}
            onClick={handleRecordClick}
            disabled={camera.status === 'offline' || isStarting || (isRecording && isStopping)}
          >
            {isRecording ? (
              <>
                <Square className="h-4 w-4 mr-1" />
                {isStopping ? 'Stopping…' : 'Stop Recording'}
              </>
            ) : (
              <>
                <Circle className="h-4 w-4 mr-1" />
                {isStarting ? 'Starting…' : 'Start Recording'}
              </>
            )}
          </Button>
          
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => onViewDetails?.(camera)}
          >
            Details
          </Button>
        </div>
        
        <p className="text-xs text-muted-foreground mt-2">
          Last seen: {new Date(camera.lastSeen).toLocaleString()}
        </p>
      </div>

    </div>
  );
};