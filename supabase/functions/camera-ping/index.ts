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

    // Parse request body
    const { camera_id } = await req.json();

    if (!camera_id) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'camera_id is required' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Received ping from camera: ${camera_id}`);

    // Update camera's last_ping and set status to online
    const { error: updateError } = await supabase
      .from('cameras')
      .update({
        last_ping: new Date().toISOString(),
        status: 'online'
      })
      .eq('id', camera_id);

    if (updateError) {
      console.error('Error updating camera ping:', updateError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: updateError.message 
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Successfully updated ping for camera: ${camera_id}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Ping received',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in camera ping handler:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
