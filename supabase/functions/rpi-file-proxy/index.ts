const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, Content-Type',
}

const RPI_API_BASE = 'https://api.cctvgreen.site'

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const RPI_API_KEY = Deno.env.get('RPI_API_KEY')
    if (!RPI_API_KEY) {
      console.error('[rpi-file-proxy] RPI_API_KEY not configured')
      return new Response('Server configuration error', { status: 500, headers: corsHeaders })
    }

    const url = new URL(req.url)
    const cam = url.searchParams.get('cam')
    const file = url.searchParams.get('file')

    if (!cam || !file) {
      console.error('[rpi-file-proxy] Missing cam or file parameter')
      return new Response('Missing cam or file parameter', { status: 400, headers: corsHeaders })
    }

    // Validate cam format (cam1, cam2, etc.)
    if (!/^cam\d+$/.test(cam)) {
      console.error(`[rpi-file-proxy] Invalid cam format: ${cam}`)
      return new Response('Invalid cam parameter', { status: 400, headers: corsHeaders })
    }

    // Validate filename (basic security check)
    if (file.includes('..') || file.includes('/') || file.includes('\\')) {
      console.error(`[rpi-file-proxy] Invalid filename: ${file}`)
      return new Response('Invalid file parameter', { status: 400, headers: corsHeaders })
    }

    const fileUrl = `${RPI_API_BASE}/recordings/file/${cam}/${encodeURIComponent(file)}`
    console.log(`[rpi-file-proxy] Proxying: ${fileUrl}`)

    // Forward Range header if present (for video seeking)
    const rangeHeader = req.headers.get('Range')
    const rpiHeaders: Record<string, string> = {
      'X-API-Key': RPI_API_KEY,
    }
    if (rangeHeader) {
      rpiHeaders['Range'] = rangeHeader
      console.log(`[rpi-file-proxy] Range request: ${rangeHeader}`)
    }

    const rpiResponse = await fetch(fileUrl, {
      method: 'GET',
      headers: rpiHeaders,
    })

    if (!rpiResponse.ok && rpiResponse.status !== 206) {
      console.error(`[rpi-file-proxy] RPI API error: ${rpiResponse.status}`)
      return new Response('File not found or server error', { 
        status: rpiResponse.status, 
        headers: corsHeaders 
      })
    }

    // Build response headers
    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      'Accept-Ranges': 'bytes',
    }

    // Forward relevant headers from RPI response
    const contentType = rpiResponse.headers.get('Content-Type')
    if (contentType) {
      responseHeaders['Content-Type'] = contentType
    } else {
      responseHeaders['Content-Type'] = 'video/mp4'
    }

    const contentLength = rpiResponse.headers.get('Content-Length')
    if (contentLength) {
      responseHeaders['Content-Length'] = contentLength
    }

    const contentRange = rpiResponse.headers.get('Content-Range')
    if (contentRange) {
      responseHeaders['Content-Range'] = contentRange
    }

    // Set content disposition for download
    responseHeaders['Content-Disposition'] = `inline; filename="${file}"`

    console.log(`[rpi-file-proxy] Streaming ${file}, status: ${rpiResponse.status}, size: ${contentLength || 'unknown'}`)

    // Stream the response body directly
    return new Response(rpiResponse.body, {
      status: rpiResponse.status,
      headers: responseHeaders,
    })

  } catch (error) {
    console.error('[rpi-file-proxy] Error:', error)
    return new Response('Internal server error', { status: 500, headers: corsHeaders })
  }
})
