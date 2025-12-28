import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const cameraPingSchema = z.object({
  camera_id: z.string().uuid('Invalid camera ID format')
});

// Retry helper for transient network errors
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 100
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isTransient = error.message?.includes('connection') || 
                          error.message?.includes('reset') ||
                          error.message?.includes('timeout');
      if (!isTransient || attempt === maxRetries - 1) {
        throw error;
      }
      const delay = baseDelayMs * Math.pow(2, attempt);
      console.log(`Retry attempt ${attempt + 1} after ${delay}ms due to: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('Missing authorization header');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Missing authorization header' 
        }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.log('Unauthorized user:', authError?.message);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Unauthorized' 
        }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch (parseError) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Invalid JSON' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const validationResult = cameraPingSchema.safeParse(body);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Invalid input: camera_id must be a valid UUID',
          details: validationResult.error.issues.map(i => i.message)
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { camera_id } = validationResult.data;

    console.log(`Received ping from user: ${user.id} for camera: ${camera_id}`);

    // Verify camera exists and check ownership
    const { data: camera, error: cameraError } = await supabase
      .from('cameras')
      .select('id, user_id')
      .eq('id', camera_id)
      .single();

    if (cameraError || !camera) {
      console.log('Camera not found:', camera_id);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Camera not found' 
        }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verify ownership
    if (camera.user_id !== user.id) {
      console.log(`Unauthorized: user ${user.id} trying to ping camera owned by ${camera.user_id}`);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Unauthorized to ping this camera' 
        }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Update camera's last_ping and set status to online with retry logic
    const { error: updateError } = await retryWithBackoff(async () => {
      return await supabase
        .from('cameras')
        .update({
          last_ping: new Date().toISOString(),
          status: 'online'
        })
        .eq('id', camera_id);
    });

    if (updateError) {
      console.error('Error updating camera ping:', updateError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Failed to update camera status'
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
        error: 'Internal server error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
