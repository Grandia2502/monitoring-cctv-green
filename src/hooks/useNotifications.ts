import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRecordingContext, CameraRecordingState } from '@/contexts/RecordingContext';

export type NotificationType = 'camera_offline' | 'recording_active';

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  timestamp: Date;
  cameraId: string;
};

type OfflineCamera = {
  id: string;
  name: string;
  location: string;
  updated_at: string;
};

type RecordingStateMap = Record<string, CameraRecordingState>;

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { recordingState } = useRecordingContext();

  const fetchOfflineCameras = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('cameras')
        .select('id, name, location, updated_at')
        .eq('status', 'offline');

      if (error) {
        console.error('[useNotifications] Error fetching offline cameras:', error);
        return [];
      }

      return (data || []) as OfflineCamera[];
    } catch (err) {
      console.error('[useNotifications] Error:', err);
      return [];
    }
  }, []);

  const buildNotifications = useCallback((offlineCameras: OfflineCamera[], currentRecordingState: RecordingStateMap) => {
    const notifs: Notification[] = [];

    // Add offline camera notifications
    offlineCameras.forEach((camera) => {
      notifs.push({
        id: `offline-${camera.id}`,
        type: 'camera_offline',
        title: 'Camera Offline',
        description: `${camera.name} at ${camera.location} is disconnected`,
        timestamp: new Date(camera.updated_at),
        cameraId: camera.id,
      });
    });

    // Add active recording notifications
    Object.entries(currentRecordingState).forEach(([cameraId, state]) => {
      if (state.isRecording && state.startedAt) {
        notifs.push({
          id: `recording-${cameraId}`,
          type: 'recording_active',
          title: 'Recording Active',
          description: `Camera is currently recording`,
          timestamp: new Date(state.startedAt),
          cameraId,
        });
      }
    });

    // Sort by timestamp (newest first)
    notifs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return notifs;
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadNotifications = async () => {
      setLoading(true);
      const offlineCameras = await fetchOfflineCameras();
      if (isMounted) {
        setNotifications(buildNotifications(offlineCameras, recordingState));
        setLoading(false);
      }
    };

    loadNotifications();

    // Subscribe to realtime camera updates
    const channel = supabase
      .channel('notifications-camera-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cameras',
        },
        async () => {
          // Refetch offline cameras when any camera changes
          const offlineCameras = await fetchOfflineCameras();
          if (isMounted) {
            setNotifications(buildNotifications(offlineCameras, recordingState));
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [fetchOfflineCameras, buildNotifications]);

  // Update notifications when recording state changes
  useEffect(() => {
    const updateRecordingNotifications = async () => {
      const offlineCameras = await fetchOfflineCameras();
      setNotifications(buildNotifications(offlineCameras, recordingState));
    };

    updateRecordingNotifications();
  }, [recordingState, fetchOfflineCameras, buildNotifications]);

  return {
    notifications,
    loading,
    offlineCount: notifications.filter((n) => n.type === 'camera_offline').length,
    recordingCount: notifications.filter((n) => n.type === 'recording_active').length,
  };
}
