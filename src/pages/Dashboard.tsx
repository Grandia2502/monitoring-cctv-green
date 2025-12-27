import { useState } from "react";
import { Plus, Grid, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DashboardStats } from "@/components/DashboardStats";
import { AddCameraForm } from "@/components/forms/AddCameraForm";
import { ViewStreamModal } from "@/components/modals/ViewStreamModal";
import { MultiViewGridModal } from "@/components/modals/MultiViewGridModal";
import { Camera, DashboardStats as DashboardStatsType } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { cameraToDbCamera } from "@/lib/supabaseHelpers";
import { toast } from "@/hooks/use-toast";
import { useCameraRealtime } from "@/hooks/useCameraRealtime";
import CameraCard from "@/components/CameraCard";
import HeartbeatTestPanel from "@/components/HeartbeatTestPanel";
import { useAuth } from "@/contexts/AuthContext";

export const Dashboard = () => {
  const { cameras, loading, refetch } = useCameraRealtime();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isAddCameraOpen, setIsAddCameraOpen] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [isViewStreamOpen, setIsViewStreamOpen] = useState(false);
  const [isMultiViewOpen, setIsMultiViewOpen] = useState(false);

  // Calculate stats from real-time cameras
  const stats: DashboardStatsType = {
    totalCameras: cameras.length,
    onlineCameras: cameras.filter((c) => c.status === "online").length,
    offlineCameras: cameras.filter((c) => c.status === "offline").length,
    recordingCameras: cameras.filter((c) => c.status === "recording").length,
  };

  const filteredCameras = cameras.filter((camera) => {
    const matchesSearch =
      camera.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      camera.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || camera.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleViewDetails = (camera: Camera) => {
    setSelectedCamera(camera);
    setIsViewStreamOpen(true);
  };

  const handleAddCamera = async (newCameraData: Omit<Camera, "id" | "lastSeen">) => {
    try {
      if (!user) throw new Error("You must be logged in to add a camera");

      const dbCamera = {
        ...cameraToDbCamera(newCameraData),
        user_id: user.id,
      };
      const { error } = await supabase.from("cameras").insert([dbCamera]);

      if (error) throw error;

      toast({
        title: "Camera added",
        description: "Camera will appear automatically via real-time updates.",
      });
    } catch (error: any) {
      toast({
        title: "Error adding camera",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Monitor all CCTV cameras across CoE Greentech facilities</p>
        </div>
        <Button
          className="bg-primary hover:bg-primary-dark text-primary-foreground"
          onClick={() => setIsAddCameraOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Cameraa
        </Button>
      </div>

      {/* Stats Cards */}
      <DashboardStats stats={stats} />

      {/* Heartbeat Testing Panel */}
      <HeartbeatTestPanel onRefresh={refetch} />

      {/* Filters and Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Input
            placeholder="Search cameras..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-64"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
              <SelectItem value="recording">Recording</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" title="Grid View">
            <Grid className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsMultiViewOpen(true)} title="Multi-View Mode">
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Camera Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading cameras...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredCameras.map((camera) => (
              <CameraCard
                key={camera.id}
                camera={camera}
                onRecord={() => console.log("Record", camera.id)}
                onOpen={() => handleViewDetails(camera)}
              />
            ))}
          </div>

          {filteredCameras.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {cameras.length === 0
                  ? 'No cameras yet. Click "Add Camera" to get started.'
                  : "No cameras found matching your criteria."}
              </p>
            </div>
          )}
        </>
      )}

      {/* Add Camera Modal */}
      <AddCameraForm open={isAddCameraOpen} onOpenChange={setIsAddCameraOpen} mode="quick" onSubmit={handleAddCamera} />

      {/* View Stream Modal */}
      <ViewStreamModal
        open={isViewStreamOpen}
        onOpenChange={setIsViewStreamOpen}
        camera={selectedCamera}
      />

      {/* Multi-View Grid Modal */}
      <MultiViewGridModal
        open={isMultiViewOpen}
        onOpenChange={setIsMultiViewOpen}
        cameras={filteredCameras}
        onExpandCamera={(camera) => {
          setIsMultiViewOpen(false);
          handleViewDetails(camera);
        }}
      />
    </div>
  );
};
