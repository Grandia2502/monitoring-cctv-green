import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Maximize, Minimize, RefreshCw, Expand, X } from "lucide-react";
import { Camera } from "@/types";
import { cn } from "@/lib/utils";
import { StreamWrapper } from "@/components/streams";
import { detectStreamType } from "@/lib/streamUtils";

interface MultiViewGridModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cameras: Camera[];
  onExpandCamera: (camera: Camera) => void;
}

type GridLayout = "2x2" | "3x3" | "4x4";

const gridConfigs: Record<GridLayout, { cols: number; maxCameras: number }> = {
  "2x2": { cols: 2, maxCameras: 4 },
  "3x3": { cols: 3, maxCameras: 9 },
  "4x4": { cols: 4, maxCameras: 16 },
};

export function MultiViewGridModal({ open, onOpenChange, cameras, onExpandCamera }: MultiViewGridModalProps) {
  const [gridLayout, setGridLayout] = useState<GridLayout>("2x2");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const { cols, maxCameras } = gridConfigs[gridLayout];
  const displayedCameras = cameras.slice(0, maxCameras);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  };

  const handleRefreshAll = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "bg-green-500";
      case "offline":
        return "bg-red-500";
      case "recording":
        return "bg-red-600 animate-pulse";
      default:
        return "bg-muted";
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "online":
        return "default";
      case "offline":
        return "destructive";
      case "recording":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={containerRef}
        className={cn(
          "flex flex-col max-w-[95vw] w-full h-[95vh] max-h-[95vh] p-0 overflow-hidden [&>button]:hidden",
          isFullscreen && "max-w-full max-h-full h-full rounded-none"
        )}
      >
        {/* Fixed Header */}
        <DialogHeader className="flex-shrink-0 p-4 pb-2 border-b bg-background">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-xl font-semibold">Multi-View Monitor</DialogTitle>
            <div className="flex items-center gap-2">
              <Select value={gridLayout} onValueChange={(v) => setGridLayout(v as GridLayout)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2x2">2×2</SelectItem>
                  <SelectItem value="3x3">3×3</SelectItem>
                  <SelectItem value="4x4">4×4</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={handleRefreshAll} title="Refresh All">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={toggleFullscreen} title="Fullscreen">
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="icon" onClick={() => onOpenChange(false)} title="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Grid Container - flex-1 + min-h-0 ensures proper scroll behavior */}
        <div
          className={cn(
            "flex-1 min-h-0 overflow-y-auto bg-muted/50",
            gridLayout === "2x2" && "p-4",
            gridLayout === "3x3" && "p-3",
            gridLayout === "4x4" && "p-2"
          )}
        >
          <div
            className={cn(
              "grid content-start",
              gridLayout === "2x2" && "gap-4",
              gridLayout === "3x3" && "gap-3",
              gridLayout === "4x4" && "gap-2"
            )}
            style={{
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
            }}
          >
            {displayedCameras.map((camera) => (
              <CameraCell
                key={`${camera.id}-${refreshKey}`}
                camera={camera}
                onExpand={() => onExpandCamera(camera)}
                statusColor={getStatusColor(camera.status)}
                statusBadgeVariant={getStatusBadgeVariant(camera.status)}
                gridLayout={gridLayout}
              />
            ))}

            {/* Empty cells if fewer cameras than grid capacity */}
            {Array.from({ length: maxCameras - displayedCameras.length }).map((_, i) => (
              <AspectRatio
                key={`empty-${i}`}
                ratio={16 / 9}
                className="bg-muted rounded-md flex items-center justify-center border border-dashed border-muted-foreground/30 overflow-hidden"
              >
                <span className="text-muted-foreground text-xs">No Camera</span>
              </AspectRatio>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface CameraCellProps {
  camera: Camera;
  onExpand: () => void;
  statusColor: string;
  statusBadgeVariant: "default" | "destructive" | "secondary" | "outline";
  gridLayout: GridLayout;
}

function CameraCell({ camera, onExpand, statusColor, statusBadgeVariant, gridLayout }: CameraCellProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  return (
    <div
      className="bg-background rounded-md overflow-hidden border border-border group cursor-pointer hover:ring-2 hover:ring-primary transition-all"
      onClick={onExpand}
    >
      <AspectRatio ratio={16 / 9} className="relative">
        {/* Status indicator */}
        <div
          className={cn(
            "absolute top-1 left-1 z-10 flex items-center gap-1",
            gridLayout === "4x4" && "top-0.5 left-0.5"
          )}
        >
          <span
            className={cn(
              "rounded-full animate-pulse",
              statusColor,
              gridLayout === "4x4" ? "w-1.5 h-1.5" : "w-2 h-2"
            )}
          />
          <Badge
            variant={statusBadgeVariant}
            className={cn(gridLayout === "4x4" ? "text-[9px] px-1 py-0 h-4" : "text-xs")}
          >
            {camera.status}
          </Badge>
        </div>

        {/* Expand button */}
        <Button
          variant="secondary"
          size="icon"
          className={cn(
            "absolute z-10 opacity-0 group-hover:opacity-100 transition-opacity",
            gridLayout === "4x4" ? "top-0.5 right-0.5 h-5 w-5" : "top-2 right-2 h-7 w-7"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
          title="Expand"
        >
          <Expand className={gridLayout === "4x4" ? "h-3 w-3" : "h-4 w-4"} />
        </Button>

        {/* Stream content */}
        <div className="absolute inset-0">
          <StreamWrapper
            streamUrl={camera.streamUrl}
            cameraName={camera.name}
            cameraId={camera.id}
            streamType={detectStreamType(camera.streamUrl)}
            isOffline={camera.status === "offline"}
            isPlaying={true}
            onLoad={handleLoad}
            onError={handleError}
            className="absolute inset-0 w-full h-full rounded-none"
          />
          {isLoading && camera.status !== "offline" && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <div
                className={cn(
                  "animate-spin rounded-full border-b-2 border-primary",
                  gridLayout === "4x4" ? "h-4 w-4" : "h-6 w-6"
                )}
              />
            </div>
          )}
        </div>

        {/* Camera info overlay */}
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent",
            gridLayout === "4x4" ? "p-1" : "p-2"
          )}
        >
          <p
            className={cn(
              "text-white font-medium truncate",
              gridLayout === "4x4" ? "text-[10px]" : "text-sm"
            )}
          >
            {camera.name}
          </p>
          <p className={cn("text-white/70 truncate", gridLayout === "4x4" ? "text-[8px]" : "text-xs")}>
            {camera.location}
          </p>
        </div>
      </AspectRatio>
    </div>
  );
}
