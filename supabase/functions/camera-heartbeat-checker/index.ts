import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = Date.now();
    const threshold = 20 * 1000; // 20 seconds in milliseconds

    console.log('Starting heartbeat check...');

    // Fetch all cameras
    const { data: cameras, error: fetchError } = await supabase
      .from('cameras')
      .select('*');

    if (fetchError) {
      console.error('Error fetching cameras:', fetchError);
      throw fetchError;
    }

    if (!cameras || cameras.length === 0) {
      console.log('No cameras found');
      return new Response(
        JSON.stringify({ message: 'No cameras found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let offlineCount = 0;

    // Check each camera's last_ping
    for (const camera of cameras) {
      const lastPingTime = camera.last_ping ? new Date(camera.last_ping).getTime() : 0;
      const timeDifference = now - lastPingTime;

      console.log(`Camera ${camera.name} (${camera.id}): last_ping=${camera.last_ping}, diff=${timeDifference}ms, status=${camera.status}`);

      // If camera hasn't pinged in 20 seconds and is not already offline, mark as offline
      if (timeDifference > threshold && camera.status !== 'offline') {
        console.log(`Marking camera ${camera.name} as offline (no heartbeat for ${Math.round(timeDifference / 1000)}s)`);
        
        const { error: updateError } = await supabase
          .from('cameras')
          .update({ status: 'offline' })
          .eq('id', camera.id);

        if (updateError) {
          console.error(`Error updating camera ${camera.id}:`, updateError);
        } else {
          offlineCount++;
        }
      }
    }

    console.log(`Heartbeat check complete. Marked ${offlineCount} cameras as offline.`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Heartbeat check complete',
        camerasChecked: cameras.length,
        camerasMarkedOffline: offlineCount,
        timestamp: new Date().toISOString(),
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in heartbeat checker:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
