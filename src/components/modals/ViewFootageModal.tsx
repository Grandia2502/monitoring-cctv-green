import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { MonitoringRecord } from '@/types';
import { 
  Download, 
  Trash2, 
  Clock, 
  Database, 
  Calendar, 
  Loader2, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  SkipBack, 
  SkipForward,
  Settings
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getSignedRecordingUrl } from '@/lib/supabaseHelpers';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';

interface ViewFootageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  footage: MonitoringRecord | null;
  onDelete?: (id: string) => void;
}

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || !isFinite(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const formatFileSize = (bytes: number | null | undefined): string => {
  if (bytes === null || bytes === undefined || bytes === 0) return 'N/A';
  
  const KB = 1024;
  const MB = KB * 1024;
  
  if (bytes < KB) {
    return `${bytes} B`;
  } else if (bytes < MB) {
    const sizeInKB = (bytes / KB).toFixed(2);
    return `${sizeInKB} KB`;
  } else {
    const sizeInMB = (bytes / MB).toFixed(2);
    return `${sizeInMB} MB`;
  }
};

export const ViewFootageModal = ({ open, onOpenChange, footage, onDelete }: ViewFootageModalProps) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Video player states
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const durationRef = useRef(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isBuffering, setIsBuffering] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (open && footage?.fileUrl) {
      setLoading(true);
      getSignedRecordingUrl(footage.fileUrl)
        .then(url => setSignedUrl(url))
        .finally(() => setLoading(false));
    } else {
      setSignedUrl(null);
      // Reset player state when modal closes
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      durationRef.current = 0;
    }
  }, [open, footage?.fileUrl]);

  // Reset player state on new src to avoid first-play desync
  useEffect(() => {
    if (!signedUrl) return;

    setIsPlaying(false);
    setIsBuffering(false);
    setShowControls(true);
    setCurrentTime(0);
    setDuration(0);
    durationRef.current = 0;

    const video = videoRef.current;
    if (video) {
      try {
        video.currentTime = 0;
      } catch {
        // ignore
      }
      video.load();
    }
  }, [signedUrl]);

  // Video event handlers with multiple fallbacks for duration
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !signedUrl) return;

    const setDurationSafe = (next: number) => {
      durationRef.current = next;
      setDuration(next);
    };

    const updateDuration = () => {
      if (video.duration && isFinite(video.duration) && video.duration > 0) {
        setDurationSafe(video.duration);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      // Backup: also check duration on timeupdate
      if (durationRef.current === 0) {
        updateDuration();
      }
    };
    const handleLoadedMetadata = () => {
      updateDuration();
      // Keep UI in sync with the real media element (don't force reset here)
      setCurrentTime(video.currentTime || 0);
    };
    const handleDurationChange = () => updateDuration();
    const handleCanPlay = () => updateDuration();
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => setIsBuffering(false);
    const handleEnded = () => {
      setIsPlaying(false);
      if (video.duration && isFinite(video.duration)) {
        setCurrentTime(video.duration);
      }
    };

    // Check immediately in case metadata already loaded
    updateDuration();

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('ended', handleEnded);
    };
  }, [signedUrl]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skip(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          skip(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(prev => Math.min(1, prev + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(prev => Math.max(0, prev - 0.1));
          break;
        case 'm':
          toggleMute();
          break;
        case 'f':
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Apply volume changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
  }, [volume]);

  // Apply mute changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Apply playback rate changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  }, []);

  const skip = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
  }, []);

  const handleSeek = useCallback((value: number[]) => {
    const video = videoRef.current;
    if (!video) return;
    
    const seekTime = value[0];
    const videoDuration = video.duration;
    
    // Validate before setting to prevent non-finite error
    if (isFinite(seekTime) && seekTime >= 0 && isFinite(videoDuration) && videoDuration > 0) {
      video.currentTime = Math.min(seekTime, videoDuration);
      setCurrentTime(seekTime);
    }
  }, []);

  const handleVolumeChange = useCallback((value: number[]) => {
    setVolume(value[0]);
    if (value[0] > 0) setIsMuted(false);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      video.requestFullscreen();
    }
  }, []);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);
  
  if (!footage) return null;

  const handleDownload = async () => {
    const url = signedUrl || await getSignedRecordingUrl(footage.fileUrl || '');
    if (url) {
      const link = document.createElement('a');
      link.href = url;
      link.download = `footage-${footage.id}.mp4`;
      link.click();
      
      toast({
        title: 'Download Started',
        description: 'Your footage is being downloaded.',
      });
    } else {
      toast({
        title: 'Download Failed',
        description: 'Could not generate download URL.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!onDelete || !footage.id) return;
    
    if (!confirm('Are you sure you want to delete this footage? This action cannot be undone.')) {
      return;
    }
    
    await onDelete(footage.id);
    onOpenChange(false);
  };

  const getPriorityBadge = (priority: string) => {
    const variants = {
      low: 'bg-muted text-muted-foreground',
      medium: 'bg-status-warning text-white',
      high: 'bg-status-offline text-white'
    };
    return variants[priority as keyof typeof variants] || 'bg-muted';
  };

  const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>View CCTV Footage</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Custom Video Player */}
          <div 
            className="relative aspect-video bg-black rounded-lg overflow-hidden group"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => isPlaying && setShowControls(false)}
          >
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : signedUrl ? (
              <>
                <video 
                  key={signedUrl}
                  ref={videoRef}
                  className="w-full h-full cursor-pointer"
                  src={signedUrl}
                  preload="metadata"
                  onClick={togglePlayPause}
                  onDoubleClick={toggleFullscreen}
                  onLoadedMetadata={(e) => {
                    const video = e.currentTarget;
                    if (video.duration && isFinite(video.duration) && video.duration > 0) {
                      durationRef.current = video.duration;
                      setDuration(video.duration);
                    }
                    // Don't force reset; keep UI aligned with actual element state
                    setCurrentTime(video.currentTime || 0);
                  }}
                  onTimeUpdate={(e) => {
                    setCurrentTime(e.currentTarget.currentTime);
                  }}
                >
                  Your browser does not support the video tag.
                </video>

                {/* Buffering indicator */}
                {isBuffering && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Loader2 className="h-12 w-12 animate-spin text-white" />
                  </div>
                )}

                {/* Play/Pause overlay on click */}
                {!isPlaying && !isBuffering && (
                  <div 
                    className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
                    onClick={togglePlayPause}
                  >
                    <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Play className="h-8 w-8 text-white ml-1" />
                    </div>
                  </div>
                )}

                {/* Video Controls */}
                <div 
                  className={cn(
                    "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300",
                    showControls ? "opacity-100" : "opacity-0"
                  )}
                >
                  {/* Progress Bar */}
                  <div className="mb-3">
                    <Slider
                      value={[currentTime]}
                      min={0}
                      max={duration > 0 ? duration : 1}
                      step={0.1}
                      disabled={duration === 0}
                      onValueChange={handleSeek}
                      className="cursor-pointer [&>span:first-child]:h-1.5 [&>span:first-child]:bg-white/30 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:bg-white [&>span:first-child_>span]:bg-primary disabled:opacity-50"
                    />
                  </div>

                  {/* Controls Row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {/* Skip Back */}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-white hover:bg-white/20"
                        onClick={() => skip(-10)}
                      >
                        <SkipBack className="h-4 w-4" />
                      </Button>

                      {/* Play/Pause */}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-9 w-9 text-white hover:bg-white/20"
                        onClick={togglePlayPause}
                      >
                        {isPlaying ? (
                          <Pause className="h-5 w-5" />
                        ) : (
                          <Play className="h-5 w-5 ml-0.5" />
                        )}
                      </Button>

                      {/* Skip Forward */}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-white hover:bg-white/20"
                        onClick={() => skip(10)}
                      >
                        <SkipForward className="h-4 w-4" />
                      </Button>

                      {/* Time Display */}
                      <span className="text-white text-sm font-mono ml-2">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Volume Control */}
                      <div className="flex items-center gap-2 group/volume">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-white hover:bg-white/20"
                          onClick={toggleMute}
                        >
                          {isMuted || volume === 0 ? (
                            <VolumeX className="h-4 w-4" />
                          ) : (
                            <Volume2 className="h-4 w-4" />
                          )}
                        </Button>
                        <div className="w-20 hidden group-hover/volume:block">
                          <Slider
                            value={[isMuted ? 0 : volume]}
                            min={0}
                            max={1}
                            step={0.05}
                            onValueChange={handleVolumeChange}
                            className="[&>span:first-child]:h-1 [&>span:first-child]:bg-white/30 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:bg-white [&>span:first-child_>span]:bg-white"
                          />
                        </div>
                      </div>

                      {/* Playback Speed */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 px-2 text-white hover:bg-white/20 text-xs"
                          >
                            <Settings className="h-3 w-3 mr-1" />
                            {playbackRate}x
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[80px]">
                          {playbackRates.map(rate => (
                            <DropdownMenuItem 
                              key={rate}
                              onClick={() => setPlaybackRate(rate)}
                              className={cn(playbackRate === rate && "bg-accent")}
                            >
                              {rate}x
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Fullscreen */}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-white hover:bg-white/20"
                        onClick={toggleFullscreen}
                      >
                        <Maximize className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                Unable to load video
              </div>
            )}
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Date & Time</span>
              </div>
              <p className="font-medium">{footage.date} at {footage.time}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Duration</span>
              </div>
              <p className="font-medium">{footage.duration || 'N/A'}</p>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Camera</p>
              <p className="font-medium">{footage.cameraName}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Database className="h-4 w-4" />
                <span>File Size</span>
              </div>
              <p className="font-medium">{formatFileSize(footage.size)}</p>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Priority</p>
              <Badge className={getPriorityBadge(footage.priority)}>
                {footage.priority}
              </Badge>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Description</p>
            <p className="text-sm">{footage.description}</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={handleDownload}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
