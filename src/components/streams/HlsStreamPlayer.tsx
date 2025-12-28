import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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

export function HlsStreamPlayer({
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
  const [retryKey, setRetryKey] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [countdown, setCountdown] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get proxied URL for the stream
  const proxiedStreamUrl = useMemo(() => getProxiedHlsUrl(streamUrl), [streamUrl]);

  // Notify parent when video ref changes
  useEffect(() => {
    onElementRef?.(videoRef.current);
  }, [onElementRef, retryKey]);

  // HLS setup and cleanup
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isOffline || !isPlaying) return;

    setIsLoading(true);
    setHasError(false);

    console.log(`[HLS] Loading stream via proxy: ${proxiedStreamUrl}`);

    // Check if HLS is supported
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
      });

      hls.loadSource(proxiedStreamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log(`[HLS] Manifest loaded for ${cameraName}`);
        video.play().catch(console.error);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error(`[HLS] Error for ${cameraName}:`, data);
        if (data.fatal) {
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
              setHasError(true);
              setIsLoading(false);
              onError?.();
              hls.destroy();
              break;
          }
        }
      });

      hlsRef.current = hls;

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = proxiedStreamUrl;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(console.error);
      });
    } else {
      setHasError(true);
      setIsLoading(false);
      console.error('[HLS] HLS is not supported in this browser');
    }
  }, [proxiedStreamUrl, cameraName, isOffline, isPlaying, retryKey, onError]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      hlsRef.current?.destroy();
    };
  }, []);

  // Auto-retry logic
  useEffect(() => {
    if (hasError && retryCount < MAX_RETRIES && !isOffline) {
      setCountdown(RETRY_INTERVAL_MS / 1000);
      
      countdownIntervalRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      retryTimeoutRef.current = setTimeout(() => {
        console.log(`Auto-retry ${retryCount + 1}/${MAX_RETRIES} for ${cameraName}`);
        setIsLoading(true);
        setHasError(false);
        setRetryCount(prev => prev + 1);
        setRetryKey(prev => prev + 1);
      }, RETRY_INTERVAL_MS);

      return () => {
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      };
    }
  }, [hasError, retryCount, cameraName, isOffline]);

  const handleCanPlay = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
    setRetryCount(0);
    setCountdown(0);
    onLoad?.();
  }, [onLoad]);

  const handleVideoError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
    onError?.();
  }, [onError]);

  const handleManualRetry = () => {
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    
    setIsLoading(true);
    setHasError(false);
    setRetryCount(0);
    setCountdown(0);
    setRetryKey(prev => prev + 1);
  };

  const isAutoRetrying = hasError && retryCount < MAX_RETRIES && countdown > 0;
  const hasExhaustedRetries = hasError && retryCount >= MAX_RETRIES;

  return (
    <div className="relative w-full h-full">
      {/* Loading Indicator */}
      {!isOffline && isLoading && !hasError && (
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
      
      {/* HLS Video Player */}
      <video
        key={retryKey}
        ref={videoRef}
        className={cn(
          "w-full h-full object-cover",
          (isLoading || hasError || isOffline || !isPlaying) && "opacity-0 absolute pointer-events-none"
        )}
        muted
        autoPlay
        playsInline
        onCanPlay={handleCanPlay}
        onError={handleVideoError}
      />
    </div>
  );
}
