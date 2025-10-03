export interface Camera {
  id: string;
  name: string;
  location: string;
  streamUrl: string;
  status: 'online' | 'offline' | 'warning';
  lastSeen: string;
  resolution: string;
  fps: number;
}

export interface MonitoringRecord {
  id: string;
  cameraId: string;
  cameraName: string;
  date: string;
  time: string;
  description: string;
  operator: string;
  priority: 'low' | 'medium' | 'high';
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin';
  avatar?: string;
}

export interface DashboardStats {
  totalCameras: number;
  onlineCameras: number;
  offlineCameras: number;
  warningCameras: number;
}