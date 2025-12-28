import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import Hls from 'hls.js';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StreamPlayerProps } from './types';

const RETRY_INTERVAL_MS = 10000;
const MAX_RETRIES = 5;

// Build the proxy URL for HLS streams
function getProxiedHlsUrl(originalUrl: string): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    console.warn('[HLS] SUPABASE_URL not configured, using direct URL');
    return originalUrl;
  }
  return `${supabaseUrl}/functions/v1/hls-proxy?url=${encodeURIComponent(originalUrl)}`;
}

export const HlsStreamPlayer = memo(function HlsStreamPlayer({
  streamUrl,
  cameraName,
  cameraId,
  isOffline = false,
  isPlaying = true,
  onLoad,
  onError,
  onElementRef,
}: StreamPlayerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [countdown, setCountdown] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const playAttemptRef = useRef(0);

  // Get proxied URL for the stream
  const proxiedStreamUrl = useMemo(() => getProxiedHlsUrl(streamUrl), [streamUrl]);

  // Callback ref to track video element and notify parent
  const setVideoRef = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el) {
      onElementRef?.(el);
    }
  }, [onElementRef]);

  // Track mounted state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // HLS setup and cleanup
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isOffline) return;

    // If not playing, destroy HLS and pause video
    if (!isPlaying) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.pause();
      video.removeAttribute('src');
      video.load();
      return;
    }

    if (!mountedRef.current) return;

    setIsLoading(true);
    setHasError(false);
    playAttemptRef.current = 0;

    console.log(`[HLS] Loading stream via proxy: ${proxiedStreamUrl}`);

    // Safe play function with retry logic
    const safePlay = async () => {
      if (!mountedRef.current || !video) return;
      
      playAttemptRef.current++;
      const currentAttempt = playAttemptRef.current;
      
      try {
        await video.play();
      } catch (e: any) {
        if (!mountedRef.current || currentAttempt !== playAttemptRef.current) return;
        
        if (e.name === 'AbortError') {
          // Play was interrupted, retry after a delay
          console.log(`[HLS] Play interrupted for ${cameraName}, retrying...`);
          setTimeout(() => {
            if (mountedRef.current && currentAttempt === playAttemptRef.current) {
              safePlay();
            }
          }, 200);
        } else if (e.name !== 'NotAllowedError') {
          console.error('[HLS] Play error:', e);
        }
      }
    };

    // Check if HLS is supported
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false, // Disable for stability in multi-view
        backBufferLength: 90,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        maxBufferHole: 0.5, // Allow 0.5s gaps in buffer
        startLevel: -1, // Auto quality selection
        liveSyncDuration: 5,
        liveMaxLatencyDuration: 10,
      });

      hls.loadSource(proxiedStreamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!mountedRef.current) return;
        console.log(`[HLS] Manifest loaded for ${cameraName}`);
        safePlay();
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (!mountedRef.current) return;
        
        // Ignore non-fatal errors (including bufferStalledError)
        if (!data.fatal) {
          console.log(`[HLS] Non-fatal error for ${cameraName}:`, data.details);
          return; // Don't show loading indicator for non-fatal errors
        }
        
        console.error(`[HLS] Fatal error for ${cameraName}:`, data);
        
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            console.log('[HLS] Network error, trying to recover...');
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.log('[HLS] Media error, trying to recover...');
            hls.recoverMediaError();
            break;
          default:
            if (mountedRef.current) {
              setHasError(true);
              setIsLoading(false);
              onError?.();
            }
            hls.destroy();
            break;
        }
      });

      hlsRef.current = hls;

      return () => {
        playAttemptRef.current++; // Cancel any pending play attempts
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = proxiedStreamUrl;
      
      const handleLoadedMetadata = () => {
        if (mountedRef.current) {
          safePlay();
        }
      };
      
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      
      return () => {
        playAttemptRef.current++;
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeAttribute('src');
        video.load();
      };
    } else {
      if (mountedRef.current) {
        setHasError(true);
        setIsLoading(false);
      }
      console.error('[HLS] HLS is not supported in this browser');
    }
  }, [proxiedStreamUrl, cameraName, isOffline, isPlaying, onError]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  // Auto-retry logic
  useEffect(() => {
    if (hasError && retryCount < MAX_RETRIES && !isOffline) {
      setCountdown(RETRY_INTERVAL_MS / 1000);
      
      countdownIntervalRef.current = setInterval(() => {
        if (!mountedRef.current) return;
        setCountdown(prev => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      retryTimeoutRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        console.log(`Auto-retry ${retryCount + 1}/${MAX_RETRIES} for ${cameraName}`);
        setIsLoading(true);
        setHasError(false);
        setRetryCount(prev => prev + 1);
      }, RETRY_INTERVAL_MS);

      return () => {
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      };
    }
  }, [hasError, retryCount, cameraName, isOffline]);

  const handleCanPlay = useCallback(() => {
    if (!mountedRef.current) return;
    setIsLoading(false);
    setHasError(false);
    setRetryCount(0);
    setCountdown(0);
    
    // Ensure element ref is registered when stream is ready
    if (videoRef.current) {
      onElementRef?.(videoRef.current);
    }
    
    onLoad?.();
  }, [onLoad, onElementRef]);

  const handleVideoError = useCallback(() => {
    if (!mountedRef.current) return;
    // Don't immediately set error - let HLS library try to recover first
    console.log(`[HLS] Video error event for ${cameraName}`);
  }, [cameraName]);

  const handleManualRetry = useCallback(() => {
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    
    // Destroy existing HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    
    setIsLoading(true);
    setHasError(false);
    setRetryCount(0);
    setCountdown(0);
  }, []);

  const isAutoRetrying = hasError && retryCount < MAX_RETRIES && countdown > 0;
  const hasExhaustedRetries = hasError && retryCount >= MAX_RETRIES;

  return (
    <div className="relative w-full h-full">
      {/* Loading Indicator */}
      {!isOffline && isPlaying && isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-muted">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
            <span className="text-xs text-muted-foreground">
              {retryCount > 0 ? `Reconnecting... (${retryCount}/${MAX_RETRIES})` : 'Loading HLS stream...'}
            </span>
          </div>
        </div>
      )}
      
      {/* Offline State */}
      {isOffline && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
          <span className="text-xs font-semibold text-muted-foreground">Camera Offline</span>
        </div>
      )}
      
      {/* Auto-Retry State */}
      {!isOffline && isAutoRetrying && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-muted">
          <RefreshCw className="w-5 h-5 text-primary animate-spin mb-2" />
          <span className="text-xs text-muted-foreground mb-1">Reconnecting in {countdown}s...</span>
          <span className="text-[10px] text-muted-foreground">Attempt {retryCount + 1}/{MAX_RETRIES}</span>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleManualRetry}
            className="h-6 text-[10px] mt-2"
          >
            Retry Now
          </Button>
        </div>
      )}
      
      {/* Error State */}
      {!isOffline && hasExhaustedRetries && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-muted">
          <span className="text-xs text-muted-foreground mb-2">HLS stream unavailable</span>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleManualRetry}
            className="h-7 text-xs"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Retry
          </Button>
        </div>
      )}
      
      {/* HLS Video Player - no key prop for stability */}
      {!isOffline && isPlaying && (
        <video
          ref={setVideoRef}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-300",
            (isLoading || hasError) ? "opacity-0" : "opacity-100"
          )}
          muted
          autoPlay
          playsInline
          onCanPlay={handleCanPlay}
          onError={handleVideoError}
        />
      )}
    </div>
  );
});
