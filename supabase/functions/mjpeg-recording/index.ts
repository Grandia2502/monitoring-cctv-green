import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RPI_API_BASE = 'https://api.cctvgreen.site'

// Extract cam identifier from stream URL (e.g., "cam1.cctvgreen.site" -> "cam1")
function extractCamId(streamUrl: string): string | null {
  try {
    const url = new URL(streamUrl)
    const hostname = url.hostname
    // Pattern: cam1.cctvgreen.site, cam2.cctvgreen.site, etc.
    const match = hostname.match(/^(cam\d+)\.cctvgreen\.site$/)
    if (match) {
      return match[1]
    }
    // Fallback: try to extract from path or other patterns
    return null
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const RPI_API_KEY = Deno.env.get('RPI_API_KEY')
    if (!RPI_API_KEY) {
      console.error('[mjpeg-recording] RPI_API_KEY not configured')
      return new Response(
        JSON.stringify({ success: false, error: 'RPI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get auth token from request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the user token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { action, cameraId } = body
    
    console.log(`[mjpeg-recording] Action: ${action}, CameraId: ${cameraId}, User: ${user.id}`)

    if (!action || !cameraId) {
      return new Response(
        JSON.stringify({ success: false, error: 'action and cameraId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get camera info to extract cam identifier
    const { data: camera, error: cameraError } = await supabase
      .from('cameras')
      .select('id, name, stream_url, stream_type, user_id')
      .eq('id', cameraId)
      .single()

    if (cameraError || !camera) {
      console.error(`[mjpeg-recording] Camera not found: ${cameraId}`)
      return new Response(
        JSON.stringify({ success: false, error: 'Camera not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify user owns this camera
    if (camera.user_id !== user.id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify camera is MJPEG type
    if (camera.stream_type !== 'mjpeg') {
      return new Response(
        JSON.stringify({ success: false, error: 'Camera is not MJPEG type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const cam = extractCamId(camera.stream_url)
    if (!cam) {
      console.error(`[mjpeg-recording] Could not extract cam identifier from: ${camera.stream_url}`)
      return new Response(
        JSON.stringify({ success: false, error: 'Could not extract cam identifier from stream URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[mjpeg-recording] Camera: ${camera.name}, Cam ID: ${cam}`)

    const rpiHeaders = {
      'X-API-Key': RPI_API_KEY,
      'Content-Type': 'application/json',
    }

    let rpiUrl: string
    let rpiMethod: string = 'GET'

    // Handle stream action separately (returns binary file)
    if (action === 'stream') {
      const { filename } = body
      if (!filename) {
        return new Response(
          JSON.stringify({ success: false, error: 'filename is required for stream action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const fileUrl = `${RPI_API_BASE}/recordings/file/${cam}/${filename}`
      console.log(`[mjpeg-recording] Streaming file: ${fileUrl}`)

      const fileResponse = await fetch(fileUrl, {
        method: 'GET',
        headers: { 'X-API-Key': RPI_API_KEY },
      })

      if (!fileResponse.ok) {
        console.error(`[mjpeg-recording] File fetch failed: ${fileResponse.status}`)
        return new Response(
          JSON.stringify({ success: false, error: 'File not found or server error', status: fileResponse.status }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get content type from response or default to video/mp4
      const contentType = fileResponse.headers.get('Content-Type') || 'video/mp4'
      const contentLength = fileResponse.headers.get('Content-Length')

      console.log(`[mjpeg-recording] Streaming ${filename}, type: ${contentType}, size: ${contentLength}`)

      // Return the file as binary stream
      return new Response(fileResponse.body, {
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Content-Disposition': `inline; filename="${filename}"`,
          ...(contentLength && { 'Content-Length': contentLength }),
        }
      })
    }

    switch (action) {
      case 'start':
        rpiUrl = `${RPI_API_BASE}/recording/start/${cam}`
        rpiMethod = 'POST'
        break
      case 'stop':
        rpiUrl = `${RPI_API_BASE}/recording/stop/${cam}`
        rpiMethod = 'POST'
        break
      case 'status':
        rpiUrl = `${RPI_API_BASE}/recording/status/${cam}`
        rpiMethod = 'GET'
        break
      case 'list':
        rpiUrl = `${RPI_API_BASE}/recordings/list/${cam}`
        rpiMethod = 'GET'
        break
      default:
        return new Response(
          JSON.stringify({ success: false, error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    console.log(`[mjpeg-recording] Calling RPI API: ${rpiMethod} ${rpiUrl}`)

    const rpiResponse = await fetch(rpiUrl, {
      method: rpiMethod,
      headers: rpiHeaders,
    })

    const responseText = await rpiResponse.text()
    console.log(`[mjpeg-recording] RPI Response: ${rpiResponse.status} - ${responseText}`)

    let responseData
    try {
      responseData = JSON.parse(responseText)
    } catch {
      responseData = { raw: responseText }
    }

    // IMPORTANT: Don't propagate upstream (RPI) HTTP errors as edge-function HTTP errors.
    // If we return 5xx here, supabase-js surfaces it as an invocation error and Lovable may show a runtime overlay.
    // Instead return 200 with a structured payload so the UI can handle it gracefully.
    if (!rpiResponse.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: responseData.error || responseData.message || 'RPI API error',
          status: rpiResponse.status,
          cam,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // For list action, transform file URLs to include full path
    if (action === 'list' && responseData.files) {
      responseData.files = responseData.files.map((file: any) => ({
        ...file,
        playUrl: `${RPI_API_BASE}/recordings/file/${cam}/${file.filename}`,
        downloadUrl: `${RPI_API_BASE}/recordings/file/${cam}/${file.filename}`,
      }))
    }

    return new Response(
      JSON.stringify({ success: true, ...responseData, cam }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[mjpeg-recording] Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
