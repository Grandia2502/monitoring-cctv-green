import { Camera, MonitoringRecord } from '@/types';

// Helper to convert snake_case database fields to camelCase TypeScript types
export const dbCameraToCamera = (dbCamera: any): Camera => ({
  id: dbCamera.id,
  name: dbCamera.name,
  location: dbCamera.location,
  streamUrl: dbCamera.stream_url,
  status: dbCamera.status,
  lastSeen: dbCamera.last_seen,
  resolution: dbCamera.resolution,
  fps: dbCamera.fps,
});

export const cameraToDbCamera = (camera: Omit<Camera, 'id' | 'lastSeen'>) => ({
  name: camera.name,
  location: camera.location,
  stream_url: camera.streamUrl,
  status: camera.status,
  resolution: camera.resolution,
  fps: camera.fps,
});

export const dbRecordingToMonitoringRecord = (dbRecord: any, cameraName: string): MonitoringRecord => {
  const recordedAt = new Date(dbRecord.recorded_at);
  return {
    id: dbRecord.id,
    cameraId: dbRecord.camera_id,
    cameraName: cameraName,
    date: recordedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: recordedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    description: dbRecord.description || '',
    priority: dbRecord.priority,
    fileUrl: dbRecord.file_url,
    thumbnailUrl: dbRecord.thumbnail_url,
    duration: dbRecord.duration,
    size: dbRecord.size,
    recordedAt: dbRecord.recorded_at,
  };
};

export const monitoringRecordToDbRecording = (record: Partial<MonitoringRecord>) => ({
  camera_id: record.cameraId,
  file_url: record.fileUrl,
  thumbnail_url: record.thumbnailUrl,
  description: record.description,
  recorded_at: record.recordedAt,
  duration: record.duration,
  size: record.size,
  priority: record.priority,
});
