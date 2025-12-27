export interface Camera {
  id: string;
  name: string;
  location: string;
  streamUrl: string;
  status: 'online' | 'offline' | 'warning' | 'recording';
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
  priority: 'low' | 'medium' | 'high';
  fileUrl?: string;
  thumbnailUrl?: string;
  duration?: string; // HH:MM:SS format
  size?: number; // in bytes
  recordedAt?: string; // ISO date string
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