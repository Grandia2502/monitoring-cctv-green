import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Camera, MonitoringRecord } from '@/types';
import { format } from 'date-fns';
import { Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { monitoringRecordToDbRecording } from '@/lib/supabaseHelpers';

const formSchema = z.object({
  file: z.instanceof(FileList).refine((files) => files.length > 0, 'Video file is required'),
  cameraId: z.string().min(1, 'Camera is required'),
  dateTime: z.string().min(1, 'Date and time is required'),
  description: z.string().min(1, 'Description is required').max(500, 'Description must be less than 500 characters'),
  priority: z.enum(['low', 'medium', 'high'], { required_error: 'Priority is required' }),
});

type FormData = z.infer<typeof formSchema>;

interface UploadFootageFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cameras: Camera[];
  onUploadFootage: (record: MonitoringRecord) => void;
}

export const UploadFootageForm = ({ open, onOpenChange, cameras, onUploadFootage }: UploadFootageFormProps) => {
  const [selectedCamera, setSelectedCamera] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [fileName, setFileName] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      dateTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      const selectedCameraData = cameras.find((cam) => cam.id === data.cameraId);
      const file = data.file[0];
      
      toast({
        title: 'Upload started',
        description: 'Uploading video file to storage...',
      });

      // Create storage path: recordings/{camera_id}/{year}/{month}/{filename}
      const recordedDate = new Date(data.dateTime);
      const year = recordedDate.getFullYear();
      const month = String(recordedDate.getMonth() + 1).padStart(2, '0');
      const timestamp = Date.now();
      const fileExtension = file.name.split('.').pop();
      const fileName = `${timestamp}.${fileExtension}`;
      const storagePath = `${data.cameraId}/${year}/${month}/${fileName}`;

      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('recordings')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('recordings')
        .getPublicUrl(storagePath);
      
      const recordedAt = recordedDate.toISOString();
      
      const recordData = {
        camera_id: data.cameraId,
        file_url: publicUrl,
        thumbnail_url: null,
        description: data.description,
        recorded_at: recordedAt,
        duration: null,
        size: Number((file.size / (1024 * 1024)).toFixed(2)),
        priority: data.priority,
      };

      const { data: insertedData, error } = await supabase
        .from('recordings')
        .insert([recordData])
        .select()
        .single();

      if (error) throw error;

      const newRecord: MonitoringRecord = {
        id: insertedData.id,
        cameraId: data.cameraId,
        cameraName: selectedCameraData?.name || 'Unknown Camera',
        date: format(recordedDate, 'MMM d, yyyy'),
        time: format(recordedDate, 'HH:mm'),
        description: data.description,
        priority: data.priority,
        fileUrl: publicUrl,
        thumbnailUrl: recordData.thumbnail_url,
        duration: recordData.duration,
        size: recordData.size,
        recordedAt: recordedAt,
      };

      onUploadFootage(newRecord);
      
      toast({
        title: 'Upload successful',
        description: 'CCTV footage has been successfully uploaded.',
      });

      handleClose();
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleClose = () => {
    reset();
    setSelectedCamera('');
    setSelectedPriority('');
    setFileName('');
    onOpenChange(false);
  };

  const handleCameraChange = (value: string) => {
    setSelectedCamera(value);
    setValue('cameraId', value);
  };

  const handlePriorityChange = (value: string) => {
    setSelectedPriority(value);
    setValue('priority', value as 'low' | 'medium' | 'high');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload CCTV Footage</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">Video File (MP4) *</Label>
            <div className="flex items-center gap-2">
              <label 
                htmlFor="file" 
                className="flex-1 flex items-center gap-2 px-4 py-2 border border-input rounded-md cursor-pointer hover:bg-accent transition-colors"
              >
                <Upload className="h-4 w-4" />
                <span className="text-sm truncate">
                  {fileName || 'Choose video file...'}
                </span>
              </label>
              <Input
                id="file"
                type="file"
                accept="video/mp4"
                className="hidden"
                {...register('file')}
                onChange={handleFileChange}
              />
            </div>
            {errors.file && (
              <p className="text-sm text-destructive">{errors.file.message as string}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="camera">Camera *</Label>
            <Select value={selectedCamera} onValueChange={handleCameraChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a camera" />
              </SelectTrigger>
              <SelectContent>
                {cameras.map((camera) => (
                  <SelectItem key={camera.id} value={camera.id}>
                    {camera.name} - {camera.location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.cameraId && (
              <p className="text-sm text-destructive">{errors.cameraId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="dateTime">Date & Time *</Label>
            <Input
              id="dateTime"
              type="datetime-local"
              {...register('dateTime')}
            />
            {errors.dateTime && (
              <p className="text-sm text-destructive">{errors.dateTime.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Enter event description..."
              rows={4}
              {...register('description')}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority *</Label>
            <Select value={selectedPriority} onValueChange={handlePriorityChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select priority level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
            {errors.priority && (
              <p className="text-sm text-destructive">{errors.priority.message}</p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={fileName === ''}>
              Upload
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
