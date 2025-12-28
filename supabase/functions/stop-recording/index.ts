import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema - use nullish() to allow null, undefined, or valid value
const stopRecordingSchema = z.object({
  recording_id: z.string().uuid('Invalid recording ID'),
  file_path: z.string().max(500, 'File path too long').nullish(),
  size: z.number().int().nonnegative('Size must be non-negative').nullish()
});

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("stop-recording: started");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch (parseError) {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validationResult = stopRecordingSchema.safeParse(body);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid input",
          details: validationResult.error.issues.map(i => i.message)
        }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { recording_id, file_path, size } = validationResult.data;

    // Get recording details with camera info
    const { data: recording, error: fetchError } = await supabase
      .from("recordings")
      .select("*, cameras(name, status, user_id)")
      .eq("id", recording_id)
      .maybeSingle();

    if (fetchError || !recording) {
      console.error("Recording fetch error:", fetchError);
      return new Response(JSON.stringify({ error: "Recording not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify ownership through camera
    const cameraUserId = (recording.cameras as any)?.user_id;
    if (cameraUserId !== user.id) {
      console.log(`Unauthorized: user ${user.id} trying to stop recording for camera owned by ${cameraUserId}`);
      return new Response(JSON.stringify({ error: "Unauthorized to stop this recording" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if camera is currently recording (not the recording record itself)
    const cameraStatus = (recording.cameras as any)?.status;
    if (cameraStatus !== "recording") {
      console.log(`Camera status is "${cameraStatus}", not "recording". Allowing stop anyway.`);
    }

    const endedAt = new Date().toISOString();
    // Use recorded_at instead of non-existent started_at
    const startedAt = new Date(recording.recorded_at);
    const durationSeconds = Math.floor((new Date(endedAt).getTime() - startedAt.getTime()) / 1000);
    const durationFormatted = `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`;

    // Determine file_url - use provided file_path or null
    let fileUrl: string | null = null;
    if (file_path) {
      // Construct full storage URL
      const { data: urlData } = supabase.storage.from("recordings").getPublicUrl(file_path);
      fileUrl = urlData.publicUrl;
      console.log("File uploaded to:", fileUrl);
    }

    // Update recording record with duration, file URL, and size
    const updateData: Record<string, any> = {
      duration: durationFormatted,
    };

    if (fileUrl) {
      updateData.file_url = fileUrl;
    }

    if (size !== null && size !== undefined) {
      updateData.size = size;
      console.log("File size (MB):", size);
    }

    const { error: updateError } = await supabase.from("recordings").update(updateData).eq("id", recording_id);

    if (updateError) {
      console.error("Recording update error:", updateError);
      return new Response(JSON.stringify({ error: "Failed to update recording" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update camera status back to online
    await supabase.from("cameras").update({ status: "online" }).eq("id", recording.camera_id);

    console.log(`Recording stopped: ${recording_id}, duration: ${durationFormatted}, file: ${fileUrl || "none"}, user: ${user.id}`);

    return new Response(
      JSON.stringify({
        recording_id,
        duration: durationFormatted,
        file_url: fileUrl,
        message: "Recording stopped successfully.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in stop-recording function:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
