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
import { Camera, StreamType } from "@/types";
import { detectStreamType, getStreamTypeLabel } from "@/lib/streamUtils";

const cameraFormSchema = z.object({
  name: z.string().min(1, "Camera name is required").max(100),
  location: z.string().min(1, "Location is required").max(200),
  streamUrl: z.string().url("Please enter a valid URL"),
  streamType: z.enum(["mjpeg", "hls", "youtube"]),
});

type CameraFormValues = z.infer<typeof cameraFormSchema>;

interface AddCameraFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "quick" | "full";
  onSubmit: (camera: Omit<Camera, "id" | "lastSeen">) => void;
}

export function AddCameraForm({
  open,
  onOpenChange,
  mode = "full",
  onSubmit,
}: AddCameraFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CameraFormValues>({
    resolver: zodResolver(cameraFormSchema),
    defaultValues: {
      name: "",
      location: "",
      streamUrl: "",
      streamType: "mjpeg",
    },
  });

  // Auto-detect stream type when URL changes
  const streamUrl = form.watch("streamUrl");
  useEffect(() => {
    if (streamUrl) {
      const detected = detectStreamType(streamUrl);
      form.setValue("streamType", detected);
    }
  }, [streamUrl, form]);

  const handleSubmit = async (values: CameraFormValues) => {
    setIsSubmitting(true);
    try {
      const newCamera: Omit<Camera, "id" | "lastSeen"> = {
        name: values.name,
        location: values.location,
        streamUrl: values.streamUrl,
        streamType: values.streamType as StreamType,
        resolution: "1920x1080",
        fps: 30,
        status: "online",
      };

      await onSubmit(newCamera);
      toast.success("Camera added successfully");
      form.reset();
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to add camera");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Camera</DialogTitle>
          <DialogDescription>
            {mode === "quick"
              ? "Quickly add a new CCTV camera to your monitoring system."
              : "Add a new CCTV camera with complete configuration."}
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
                      placeholder="https://example.com/stream.m3u8"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="streamType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stream Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select stream type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="mjpeg">{getStreamTypeLabel('mjpeg')}</SelectItem>
                      <SelectItem value="hls">{getStreamTypeLabel('hls')}</SelectItem>
                      <SelectItem value="youtube">{getStreamTypeLabel('youtube')}</SelectItem>
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
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Adding..." : "Add Camera"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
