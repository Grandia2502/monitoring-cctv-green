import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, Download, Cloud, HardDrive } from 'lucide-react';

export interface SaveRecordingOptions {
  uploadToCloud: boolean;
  downloadLocal: boolean;
}

interface SaveRecordingDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (options: SaveRecordingOptions) => Promise<void>;
  cameraName: string;
  duration: string;
}

export function SaveRecordingDialog({
  open,
  onClose,
  onSave,
  cameraName,
  duration,
}: SaveRecordingDialogProps) {
  const [uploadToCloud, setUploadToCloud] = useState(true);
  const [downloadLocal, setDownloadLocal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!uploadToCloud && !downloadLocal) return;
    
    setIsSaving(true);
    try {
      await onSave({ uploadToCloud, downloadLocal });
      onClose();
    } catch (error) {
      console.error('[SaveRecordingDialog:error]', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (!isSaving) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleCancel()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Save Recording
          </DialogTitle>
          <DialogDescription>
            Recording from <strong>{cameraName}</strong> ({duration})
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="flex items-center space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
            <Checkbox
              id="upload-cloud"
              checked={uploadToCloud}
              onCheckedChange={(checked) => setUploadToCloud(checked === true)}
              disabled={isSaving}
            />
            <Label
              htmlFor="upload-cloud"
              className="flex items-center gap-2 cursor-pointer flex-1"
            >
              <Cloud className="h-4 w-4 text-primary" />
              <div>
                <div className="font-medium">Upload ke Cloud Storage</div>
                <div className="text-xs text-muted-foreground">
                  Simpan ke folder recordings/{'{camera_id}'}
                </div>
              </div>
            </Label>
          </div>

          <div className="flex items-center space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
            <Checkbox
              id="download-local"
              checked={downloadLocal}
              onCheckedChange={(checked) => setDownloadLocal(checked === true)}
              disabled={isSaving}
            />
            <Label
              htmlFor="download-local"
              className="flex items-center gap-2 cursor-pointer flex-1"
            >
              <Download className="h-4 w-4 text-primary" />
              <div>
                <div className="font-medium">Download ke Komputer</div>
                <div className="text-xs text-muted-foreground">
                  Simpan langsung ke folder Downloads
                </div>
              </div>
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || (!uploadToCloud && !downloadLocal)}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Recording'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
