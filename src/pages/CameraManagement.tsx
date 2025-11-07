import { useState } from 'react';
import { Plus, Trash2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AddCameraForm } from '@/components/forms/AddCameraForm';
import { EditCameraForm } from '@/components/forms/EditCameraForm';
import { mockCameras } from '@/data/mockData';
import { Camera } from '@/types';

export const CameraManagement = () => {
  const [cameras, setCameras] = useState<Camera[]>(mockCameras);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddCameraOpen, setIsAddCameraOpen] = useState(false);
  const [isEditCameraOpen, setIsEditCameraOpen] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);

  const filteredCameras = cameras.filter(camera =>
    camera.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    camera.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const variants = {
      online: 'bg-status-online text-white',
      offline: 'bg-status-offline text-white',
      warning: 'bg-status-warning text-white'
    };
    return variants[status as keyof typeof variants] || 'bg-muted';
  };

  const handleAddCamera = (newCameraData: Omit<Camera, "id" | "lastSeen">) => {
    const newCamera: Camera = {
      ...newCameraData,
      id: `cam-${Date.now()}`,
      lastSeen: new Date().toISOString(),
    };
    setCameras([...cameras, newCamera]);
  };

  const handleEditCamera = (cameraId: string, updatedData: Omit<Camera, "id" | "lastSeen">) => {
    setCameras(cameras.map(camera => 
      camera.id === cameraId 
        ? { ...camera, ...updatedData, lastSeen: new Date().toISOString() }
        : camera
    ));
  };

  const openEditModal = (camera: Camera) => {
    setSelectedCamera(camera);
    setIsEditCameraOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Camera Management</h1>
          <p className="text-muted-foreground">Manage CCTV cameras, configurations, and monitoring settings</p>
        </div>
        <Button 
          className="bg-primary hover:bg-primary-dark text-primary-foreground"
          onClick={() => setIsAddCameraOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add New Camera
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Search by camera name or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </CardContent>
      </Card>

      {/* Camera Table */}
      <Card>
        <CardHeader>
          <CardTitle>Camera List ({filteredCameras.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Resolution</TableHead>
                <TableHead>FPS</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCameras.map((camera) => (
                <TableRow key={camera.id}>
                  <TableCell className="font-medium">{camera.name}</TableCell>
                  <TableCell>{camera.location}</TableCell>
                  <TableCell>
                    <Badge className={getStatusBadge(camera.status)}>
                      {camera.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{camera.resolution}</TableCell>
                  <TableCell>{camera.fps} FPS</TableCell>
                  <TableCell>{new Date(camera.lastSeen).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => openEditModal(camera)}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {filteredCameras.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No cameras found matching your search criteria.</p>
        </div>
      )}

      {/* Add Camera Modal */}
      <AddCameraForm
        open={isAddCameraOpen}
        onOpenChange={setIsAddCameraOpen}
        mode="full"
        onSubmit={handleAddCamera}
      />

      {/* Edit Camera Modal */}
      <EditCameraForm
        open={isEditCameraOpen}
        onOpenChange={setIsEditCameraOpen}
        camera={selectedCamera}
        onSubmit={handleEditCamera}
      />
    </div>
  );
};