import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Camera } from "@/types";

const cameraFormSchema = z.object({
  name: z.string().min(1, "Camera name is required").max(100),
  location: z.string().min(1, "Location is required").max(200),
  streamUrl: z.string().url("Please enter a valid URL"),
  resolution: z.enum(["1920x1080", "1280x720", "640x480"]),
  fps: z.coerce.number().min(1).max(120),
  status: z.enum(["online", "offline", "warning"]),
});

type CameraFormValues = z.infer<typeof cameraFormSchema>;

interface EditCameraFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  camera: Camera | null;
  onSubmit: (cameraId: string, updatedData: Omit<Camera, "id" | "lastSeen">) => void;
}

export function EditCameraForm({
  open,
  onOpenChange,
  camera,
  onSubmit,
}: EditCameraFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CameraFormValues>({
    resolver: zodResolver(cameraFormSchema),
    defaultValues: {
      name: "",
      location: "",
      streamUrl: "",
      resolution: "1920x1080",
      fps: 30,
      status: "online",
    },
  });

  // Update form values when camera changes
  useEffect(() => {
    if (camera) {
      form.reset({
        name: camera.name,
        location: camera.location,
        streamUrl: camera.streamUrl,
        resolution: camera.resolution as "1920x1080" | "1280x720" | "640x480",
        fps: camera.fps,
        status: camera.status,
      });
    }
  }, [camera, form]);

  const handleSubmit = async (values: CameraFormValues) => {
    if (!camera) return;

    setIsSubmitting(true);
    try {
      const updatedCamera: Omit<Camera, "id" | "lastSeen"> = {
        name: values.name,
        location: values.location,
        streamUrl: values.streamUrl,
        resolution: values.resolution,
        fps: values.fps,
        status: values.status,
      };

      await onSubmit(camera.id, updatedCamera);
      toast.success("Camera updated successfully");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to update camera");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Camera Configuration</DialogTitle>
          <DialogDescription>
            Update the configuration for this CCTV camera.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Camera Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Front Entrance" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Building A - Floor 1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="streamUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stream URL</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="rtsp://192.168.1.100:554/stream"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="resolution"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Resolution</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select resolution" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="1920x1080">1920x1080 (Full HD)</SelectItem>
                        <SelectItem value="1280x720">1280x720 (HD)</SelectItem>
                        <SelectItem value="640x480">640x480 (SD)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fps"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>FPS</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" max="120" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="offline">Offline</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="bg-primary hover:bg-primary-dark"
              >
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
