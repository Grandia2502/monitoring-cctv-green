export type StreamType = 'mjpeg' | 'hls' | 'youtube';

export interface Camera {
  id: string;
  name: string;
  location: string;
  streamUrl: string;
  streamType: StreamType;
  status: 'online' | 'offline' | 'recording';
  lastSeen: string;
  fps: number;
}

export interface MonitoringRecord {
  id: string;
  cameraId: string;
  cameraName: string;
  date: string;
  time: string;
  description: string;
  fileUrl?: string;
  thumbnailUrl?: string;
  duration?: string; // HH:MM:SS format
  size?: number; // in bytes
  recordedAt?: string; // ISO date string
  cloudBackupUrl?: string | null;
  backedUpAt?: string | null;
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
  recordingCameras: number;
}