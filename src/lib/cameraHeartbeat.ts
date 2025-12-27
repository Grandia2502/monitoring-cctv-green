import { supabase } from '@/integrations/supabase/client';

/**
 * Send a heartbeat ping for a camera to mark it as online
 * @param cameraId - The UUID of the camera
 * @returns Promise with success status
 */
export async function sendCameraHeartbeat(cameraId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('camera-ping', {
      body: { camera_id: cameraId }
    });

    if (error) {
      console.error('Failed to send camera heartbeat:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to send camera heartbeat:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Set camera status to offline directly
 * @param cameraId - The UUID of the camera
 * @returns Promise with success status
 */
export async function setCameraOffline(cameraId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('cameras')
      .update({ status: 'offline', last_seen: new Date().toISOString() })
      .eq('id', cameraId);

    if (error) {
      console.error('Failed to set camera offline:', error);
      return { success: false, error: error.message };
    }

    console.log(`Camera ${cameraId} marked as offline`);
    return { success: true };
  } catch (error) {
    console.error('Failed to set camera offline:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Manually trigger the heartbeat checker to scan all cameras
 * Useful for testing or manual intervention
 * @returns Promise with result data
 */
export async function triggerHeartbeatCheck(): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('camera-heartbeat-checker');

    if (error) {
      console.error('Failed to trigger heartbeat check:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Failed to trigger heartbeat check:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Set up an interval to send heartbeat for a specific camera
 * @param cameraId - The UUID of the camera
 * @param intervalMs - Interval in milliseconds (default: 5000ms = 5 seconds)
 * @returns Function to stop the heartbeat interval
 */
export function startCameraHeartbeat(cameraId: string, intervalMs: number = 5000): () => void {
  console.log(`Starting heartbeat for camera ${cameraId} every ${intervalMs}ms`);
  
  // Send immediate heartbeat
  sendCameraHeartbeat(cameraId);
  
  // Set up interval
  const intervalId = setInterval(() => {
    sendCameraHeartbeat(cameraId);
  }, intervalMs);

  // Return cleanup function
  return () => {
    console.log(`Stopping heartbeat for camera ${cameraId}`);
    clearInterval(intervalId);
  };
}
