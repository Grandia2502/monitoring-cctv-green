import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      console.error('[HLS Proxy] Missing url parameter');
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[HLS Proxy] Fetching: ${targetUrl}`);

    // Fetch the HLS content from the original server
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
      },
    });

    if (!response.ok) {
      console.error(`[HLS Proxy] Upstream error: ${response.status} ${response.statusText}`);
      return new Response(JSON.stringify({ 
        error: 'Upstream server error', 
        status: response.status 
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
    
    // Check if this is a manifest file (.m3u8)
    if (targetUrl.endsWith('.m3u8') || contentType.includes('mpegurl') || contentType.includes('m3u8')) {
      const manifestText = await response.text();
      
      // Get the base URL for relative path resolution
      const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
      const proxyBaseUrl = `${url.origin}${url.pathname}?url=`;
      
      // Rewrite URLs in the manifest to go through the proxy
      const rewrittenManifest = rewriteManifestUrls(manifestText, baseUrl, proxyBaseUrl);
      
      console.log(`[HLS Proxy] Manifest rewritten successfully`);
      
      return new Response(rewrittenManifest, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // For segment files (.ts, .aac, etc.), stream the binary content
    const body = await response.arrayBuffer();
    
    console.log(`[HLS Proxy] Segment proxied: ${body.byteLength} bytes`);
    
    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    console.error('[HLS Proxy] Error:', error.message);
    return new Response(JSON.stringify({ 
      error: 'Proxy error', 
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function rewriteManifestUrls(manifest: string, baseUrl: string, proxyBaseUrl: string): string {
  const lines = manifest.split('\n');
  const rewrittenLines = lines.map(line => {
    const trimmedLine = line.trim();
    
    // Skip empty lines and comments/tags (lines starting with #)
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      // But check for URI in EXT-X-KEY or EXT-X-MAP tags
      if (trimmedLine.includes('URI="')) {
        return rewriteUriInTag(trimmedLine, baseUrl, proxyBaseUrl);
      }
      return line;
    }
    
    // This is a URL line (segment or playlist reference)
    let absoluteUrl: string;
    
    if (trimmedLine.startsWith('http://') || trimmedLine.startsWith('https://')) {
      // Already absolute URL
      absoluteUrl = trimmedLine;
    } else if (trimmedLine.startsWith('/')) {
      // Absolute path - need to get the origin from baseUrl
      const urlObj = new URL(baseUrl);
      absoluteUrl = `${urlObj.origin}${trimmedLine}`;
    } else {
      // Relative path
      absoluteUrl = baseUrl + trimmedLine;
    }
    
    // Encode and proxy the URL
    return proxyBaseUrl + encodeURIComponent(absoluteUrl);
  });
  
  return rewrittenLines.join('\n');
}

function rewriteUriInTag(line: string, baseUrl: string, proxyBaseUrl: string): string {
  // Match URI="..." pattern
  const uriMatch = line.match(/URI="([^"]+)"/);
  if (!uriMatch) return line;
  
  const originalUri = uriMatch[1];
  let absoluteUrl: string;
  
  if (originalUri.startsWith('http://') || originalUri.startsWith('https://')) {
    absoluteUrl = originalUri;
  } else if (originalUri.startsWith('/')) {
    const urlObj = new URL(baseUrl);
    absoluteUrl = `${urlObj.origin}${originalUri}`;
  } else {
    absoluteUrl = baseUrl + originalUri;
  }
  
  const proxiedUri = proxyBaseUrl + encodeURIComponent(absoluteUrl);
  return line.replace(/URI="[^"]+"/, `URI="${proxiedUri}"`);
}
