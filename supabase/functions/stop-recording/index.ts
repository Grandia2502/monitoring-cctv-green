import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { recording_id } = await req.json();

    if (!recording_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: recording_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get recording details
    const { data: recording, error: fetchError } = await supabase
      .from('recordings')
      .select('*, cameras(name, status)')
      .eq('id', recording_id)
      .maybeSingle();

    if (fetchError || !recording) {
      console.error('Recording fetch error:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Recording not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (recording.status !== 'recording') {
      return new Response(
        JSON.stringify({ error: 'Recording is not active' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const endedAt = new Date().toISOString();
    const startedAt = new Date(recording.started_at);
    const duration = Math.floor((new Date(endedAt).getTime() - startedAt.getTime()) / 1000);

    // Update recording record with ended_at and duration
    const { error: updateError } = await supabase
      .from('recordings')
      .update({
        ended_at: endedAt,
        duration: duration,
        status: 'completed',
        // In real implementation, backend would provide file_url after upload
        file_url: `placeholder://recordings/${recording.camera_id}/${recording_id}.mp4`,
      })
      .eq('id', recording_id);

    if (updateError) {
      console.error('Recording update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update recording' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update camera status back to online
    await supabase
      .from('cameras')
      .update({ status: 'online' })
      .eq('id', recording.camera_id);

    console.log(`Recording stopped: ${recording_id}, duration: ${duration}s`);

    return new Response(
      JSON.stringify({
        recording_id,
        duration,
        ended_at: endedAt,
        status: 'completed',
        message: 'Recording stopped successfully. Backend should now upload the video file to storage.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in stop-recording function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
