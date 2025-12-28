import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!;
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Input validation schema
const backupSchema = z.object({
  recordingIds: z.array(
    z.string().uuid('Invalid recording ID in array')
  )
    .min(1, 'At least one recording ID required')
    .max(50, 'Maximum 50 recordings per batch')
});

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();
    if (data.error) {
      console.error('Error refreshing token:', data.error);
      return null;
    }

    return data.access_token;
  } catch (error) {
    console.error('Error in refreshAccessToken:', error);
    return null;
  }
}

async function uploadToGoogleDrive(
  accessToken: string,
  folderId: string,
  fileName: string,
  fileData: Blob,
  mimeType: string
): Promise<{ id: string; webViewLink: string } | null> {
  try {
    // Prepare multipart upload
    const metadata = {
      name: fileName,
      parents: [folderId],
    };

    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const closeDelimiter = "\r\n--" + boundary + "--";

    // Convert blob to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: ' + mimeType + '\r\n' +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      base64Data +
      closeDelimiter;

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary="${boundary}"`,
        },
        body: multipartRequestBody,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Drive upload error:', errorText);
      return null;
    }

    const result = await response.json();
    return { id: result.id, webViewLink: result.webViewLink };
  } catch (error) {
    console.error('Error uploading to Google Drive:', error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase clients
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get user from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch (parseError) {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const validationResult = backupSchema.safeParse(body);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input',
          details: validationResult.error.issues.map(i => i.message)
        }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { recordingIds } = validationResult.data;

    console.log('Starting backup for user:', user.id, 'recordings:', recordingIds.length);

    // Get Google Drive tokens
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('google_drive_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !tokenData) {
      return new Response(JSON.stringify({ error: 'Google Drive not connected' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Refresh access token
    const accessToken = await refreshAccessToken(tokenData.refresh_token);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Failed to refresh Google Drive token' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get recordings - only those the user owns through camera relationship
    const { data: recordings, error: recordingsError } = await supabaseAdmin
      .from('recordings')
      .select('*, cameras(name, user_id)')
      .in('id', recordingIds);

    if (recordingsError || !recordings) {
      console.error('Error fetching recordings:', recordingsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch recordings' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: { id: string; success: boolean; error?: string; backupUrl?: string }[] = [];

    // Process each recording
    for (const recording of recordings) {
      try {
        // Verify ownership
        const cameraUserId = (recording.cameras as any)?.user_id;
        if (cameraUserId !== user.id) {
          console.log(`Skipping recording ${recording.id}: user ${user.id} doesn't own camera (owner: ${cameraUserId})`);
          results.push({ id: recording.id, success: false, error: 'Not authorized to backup this recording' });
          continue;
        }

        if (!recording.file_url) {
          results.push({ id: recording.id, success: false, error: 'No file URL' });
          continue;
        }

        // Skip if already backed up
        if (recording.cloud_backup_url) {
          results.push({ id: recording.id, success: true, backupUrl: recording.cloud_backup_url });
          continue;
        }

        // Get storage path from file_url
        let storagePath = recording.file_url;
        if (storagePath.startsWith('http')) {
          const urlParts = storagePath.split('/recordings/');
          if (urlParts.length > 1) {
            storagePath = urlParts[1];
          }
        }

        // Download file from Supabase Storage
        const { data: fileData, error: downloadError } = await supabaseAdmin.storage
          .from('recordings')
          .download(storagePath);

        if (downloadError || !fileData) {
          console.error('Error downloading file:', downloadError);
          results.push({ id: recording.id, success: false, error: 'Failed to download file' });
          continue;
        }

        // Generate filename
        const recordedDate = new Date(recording.recorded_at);
        const cameraName = (recording.cameras as any)?.name || 'Unknown';
        const fileName = `${cameraName}_${recordedDate.toISOString().replace(/[:.]/g, '-')}.mp4`;

        // Upload to Google Drive
        const uploadResult = await uploadToGoogleDrive(
          accessToken,
          tokenData.folder_id,
          fileName,
          fileData,
          'video/mp4'
        );

        if (!uploadResult) {
          results.push({ id: recording.id, success: false, error: 'Failed to upload to Google Drive' });
          continue;
        }

        // Update recording with backup info
        const { error: updateError } = await supabaseAdmin
          .from('recordings')
          .update({
            cloud_backup_url: uploadResult.webViewLink,
            backed_up_at: new Date().toISOString(),
          })
          .eq('id', recording.id);

        if (updateError) {
          console.error('Error updating recording:', updateError);
          results.push({ id: recording.id, success: false, error: 'Failed to update record' });
          continue;
        }

        console.log('Successfully backed up recording:', recording.id);
        results.push({ id: recording.id, success: true, backupUrl: uploadResult.webViewLink });

      } catch (error) {
        console.error('Error processing recording:', recording.id, error);
        results.push({ id: recording.id, success: false, error: 'Internal error' });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log('Backup complete:', successCount, '/', results.length, 'successful');

    return new Response(JSON.stringify({ 
      success: true,
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: results.length - successCount,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in google-drive-backup:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
