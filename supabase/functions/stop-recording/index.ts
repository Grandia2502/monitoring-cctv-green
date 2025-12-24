import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { recording_id } = await req.json();

    if (!recording_id) {
      return new Response(JSON.stringify({ error: "Missing required field: recording_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get recording details with camera info
    const { data: recording, error: fetchError } = await supabase
      .from("recordings")
      .select("*, cameras(name, status)")
      .eq("id", recording_id)
      .maybeSingle();

    if (fetchError || !recording) {
      console.error("Recording fetch error:", fetchError);
      return new Response(JSON.stringify({ error: "Recording not found" }), {
        status: 404,
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

    // Update recording record with duration (using text format as per schema)
    const { error: updateError } = await supabase
      .from("recordings")
      .update({
        duration: durationFormatted,
        // In real implementation, backend would provide file_url after upload
        file_url: `placeholder://recordings/${recording.camera_id}/${recording_id}.mp4`,
      })
      .eq("id", recording_id);

    console.log("url rekaman" + `placeholder://recordings/${recording.camera_id}/${recording_id}.mp4`);

    if (updateError) {
      console.error("Recording update error:", updateError);
      return new Response(JSON.stringify({ error: "Failed to update recording" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update camera status back to online
    await supabase.from("cameras").update({ status: "online" }).eq("id", recording.camera_id);

    console.log(`Recording stopped: ${recording_id}, duration: ${durationFormatted}`);

    return new Response(
      JSON.stringify({
        recording_id,
        duration: durationFormatted,
        message: "Recording stopped successfully.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in stop-recording function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
