import { useState } from "react";
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
  status: z.enum(["online", "offline", "warning", "recording"]),
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
      resolution: "1920x1080",
      fps: 30,
      status: "online",
    },
  });

  const handleSubmit = async (values: CameraFormValues) => {
    setIsSubmitting(true);
    try {
      const newCamera: Omit<Camera, "id" | "lastSeen"> = {
        name: values.name,
        location: values.location,
        streamUrl: values.streamUrl,
        resolution: values.resolution,
        fps: values.fps,
        status: values.status,
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
  };

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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="offline">Offline</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="recording">Recording</SelectItem>
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
