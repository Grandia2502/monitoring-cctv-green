import { formatDistanceToNowStrict } from 'date-fns';
import { Camera } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlayCircle, Circle, Square, Video } from 'lucide-react';
import { useRecording } from '@/hooks/useRecording';
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

export default function CameraCard({ camera, onRecord, onOpen }: CameraCardProps) {
  const { isRecording, formattedDuration, startRecording, stopRecording } = useRecording(
    camera.id,
    camera.status
  );

  const isOffline = camera.status === 'offline';

  const lastSeenText = camera.lastSeen
    ? formatDistanceToNowStrict(new Date(camera.lastSeen), { addSuffix: true })
    : 'no data';

  const handleRecordClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording(camera.streamUrl);
    }
    onRecord?.();
  };

  return (
    <Card className={cn(
      "transition-[var(--transition-smooth)] hover:shadow-[var(--shadow-lg)]",
      isOffline && "opacity-60 grayscale"
    )}>
      <CardContent className="p-4">
        {/* Recording Timer Overlay */}
        {isRecording && (
          <div className="absolute top-2 right-2 flex items-center gap-2 bg-destructive/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-destructive/20 z-10">
            <Circle className="w-3 h-3 fill-destructive text-destructive animate-pulse" />
            <span className="text-xs font-mono font-semibold text-destructive">
              {formattedDuration}
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
            {onRecord && (
              <Button
                size="sm"
                variant={isRecording ? 'destructive' : 'default'}
                className="h-7 text-xs px-2"
                onClick={handleRecordClick}
                disabled={isOffline}
              >
                {isRecording ? (
                  <>
                    <Square className="h-3 w-3 mr-1" />
                    Stop
                  </>
                ) : (
                  <>
                    <Circle className="h-3 w-3 mr-1" />
                    Record
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

        {/* Stream Preview Placeholder */}
        <div className="relative aspect-video bg-muted rounded-md overflow-hidden mb-3">
          <div className="absolute inset-0 flex items-center justify-center">
            <Video className="w-8 h-8 text-muted-foreground" />
          </div>
          {isOffline && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
              <span className="text-xs font-semibold text-muted-foreground">Camera Offline</span>
            </div>
          )}
        </div>

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
