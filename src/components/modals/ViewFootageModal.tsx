import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MonitoringRecord } from '@/types';
import { Download, Trash2, Clock, Database, Calendar, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getSignedRecordingUrl } from '@/lib/supabaseHelpers';

interface ViewFootageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  footage: MonitoringRecord | null;
  onDelete?: (id: string) => void;
}

export const ViewFootageModal = ({ open, onOpenChange, footage, onDelete }: ViewFootageModalProps) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (open && footage?.fileUrl) {
      setLoading(true);
      getSignedRecordingUrl(footage.fileUrl)
        .then(url => setSignedUrl(url))
        .finally(() => setLoading(false));
    } else {
      setSignedUrl(null);
    }
  }, [open, footage?.fileUrl]);
  
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>View CCTV Footage</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Video Player */}
          <div className="aspect-video bg-muted rounded-lg overflow-hidden">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : signedUrl ? (
              <video 
                controls 
                className="w-full h-full"
                src={signedUrl}
              >
                Your browser does not support the video tag.
              </video>
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
              <p className="font-medium">{footage.size ? `${footage.size} MB` : 'N/A'}</p>
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
