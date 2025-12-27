import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Activity, PlayCircle, StopCircle, RefreshCw } from 'lucide-react';
import { sendCameraHeartbeat, triggerHeartbeatCheck, startCameraHeartbeat } from '@/lib/cameraHeartbeat';
import { Camera } from '@/types';

interface HeartbeatTestPanelProps {
  cameras: Camera[];
  onRefresh?: () => void;
}

export default function HeartbeatTestPanel({ cameras, onRefresh }: HeartbeatTestPanelProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeHeartbeats, setActiveHeartbeats] = useState<Set<string>>(new Set());
  const stopFunctions = useRef<Map<string, () => void>>(new Map());

  // Cleanup all heartbeats on unmount
  useEffect(() => {
    return () => {
      stopFunctions.current.forEach((stop) => stop());
      stopFunctions.current.clear();
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    toast.info('Refreshing cameras...');
    onRefresh?.();
    // Small delay to show loading state
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleManualCheck = async () => {
    setIsChecking(true);
    toast.info('Running heartbeat check...');
    
    const result = await triggerHeartbeatCheck();
    
    setIsChecking(false);
    
    if (result.success) {
      toast.success('Heartbeat check completed', {
        description: result.data?.message || 'All cameras checked'
      });
      // Refresh cameras after check
      onRefresh?.();
    } else {
      toast.error('Heartbeat check failed', {
        description: result.error
      });
    }
  };

  const handleSendPing = async (cameraId: string, cameraName: string) => {
    const result = await sendCameraHeartbeat(cameraId);
    
    if (result.success) {
      toast.success(`Ping sent for ${cameraName}`);
      onRefresh?.();
    } else {
      toast.error(`Failed to ping ${cameraName}`, {
        description: result.error
      });
    }
  };

  const handleToggleHeartbeat = (cameraId: string, cameraName: string) => {
    if (activeHeartbeats.has(cameraId)) {
      // Stop heartbeat
      const stopFn = stopFunctions.current.get(cameraId);
      if (stopFn) {
        stopFn();
        stopFunctions.current.delete(cameraId);
      }
      setActiveHeartbeats(prev => {
        const newSet = new Set(prev);
        newSet.delete(cameraId);
        return newSet;
      });
      toast.info(`Stopped heartbeat simulation for ${cameraName}`);
    } else {
      // Start heartbeat with 5 second interval
      const stopHeartbeat = startCameraHeartbeat(cameraId, 5000);
      stopFunctions.current.set(cameraId, stopHeartbeat);
      setActiveHeartbeats(prev => new Set(prev).add(cameraId));
      toast.success(`Started heartbeat simulation for ${cameraName}`, {
        description: 'Sending ping every 5 seconds'
      });
    }
  };

  return (
    <Card className="border-accent/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-accent" />
              Heartbeat Monitor Testing
            </CardTitle>
            <CardDescription>
              Test camera heartbeat system and offline detection
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              onClick={handleRefresh} 
              disabled={isRefreshing}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button 
              onClick={handleManualCheck} 
              disabled={isChecking}
              variant="outline"
            >
              {isChecking ? 'Checking...' : 'Run Manual Check'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground mb-4 p-3 bg-muted/50 rounded-lg">
            <p className="font-medium mb-1">Heartbeat Configuration:</p>
            <p>• Cameras not pinging for <span className="font-semibold text-destructive">20 seconds</span> will be marked offline</p>
            <p>• Auto Ping sends heartbeat every <span className="font-semibold text-primary">5 seconds</span></p>
            <p>• Stream availability automatically updates camera status</p>
          </div>
          
          {cameras.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cameras available</p>
          ) : (
            <div className="space-y-2">
              {cameras.map((camera) => {
                const isActive = activeHeartbeats.has(camera.id);
                return (
                  <div 
                    key={camera.id} 
                    className="flex items-center justify-between p-3 rounded-lg bg-card/50 border"
                  >
                    <div className="flex items-center gap-3">
                      <Badge 
                        variant="secondary"
                        className={
                          camera.status === 'online' 
                            ? 'bg-status-online text-white' 
                            : camera.status === 'offline'
                            ? 'bg-status-offline text-white'
                            : 'bg-destructive text-white'
                        }
                      >
                        {camera.status}
                      </Badge>
                      <span className="text-sm font-medium">{camera.name}</span>
                      {isActive && (
                        <Badge variant="outline" className="text-xs text-primary border-primary">
                          Auto Ping Active (5s)
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSendPing(camera.id, camera.name)}
                      >
                        Send Ping
                      </Button>
                      <Button
                        size="sm"
                        variant={isActive ? "destructive" : "default"}
                        onClick={() => handleToggleHeartbeat(camera.id, camera.name)}
                      >
                        {isActive ? (
                          <>
                            <StopCircle className="w-4 h-4 mr-1" />
                            Stop Auto Ping
                          </>
                        ) : (
                          <>
                            <PlayCircle className="w-4 h-4 mr-1" />
                            Start Auto Ping
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
