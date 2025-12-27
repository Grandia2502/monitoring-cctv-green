import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StreamPlayerProps } from './types';

const RETRY_INTERVAL_MS = 10000;
const MAX_RETRIES = 3;

// Extract YouTube video ID from various URL formats
function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/live\/)([^&?/]+)/,
    /youtube\.com\/.*[?&]v=([^&]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function YouTubeStreamPlayer({
  streamUrl,
  cameraName,
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

  const videoId = useMemo(() => getYouTubeVideoId(streamUrl), [streamUrl]);

  // YouTube player cannot provide a ref for recording
  useEffect(() => {
    onElementRef?.(null);
  }, [onElementRef]);

  // Auto-retry logic
  useEffect(() => {
    if (hasError && retryCount < MAX_RETRIES && !isOffline) {
      setCountdown(RETRY_INTERVAL_MS / 1000);
      
      const countdownInterval = setInterval(() => {
        setCountdown(prev => prev <= 1 ? 0 : prev - 1);
      }, 1000);

      const retryTimeout = setTimeout(() => {
        setIsLoading(true);
        setHasError(false);
        setRetryCount(prev => prev + 1);
        setRetryKey(prev => prev + 1);
      }, RETRY_INTERVAL_MS);

      return () => {
        clearTimeout(retryTimeout);
        clearInterval(countdownInterval);
      };
    }
  }, [hasError, retryCount, isOffline]);

  const handleIframeLoad = () => {
    setIsLoading(false);
    setHasError(false);
    setRetryCount(0);
    onLoad?.();
  };

  const handleManualRetry = () => {
    setIsLoading(true);
    setHasError(false);
    setRetryCount(0);
    setCountdown(0);
    setRetryKey(prev => prev + 1);
  };

  const isAutoRetrying = hasError && retryCount < MAX_RETRIES && countdown > 0;
  const hasExhaustedRetries = hasError && retryCount >= MAX_RETRIES;

  if (!videoId) {
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-muted">
        <span className="text-xs text-muted-foreground">Invalid YouTube URL</span>
      </div>
    );
  }

  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0`;

  return (
    <div className="relative w-full h-full">
      {/* Recording Warning */}
      <div className="absolute top-2 left-2 z-20 flex items-center gap-1 bg-amber-500/90 text-white px-2 py-1 rounded text-[10px]">
        <AlertTriangle className="w-3 h-3" />
        Recording not supported
      </div>

      {/* Loading */}
      {!isOffline && isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-muted">
          <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
        </div>
      )}
      
      {/* Offline */}
      {isOffline && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
          <span className="text-xs font-semibold text-muted-foreground">Camera Offline</span>
        </div>
      )}
      
      {/* Auto-Retry */}
      {!isOffline && isAutoRetrying && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-muted">
          <RefreshCw className="w-5 h-5 text-primary animate-spin mb-2" />
          <span className="text-xs text-muted-foreground">Reconnecting in {countdown}s...</span>
        </div>
      )}
      
      {/* Error */}
      {!isOffline && hasExhaustedRetries && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-muted">
          <span className="text-xs text-muted-foreground mb-2">Stream unavailable</span>
          <Button size="sm" variant="outline" onClick={handleManualRetry} className="h-7 text-xs">
            <RefreshCw className="w-3 h-3 mr-1" />
            Retry
          </Button>
        </div>
      )}
      
      {/* YouTube Embed */}
      {!isOffline && !hasError && isPlaying && (
        <iframe
          key={retryKey}
          src={embedUrl}
          className={cn("w-full h-full border-0", isLoading && "opacity-0")}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          onLoad={handleIframeLoad}
        />
      )}
    </div>
  );
}
