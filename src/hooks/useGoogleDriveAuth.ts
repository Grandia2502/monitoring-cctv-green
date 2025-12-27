import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface GoogleDriveStatus {
  connected: boolean;
  folderId?: string;
}

export const useGoogleDriveAuth = () => {
  const [status, setStatus] = useState<GoogleDriveStatus>({ connected: false });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStatus({ connected: false });
        setLoading(false);
        return;
      }

      // Build the URL with query params since invoke doesn't support them directly
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive-auth?action=status`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      );

      const result = await response.json();
      setStatus({
        connected: result.connected || false,
        folderId: result.folderId,
      });
    } catch (error) {
      console.error('Error checking Google Drive status:', error);
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();

    // Check for callback success
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('google_drive_connected') === 'true') {
      toast({
        title: 'Google Drive Connected',
        description: 'Your Google Drive account has been connected successfully.',
      });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      checkStatus();
    }
  }, [checkStatus]);

  const connect = async () => {
    try {
      setConnecting(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: 'Error',
          description: 'You must be logged in to connect Google Drive.',
          variant: 'destructive',
        });
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive-auth?action=authorize`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            redirectUrl: window.location.href,
          }),
        }
      );

      const result = await response.json();
      
      if (result.authUrl) {
        // Redirect to Google OAuth
        window.location.href = result.authUrl;
      } else {
        throw new Error(result.error || 'Failed to get auth URL');
      }
    } catch (error: any) {
      console.error('Error connecting to Google Drive:', error);
      toast({
        title: 'Connection Failed',
        description: error.message || 'Failed to connect to Google Drive.',
        variant: 'destructive',
      });
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive-auth?action=disconnect`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      );

      const result = await response.json();
      
      if (result.success) {
        setStatus({ connected: false });
        toast({
          title: 'Disconnected',
          description: 'Google Drive has been disconnected.',
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error('Error disconnecting Google Drive:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to disconnect Google Drive.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    connected: status.connected,
    folderId: status.folderId,
    loading,
    connecting,
    connect,
    disconnect,
    refresh: checkStatus,
  };
};
