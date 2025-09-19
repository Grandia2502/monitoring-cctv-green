import { useState } from 'react';
import { Play, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera } from '@/types';

interface CCTVStreamProps {
  camera: Camera;
  onViewDetails?: (camera: Camera) => void;
}

export const CCTVStream = ({ camera, onViewDetails }: CCTVStreamProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);

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

  const handlePlayClick = () => {
    if (camera.status === 'offline' || !camera.streamUrl) {
      setHasError(true);
      return;
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="bg-card rounded-lg border shadow-[var(--shadow-card)] overflow-hidden hover:shadow-[var(--shadow-lg)] transition-[var(--transition-smooth)]">
      {/* Camera Stream Area */}
      <div className="relative aspect-video bg-muted flex items-center justify-center">
        {isPlaying && !hasError && camera.streamUrl ? (
          <video 
            autoPlay 
            controls 
            className="w-full h-full object-cover"
            onError={() => setHasError(true)}
          >
            <source src={camera.streamUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        ) : (
          <div className="flex flex-col items-center justify-center text-muted-foreground">
            {hasError || !camera.streamUrl ? (
              <>
                <AlertCircle className="h-12 w-12 mb-2" />
                <p className="text-sm">Stream unavailable</p>
              </>
            ) : (
              <>
                <Play className="h-12 w-12 mb-2" />
                <p className="text-sm">Click to play stream</p>
              </>
            )}
          </div>
        )}
        
        {/* Status Badge */}
        <Badge 
          className={`absolute top-2 right-2 ${getStatusColor()}`}
        >
          {getStatusIcon()}
          <span className="ml-1 capitalize">{camera.status}</span>
        </Badge>
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