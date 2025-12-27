import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!;
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
].join(' ');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    
    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get user from auth header
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && user) {
        userId = user.id;
      }
    }

    // Handle different actions
    switch (action) {
      case 'authorize': {
        // Get redirect URL from request
        const { redirectUrl } = await req.json();
        
        if (!userId) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Build Google OAuth URL
        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', `${SUPABASE_URL}/functions/v1/google-drive-auth?action=callback`);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', SCOPES);
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('prompt', 'consent');
        authUrl.searchParams.set('state', JSON.stringify({ userId, redirectUrl }));

        console.log('Generated auth URL for user:', userId);
        
        return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'callback': {
        // Handle OAuth callback from Google
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        if (error) {
          console.error('Google OAuth error:', error);
          return new Response(`<html><body><script>window.close();</script>OAuth error: ${error}</body></html>`, {
            headers: { 'Content-Type': 'text/html' },
          });
        }

        if (!code || !state) {
          return new Response('<html><body>Missing code or state</body></html>', {
            headers: { 'Content-Type': 'text/html' },
          });
        }

        const { userId: stateUserId, redirectUrl } = JSON.parse(state);
        console.log('Processing callback for user:', stateUserId);

        // Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: `${SUPABASE_URL}/functions/v1/google-drive-auth?action=callback`,
            grant_type: 'authorization_code',
          }),
        });

        const tokens = await tokenResponse.json();
        console.log('Token exchange response:', tokenResponse.status);

        if (tokens.error) {
          console.error('Token exchange error:', tokens.error);
          return new Response(`<html><body>Token error: ${tokens.error}</body></html>`, {
            headers: { 'Content-Type': 'text/html' },
          });
        }

        // Calculate token expiry
        const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);

        // Create or update folder in Google Drive
        let folderId: string | null = null;
        try {
          // Check if folder exists
          const searchResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=name='CCTV_Backups' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            {
              headers: { 'Authorization': `Bearer ${tokens.access_token}` },
            }
          );
          const searchResult = await searchResponse.json();
          
          if (searchResult.files && searchResult.files.length > 0) {
            folderId = searchResult.files[0].id;
            console.log('Found existing folder:', folderId);
          } else {
            // Create folder
            const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${tokens.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name: 'CCTV_Backups',
                mimeType: 'application/vnd.google-apps.folder',
              }),
            });
            const createResult = await createResponse.json();
            folderId = createResult.id;
            console.log('Created new folder:', folderId);
          }
        } catch (e) {
          console.error('Error managing folder:', e);
        }

        // Save tokens to database
        const { error: upsertError } = await supabaseAdmin
          .from('google_drive_tokens')
          .upsert({
            user_id: stateUserId,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_expiry: tokenExpiry.toISOString(),
            folder_id: folderId,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });

        if (upsertError) {
          console.error('Error saving tokens:', upsertError);
          return new Response(`<html><body>Error saving tokens</body></html>`, {
            headers: { 'Content-Type': 'text/html' },
          });
        }

        console.log('Tokens saved successfully for user:', stateUserId);

        // Redirect back to app
        const finalRedirect = redirectUrl || '/monitoring-records';
        return new Response(
          `<html><head><meta http-equiv="refresh" content="0;url=${finalRedirect}?google_drive_connected=true"></head></html>`,
          { headers: { 'Content-Type': 'text/html' } }
        );
      }

      case 'status': {
        if (!userId) {
          return new Response(JSON.stringify({ connected: false }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data, error } = await supabaseAdmin
          .from('google_drive_tokens')
          .select('id, folder_id, token_expiry')
          .eq('user_id', userId)
          .single();

        if (error || !data) {
          return new Response(JSON.stringify({ connected: false }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ 
          connected: true, 
          folderId: data.folder_id 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'disconnect': {
        if (!userId) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { error } = await supabaseAdmin
          .from('google_drive_tokens')
          .delete()
          .eq('user_id', userId);

        if (error) {
          console.error('Error disconnecting:', error);
          return new Response(JSON.stringify({ error: 'Failed to disconnect' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log('Disconnected Google Drive for user:', userId);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('Error in google-drive-auth:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
