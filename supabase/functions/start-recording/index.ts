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

    const { camera_id, stream_url, started_at } = await req.json();

    if (!camera_id || !stream_url) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: camera_id, stream_url' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify camera exists and is online
    const { data: camera, error: cameraError } = await supabase
      .from('cameras')
      .select('id, status, name')
      .eq('id', camera_id)
      .maybeSingle();

    if (cameraError || !camera) {
      console.error('Camera fetch error:', cameraError);
      return new Response(
        JSON.stringify({ error: 'Camera not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (camera.status === 'offline') {
      return new Response(
        JSON.stringify({ error: 'Cannot start recording: Camera is offline' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const recordedAtIso = typeof started_at === 'number'
      ? new Date(started_at).toISOString()
      : new Date().toISOString();

    // Create recording record
    const { data: recording, error: insertError } = await supabase
      .from('recordings')
      .insert({
        camera_id,
        recorded_at: recordedAtIso,
        // Must match DB CHECK constraint recordings_priority_check
        priority: 'medium',
        description: `Recording started for camera ${camera.name}`,
      })
      .select()
      .single();

    if (insertError || !recording) {
      console.error('Recording insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create recording record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update camera status to recording
    await supabase
      .from('cameras')
      .update({ status: 'recording' })
      .eq('id', camera_id);

    console.log(`Recording started: ${recording.id} for camera ${camera.name}`);

    return new Response(
      JSON.stringify({
        recording_id: recording.id,
        camera_id: recording.camera_id,
        recorded_at: recording.recorded_at,
        priority: recording.priority,
        message:
          'Recording started successfully. Connect your backend ffmpeg service to process the stream.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in start-recording function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
