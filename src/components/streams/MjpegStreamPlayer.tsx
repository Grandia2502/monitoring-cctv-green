import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StreamPlayerProps } from './types';

const RETRY_INTERVAL_MS = 10000;
const MAX_RETRIES = 5;

export const MjpegStreamPlayer = memo(function MjpegStreamPlayer({
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
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  
  const imgRef = useRef<HTMLImageElement>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Set initial image src on mount or when stream URL changes
  useEffect(() => {
    if (!isOffline && isPlaying && streamUrl) {
      setImageSrc(`${streamUrl}${streamUrl.includes('?') ? '&' : '?'}t=${Date.now()}`);
      setIsLoading(true);
      setHasError(false);
    }
  }, [streamUrl, isOffline, isPlaying]);

  // Notify parent when img ref changes
  useEffect(() => {
    onElementRef?.(imgRef.current);
  }, [onElementRef]);

  // Track mounted state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
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
        // Update image src to trigger reload
        setImageSrc(`${streamUrl}${streamUrl.includes('?') ? '&' : '?'}t=${Date.now()}`);
      }, RETRY_INTERVAL_MS);

      return () => {
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      };
    }
  }, [hasError, retryCount, cameraName, isOffline, streamUrl]);

  const handleLoad = useCallback(() => {
    if (!mountedRef.current) return;
    setIsLoading(false);
    setHasError(false);
    setRetryCount(0);
    setCountdown(0);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    if (!mountedRef.current) return;
    setIsLoading(false);
    setHasError(true);
    onError?.();
  }, [onError]);

  const handleManualRetry = useCallback(() => {
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    
    setIsLoading(true);
    setHasError(false);
    setRetryCount(0);
    setCountdown(0);
    setImageSrc(`${streamUrl}${streamUrl.includes('?') ? '&' : '?'}t=${Date.now()}`);
  }, [streamUrl]);

  const isAutoRetrying = hasError && retryCount < MAX_RETRIES && countdown > 0;
  const hasExhaustedRetries = hasError && retryCount >= MAX_RETRIES;

  // Don't render image if not playing or offline
  const shouldShowImage = !isOffline && isPlaying && imageSrc;

  return (
    <div className="relative w-full h-full">
      {/* Loading Indicator */}
      {!isOffline && isPlaying && isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-muted">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
            <span className="text-xs text-muted-foreground">
              {retryCount > 0 ? `Reconnecting... (${retryCount}/${MAX_RETRIES})` : 'Loading stream...'}
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
      
      {/* Error State - Exhausted Retries */}
      {!isOffline && hasExhaustedRetries && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-muted">
          <span className="text-xs text-muted-foreground mb-2">Stream unavailable</span>
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
      
      {/* MJPEG Stream Image - Always visible when playing, no key prop for stability */}
      {shouldShowImage && (
        <img
          ref={imgRef}
          src={imageSrc}
          alt={`Live stream from ${cameraName}`}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-300",
            isLoading ? "opacity-0" : "opacity-100"
          )}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
    </div>
  );
});
