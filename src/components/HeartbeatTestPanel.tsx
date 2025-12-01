import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Activity, PlayCircle, StopCircle } from 'lucide-react';
import { sendCameraHeartbeat, triggerHeartbeatCheck, startCameraHeartbeat } from '@/lib/cameraHeartbeat';
import { Camera } from '@/types';

interface HeartbeatTestPanelProps {
  cameras: Camera[];
}

export default function HeartbeatTestPanel({ cameras }: HeartbeatTestPanelProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [activeHeartbeats, setActiveHeartbeats] = useState<Set<string>>(new Set());

  const handleManualCheck = async () => {
    setIsChecking(true);
    toast.info('Running heartbeat check...');
    
    const result = await triggerHeartbeatCheck();
    
    setIsChecking(false);
    
    if (result.success) {
      toast.success('Heartbeat check completed', {
        description: result.data?.message || 'All cameras checked'
      });
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
    } else {
      toast.error(`Failed to ping ${cameraName}`, {
        description: result.error
      });
    }
  };

  const handleToggleHeartbeat = (cameraId: string, cameraName: string) => {
    if (activeHeartbeats.has(cameraId)) {
      // Stop heartbeat
      setActiveHeartbeats(prev => {
        const newSet = new Set(prev);
        newSet.delete(cameraId);
        return newSet;
      });
      toast.info(`Stopped heartbeat simulation for ${cameraName}`);
    } else {
      // Start heartbeat
      const stopHeartbeat = startCameraHeartbeat(cameraId, 15000);
      setActiveHeartbeats(prev => new Set(prev).add(cameraId));
      toast.success(`Started heartbeat simulation for ${cameraName}`, {
        description: 'Sending ping every 15 seconds'
      });
      
      // Clean up when component unmounts or heartbeat is stopped
      return () => stopHeartbeat();
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
          <Button 
            onClick={handleManualCheck} 
            disabled={isChecking}
            variant="outline"
          >
            {isChecking ? 'Checking...' : 'Run Manual Check'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground mb-4">
            <p>• Cameras not pinging for 60s will be marked offline</p>
            <p>• Use "Send Ping" to manually heartbeat a camera</p>
            <p>• Use "Start Auto Ping" to simulate continuous heartbeat (15s interval)</p>
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
                            : 'bg-status-warning text-white'
                        }
                      >
                        {camera.status}
                      </Badge>
                      <span className="text-sm font-medium">{camera.name}</span>
                      {isActive && (
                        <Badge variant="outline" className="text-xs">
                          Auto Ping Active
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
