import { useState, useEffect } from 'react';
import { Play, Download, RefreshCw, Video, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useMjpegRecording, MjpegRecordingFile } from '@/hooks/useMjpegRecording';
import { format } from 'date-fns';

interface MjpegRecordingsListProps {
  cameraId: string;
  cameraName: string;
  streamUrl?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
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

  useEffect(() => {
    if (isValidStream) {
      fetchRecordings();
    }
  }, [fetchRecordings, isValidStream]);

  const handlePlay = (file: MjpegRecordingFile) => {
    setPlayingVideo(file);
  };

  const handleDownload = (file: MjpegRecordingFile) => {
    const link = document.createElement('a');
    link.href = file.downloadUrl;
    link.download = file.filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            {isRecording && (
              <Badge variant="destructive" className="mt-2 animate-pulse">
                Recording in Progress
              </Badge>
            )}
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
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(file)}
                          >
                            <Download className="h-4 w-4" />
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
      <Dialog open={!!playingVideo} onOpenChange={() => setPlayingVideo(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{playingVideo?.filename}</span>
            </DialogTitle>
          </DialogHeader>
          {playingVideo && (
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              <video
                controls
                autoPlay
                className="w-full h-full"
                src={playingVideo.playUrl}
              >
                Your browser does not support video playback.
              </video>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
