import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const startRecordingSchema = z.object({
  camera_id: z.string().uuid('Invalid camera ID format'),
  stream_url: z.string()
    .url('Invalid stream URL')
    .max(500, 'Stream URL too long'),
  started_at: z.number().int().positive().optional()
});

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

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch (parseError) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validationResult = startRecordingSchema.safeParse(body);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input',
          details: validationResult.error.issues.map(i => i.message)
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { camera_id, stream_url, started_at } = validationResult.data;

    // Verify camera exists, is online, and user owns it
    const { data: camera, error: cameraError } = await supabase
      .from('cameras')
      .select('id, status, name, user_id')
      .eq('id', camera_id)
      .maybeSingle();

    if (cameraError || !camera) {
      console.error('Camera fetch error:', cameraError);
      return new Response(
        JSON.stringify({ error: 'Camera not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership
    if (camera.user_id !== user.id) {
      console.log(`Unauthorized: user ${user.id} trying to record camera owned by ${camera.user_id}`);
      return new Response(
        JSON.stringify({ error: 'Unauthorized to record this camera' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    console.log(`Recording started: ${recording.id} for camera ${camera.name} by user ${user.id}`);

    return new Response(
      JSON.stringify({
        recording_id: recording.id,
        camera_id: recording.camera_id,
        recorded_at: recording.recorded_at,
        message:
          'Recording started successfully. Connect your backend ffmpeg service to process the stream.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in start-recording function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
