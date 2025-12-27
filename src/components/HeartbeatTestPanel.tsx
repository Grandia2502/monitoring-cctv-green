import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Activity, RefreshCw } from 'lucide-react';
import { triggerHeartbeatCheck } from '@/lib/cameraHeartbeat';

interface HeartbeatTestPanelProps {
  onRefresh?: () => void;
}

export default function HeartbeatTestPanel({ onRefresh }: HeartbeatTestPanelProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    toast.info('Refreshing cameras...');
    onRefresh?.();
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
      onRefresh?.();
    } else {
      toast.error('Heartbeat check failed', {
        description: result.error
      });
    }
  };

  return (
    <Card className="border-accent/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="w-4 h-4 text-accent" />
              Heartbeat Monitor
            </CardTitle>
            <CardDescription className="text-xs">
              Camera status monitoring system
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              onClick={handleRefresh} 
              disabled={isRefreshing}
              variant="outline"
              size="sm"
              className="h-8"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button 
              onClick={handleManualCheck} 
              disabled={isChecking}
              variant="outline"
              size="sm"
              className="h-8"
            >
              {isChecking ? 'Checking...' : 'Run Check'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-xs text-muted-foreground p-2.5 bg-muted/50 rounded-lg space-y-1">
          <p>• Offline threshold: <span className="font-semibold text-destructive">20 seconds</span></p>
          <p>• Auto Ping interval: <span className="font-semibold text-primary">5 seconds</span></p>
          <p>• Use the <span className="font-medium">📡 button</span> on each camera card to toggle Auto Ping</p>
        </div>
      </CardContent>
    </Card>
  );
}
