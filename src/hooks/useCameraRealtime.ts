import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { dbCameraToCamera } from '@/lib/supabaseHelpers';
import { Camera } from '@/types';

export function useCameraRealtime() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Initial fetch
    const fetchCameras = async () => {
      try {
        const { data, error } = await supabase
          .from('cameras')
          .select('*')
          .order('name', { ascending: true });

        if (error) throw error;

        if (isMounted) {
          const formattedCameras = (data || []).map(dbCameraToCamera);
          setCameras(formattedCameras);
        }
      } catch (error) {
        console.error('Error fetching cameras:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchCameras();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('realtime:cameras')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cameras' },
        (payload) => {
          const eventType = payload.eventType;

          if (eventType === 'INSERT' && payload.new) {
            const newCamera = dbCameraToCamera(payload.new);
            setCameras((prev) => {
              const exists = prev.some((c) => c.id === newCamera.id);
              return exists ? prev : [newCamera, ...prev];
            });
          }

          if (eventType === 'UPDATE' && payload.new) {
            const updatedCamera = dbCameraToCamera(payload.new);
            setCameras((prev) =>
              prev.map((c) => (c.id === updatedCamera.id ? updatedCamera : c))
            );
          }

          if (eventType === 'DELETE' && payload.old) {
            setCameras((prev) => prev.filter((c) => c.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { cameras, loading };
}
