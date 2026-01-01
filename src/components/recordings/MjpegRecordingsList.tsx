import { useState, useEffect } from 'react';
import { Play, Download, RefreshCw, Video, Copy, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useMjpegRecording, MjpegRecordingFile } from '@/hooks/useMjpegRecording';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';

interface MjpegRecordingsListProps {
  cameraId: string;
  cameraName: string;
  streamUrl?: string;
}

export function MjpegRecordingsList({ cameraId, cameraName, streamUrl }: MjpegRecordingsListProps) {
  const { 
    recordings, 
    isLoadingRecordings, 
    fetchRecordings,
    isRecording,
    isValidStream,
    isServerAvailable,
  } = useMjpegRecording({ cameraId, streamUrl, enabled: true });
  
  const [playingVideo, setPlayingVideo] = useState<MjpegRecordingFile | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  useEffect(() => {
    if (isValidStream) {
      fetchRecordings();
    }
  }, [fetchRecordings, isValidStream]);

  // Auto-refresh server status every 30 seconds
  useEffect(() => {
    if (!isValidStream) return;
    
    const interval = setInterval(() => {
      fetchRecordings();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [fetchRecordings, isValidStream]);

  const handlePlay = (file: MjpegRecordingFile) => {
    setVideoError(null);
    setPlayingVideo(file);
  };

  const handleClosePlayer = () => {
    setPlayingVideo(null);
    setVideoError(null);
  };

  const handleDownload = (file: MjpegRecordingFile) => {
    // Use direct link with download attribute
    const a = document.createElement('a');
    a.href = file.downloadUrl;
    a.download = file.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    toast({
      title: 'Download dimulai',
      description: `Mengunduh ${file.filename}`,
    });
  };

  const handleVideoError = () => {
    setVideoError('Gagal memuat video. Server mungkin offline.');
  };

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: 'Link disalin',
        description: 'URL video berhasil disalin ke clipboard',
      });
    } catch {
      toast({
        title: 'Gagal menyalin',
        description: 'Tidak dapat menyalin link ke clipboard',
        variant: 'destructive',
      });
    }
  };

  // Format file size from bytes to human readable
  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  // Show message if stream URL is not valid for MJPEG recording
  if (!isValidStream) {
    return (
      <Card>
        <CardContent className="text-center py-8 text-muted-foreground">
          <Video className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">Recording tidak tersedia</p>
          <p className="text-sm mt-1">Kamera ini tidak terhubung ke server recording (cctvgreen.site)</p>
        </CardContent>
      </Card>
    );
  }

  // Show message if server is offline
  if (!isServerAvailable) {
    return (
      <Card>
        <CardContent className="text-center py-8 text-destructive">
          <Video className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">Server Recording Offline</p>
          <p className="text-sm mt-1">Tidak dapat menghubungi server recording. Coba lagi nanti.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => fetchRecordings()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Coba Lagi
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              {cameraName} - MJPEG Recordings
            </CardTitle>
            <div className="flex items-center gap-2 mt-2">
              {isRecording && (
                <Badge variant="destructive" className="animate-pulse">
                  Recording in Progress
                </Badge>
              )}
              <Badge 
                variant={isServerAvailable ? "default" : "destructive"} 
                className="flex items-center gap-1"
              >
                {isServerAvailable ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    Server Online
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3 w-3" />
                    Server Offline
                  </>
                )}
              </Badge>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchRecordings()}
            disabled={isLoadingRecordings}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingRecordings ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {isLoadingRecordings ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : recordings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Video className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No recordings found for this camera</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Filename</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recordings.map((file) => (
                    <TableRow key={file.filename}>
                      <TableCell className="font-medium">
                        {file.filename}
                      </TableCell>
                      <TableCell>
                        {file.date ? format(new Date(file.date), 'PPp') : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {formatFileSize(file.size)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePlay(file)}
                            disabled={!isServerAvailable}
                            title="Play video"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(file)}
                            disabled={!isServerAvailable}
                            title="Download video"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyLink(file.playUrl)}
                            disabled={!isServerAvailable}
                            title="Copy link"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Video Player Dialog */}
      <Dialog open={!!playingVideo} onOpenChange={handleClosePlayer}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{playingVideo?.filename}</span>
            </DialogTitle>
          </DialogHeader>
          {playingVideo && (
            <div className="space-y-4">
              <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
                {videoError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-destructive/20">
                    <AlertCircle className="h-12 w-12 mb-3" />
                    <p className="font-medium">{videoError}</p>
                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleCopyLink(playingVideo.playUrl)}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Salin Link
                      </Button>
                    </div>
                  </div>
                ) : (
                  <video
                    controls
                    autoPlay
                    className="w-full h-full"
                    src={playingVideo.playUrl}
                    onError={handleVideoError}
                  >
                    Your browser does not support video playback.
                  </video>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyLink(playingVideo.playUrl)}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Salin Link
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(playingVideo)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
