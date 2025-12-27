import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface BackupResult {
  id: string;
  success: boolean;
  error?: string;
  backupUrl?: string;
}

interface BackupSummary {
  total: number;
  successful: number;
  failed: number;
}

export const useGoogleDriveBackup = () => {
  const [backing, setBacking] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const backup = async (recordingIds: string[]): Promise<{ results: BackupResult[]; summary: BackupSummary } | null> => {
    if (recordingIds.length === 0) {
      toast({
        title: 'No recordings selected',
        description: 'Please select at least one recording to backup.',
        variant: 'destructive',
      });
      return null;
    }

    try {
      setBacking(true);
      setProgress({ current: 0, total: recordingIds.length });

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: 'Error',
          description: 'You must be logged in to backup recordings.',
          variant: 'destructive',
        });
        return null;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive-backup`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ recordingIds }),
        }
      );

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      const { results, summary } = result as { results: BackupResult[]; summary: BackupSummary };

      // Show toast based on results
      if (summary.successful === summary.total) {
        toast({
          title: 'Backup Complete',
          description: `Successfully backed up ${summary.successful} recording(s) to Google Drive.`,
        });
      } else if (summary.successful > 0) {
        toast({
          title: 'Backup Partially Complete',
          description: `Backed up ${summary.successful} of ${summary.total} recording(s). ${summary.failed} failed.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Backup Failed',
          description: 'Failed to backup any recordings. Please try again.',
          variant: 'destructive',
        });
      }

      return { results, summary };

    } catch (error: any) {
      console.error('Error backing up to Google Drive:', error);
      toast({
        title: 'Backup Failed',
        description: error.message || 'Failed to backup recordings.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setBacking(false);
      setProgress(null);
    }
  };

  return {
    backup,
    backing,
    progress,
  };
};
