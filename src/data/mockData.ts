import { Camera, MonitoringRecord, User, DashboardStats } from '@/types';

export const mockCameras: Camera[] = [
  {
    id: '1',
    name: 'Greenhouse Zone A',
    location: 'Sector A - Main Entrance',
    streamUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
    status: 'online',
    lastSeen: '2024-01-15 14:30:00',
    resolution: '1920x1080',
    fps: 30
  },
  {
    id: '2',
    name: 'Hydroponic Lab',
    location: 'Building B - Lab Room 1',
    streamUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4',
    status: 'online',
    lastSeen: '2024-01-15 14:29:45',
    resolution: '1280x720',
    fps: 25
  },
  {
    id: '3',
    name: 'Solar Panel Field',
    location: 'Rooftop - Building C',
    streamUrl: '',
    status: 'offline',
    lastSeen: '2024-01-15 12:15:30',
    resolution: '1920x1080',
    fps: 30
  },
  {
    id: '4',
    name: 'Parking Area',
    location: 'Main Campus - Parking Lot',
    streamUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_5mb.mp4',
    status: 'warning',
    lastSeen: '2024-01-15 14:25:12',
    resolution: '1280x720',
    fps: 15
  },
  {
    id: '5',
    name: 'Research Garden',
    location: 'Outdoor Area - South Wing',
    streamUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
    status: 'online',
    lastSeen: '2024-01-15 14:30:05',
    resolution: '1920x1080',
    fps: 30
  },
  {
    id: '6',
    name: 'Equipment Storage',
    location: 'Building A - Storage Room',
    streamUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4',
    status: 'online',
    lastSeen: '2024-01-15 14:29:58',
    resolution: '1280x720',
    fps: 25
  }
];

export const mockRecords: MonitoringRecord[] = [
  {
    id: '1',
    cameraId: '1',
    cameraName: 'Greenhouse Zone A',
    date: '2024-01-15',
    time: '14:30',
    description: 'Normal operations, all equipment functioning properly',
    priority: 'low'
  },
  {
    id: '2',
    cameraId: '3',
    cameraName: 'Solar Panel Field',
    date: '2024-01-15',
    time: '12:15',
    description: 'Camera went offline, maintenance required',
    priority: 'high'
  },
  {
    id: '3',
    cameraId: '4',
    cameraName: 'Parking Area',
    date: '2024-01-15',
    time: '14:25',
    description: 'Intermittent connection issues detected',
    priority: 'medium'
  }
];

export const mockUser: User = {
  id: '1',
  name: 'Admin User',
  email: 'admin@greentech.telkomuniversity.ac.id',
  role: 'admin'
};

export const mockStats: DashboardStats = {
  totalCameras: 6,
  onlineCameras: 4,
  offlineCameras: 1,
  warningCameras: 1
};