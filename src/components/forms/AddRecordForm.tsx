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
import { supabase } from '@/integrations/supabase/client';

const formSchema = z.object({
  cameraId: z.string().min(1, 'Camera is required'),
  dateTime: z.string().min(1, 'Date and time is required'),
  description: z.string().min(1, 'Description is required').max(500, 'Description must be less than 500 characters'),
  priority: z.enum(['low', 'medium', 'high'], { required_error: 'Priority is required' }),
});

type FormData = z.infer<typeof formSchema>;

interface AddRecordFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cameras: Camera[];
  onAddRecord: (record: MonitoringRecord) => void;
}

export const AddRecordForm = ({ open, onOpenChange, cameras, onAddRecord }: AddRecordFormProps) => {
  const [selectedCamera, setSelectedCamera] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');

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
      const recordedAt = new Date(data.dateTime).toISOString();
      
      const recordData = {
        camera_id: data.cameraId,
        description: data.description,
        recorded_at: recordedAt,
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
        date: format(new Date(data.dateTime), 'MMM d, yyyy'),
        time: format(new Date(data.dateTime), 'HH:mm'),
        description: data.description,
        priority: data.priority,
        recordedAt: recordedAt,
      };

      onAddRecord(newRecord);
      
      toast({
        title: 'Record Added',
        description: 'Monitoring record has been successfully created.',
      });

      handleClose();
    } catch (error: any) {
      toast({
        title: 'Error adding record',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleClose = () => {
    reset();
    setSelectedCamera('');
    setSelectedPriority('');
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Monitoring Record</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
            <Button type="submit">Save Record</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
