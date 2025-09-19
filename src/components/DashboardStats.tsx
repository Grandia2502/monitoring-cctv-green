import { Camera, Monitor, AlertTriangle, Wifi } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardStats as StatsType } from '@/types';

interface DashboardStatsProps {
  stats: StatsType;
}

export const DashboardStats = ({ stats }: DashboardStatsProps) => {
  const statCards = [
    {
      title: 'Total Cameras',
      value: stats.totalCameras,
      icon: Camera,
      color: 'text-primary',
      bgColor: 'bg-primary/10'
    },
    {
      title: 'Online',
      value: stats.onlineCameras,
      icon: Wifi,
      color: 'text-status-online',
      bgColor: 'bg-status-online/10'
    },
    {
      title: 'Offline',
      value: stats.offlineCameras,
      icon: Monitor,
      color: 'text-status-offline',
      bgColor: 'bg-status-offline/10'
    },
    {
      title: 'Warning',
      value: stats.warningCameras,
      icon: AlertTriangle,
      color: 'text-status-warning',
      bgColor: 'bg-status-warning/10'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {statCards.map((stat, index) => (
        <Card key={index} className="transition-[var(--transition-smooth)] hover:shadow-[var(--shadow-lg)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <div className={`p-2 rounded-full ${stat.bgColor}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-card-foreground">{stat.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};