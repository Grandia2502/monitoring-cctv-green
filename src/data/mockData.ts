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
    date: 'Jan 15, 2024',
    time: '14:30',
    description: 'Normal operations, all equipment functioning properly',
    fileUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=300&h=200&fit=crop',
    duration: '00:03:45',
    size: 12.5,
    recordedAt: '2024-01-15T14:30:00'
  },
  {
    id: '2',
    cameraId: '3',
    cameraName: 'Solar Panel Field',
    date: 'Jan 15, 2024',
    time: '12:15',
    description: 'Camera went offline, maintenance required',
    fileUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=300&h=200&fit=crop',
    duration: '00:05:20',
    size: 18.3,
    recordedAt: '2024-01-15T12:15:00'
  },
  {
    id: '3',
    cameraId: '4',
    cameraName: 'Parking Area',
    date: 'Jan 15, 2024',
    time: '14:25',
    description: 'Intermittent connection issues detected',
    fileUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=300&h=200&fit=crop',
    duration: '00:02:15',
    size: 8.7,
    recordedAt: '2024-01-15T14:25:00'
  },
  {
    id: '4',
    cameraId: '2',
    cameraName: 'Hydroponic Lab',
    date: 'Jan 14, 2024',
    time: '09:15',
    description: 'Motion detected in restricted area',
    fileUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=200&fit=crop',
    duration: '00:01:30',
    size: 5.2,
    recordedAt: '2024-01-14T09:15:00'
  },
  {
    id: '5',
    cameraId: '5',
    cameraName: 'Research Garden',
    date: 'Jan 14, 2024',
    time: '16:45',
    description: 'Routine security sweep completed',
    fileUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1416339306562-f3d12fefd36f?w=300&h=200&fit=crop',
    duration: '00:04:10',
    size: 14.1,
    recordedAt: '2024-01-14T16:45:00'
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