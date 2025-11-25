import { formatDistanceToNowStrict } from 'date-fns';
import { Camera } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlayCircle, Circle } from 'lucide-react';

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
  const lastSeenText = camera.lastSeen
    ? formatDistanceToNowStrict(new Date(camera.lastSeen), { addSuffix: true })
    : 'no data';

  return (
    <Card className="transition-[var(--transition-smooth)] hover:shadow-[var(--shadow-lg)]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 flex-1">
            <Circle 
              className={`w-3 h-3 ${getStatusColor(camera.status)} animate-pulse fill-current`}
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
                variant={camera.status === 'recording' ? 'destructive' : 'default'}
                className="h-7 text-xs px-2"
                onClick={onRecord}
              >
                {camera.status === 'recording' ? 'Stop' : 'Record'}
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
