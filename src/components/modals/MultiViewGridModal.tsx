import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Maximize, Minimize, RefreshCw, Expand, X } from "lucide-react";
import { Camera } from "@/types";
import { cn } from "@/lib/utils";

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
      case "warning":
        return "bg-yellow-500";
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
      case "warning":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={containerRef}
        className={cn(
          "max-w-[95vw] w-full max-h-[95vh] p-0 overflow-hidden [&>button]:hidden",
          isFullscreen && "max-w-full max-h-full rounded-none"
        )}
      >
        <DialogHeader className="p-4 pb-2 border-b bg-background">
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

        <div
          className={cn(
            "grid gap-2 p-2 bg-muted/50 overflow-auto",
            isFullscreen ? "h-[calc(100vh-60px)]" : "h-[calc(85vh-80px)]"
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
            />
          ))}

          {/* Empty cells if fewer cameras than grid capacity */}
          {Array.from({ length: maxCameras - displayedCameras.length }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="aspect-video bg-muted rounded-lg flex items-center justify-center border border-dashed border-muted-foreground/30"
            >
              <span className="text-muted-foreground text-sm">No Camera</span>
            </div>
          ))}
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
}

function CameraCell({ camera, onExpand, statusColor, statusBadgeVariant }: CameraCellProps) {
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
      className="relative aspect-video bg-background rounded-lg overflow-hidden border border-border group cursor-pointer hover:ring-2 hover:ring-primary transition-all"
      onClick={onExpand}
    >
      {/* Status indicator */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
        <span className={cn("w-2 h-2 rounded-full animate-pulse", statusColor)} />
        <Badge variant={statusBadgeVariant} className="text-xs">
          {camera.status}
        </Badge>
      </div>

      {/* Expand button */}
      <Button
        variant="secondary"
        size="icon"
        className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7"
        onClick={(e) => {
          e.stopPropagation();
          onExpand();
        }}
        title="Expand"
      >
        <Expand className="h-4 w-4" />
      </Button>

      {/* Stream content */}
      {camera.status === "offline" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <span className="text-muted-foreground text-sm">Offline</span>
        </div>
      ) : (
        <>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          )}

          {hasError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <span className="text-destructive text-sm">Stream Error</span>
            </div>
          ) : (
            <img
              src={camera.streamUrl}
              alt={camera.name}
              className={cn("w-full h-full object-cover", isLoading && "opacity-0")}
              onLoad={handleLoad}
              onError={handleError}
            />
          )}
        </>
      )}

      {/* Camera info overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
        <p className="text-white text-sm font-medium truncate">{camera.name}</p>
        <p className="text-white/70 text-xs truncate">{camera.location}</p>
      </div>
    </div>
  );
}
