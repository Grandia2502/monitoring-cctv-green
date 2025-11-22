import { useState, useEffect } from 'react';
import { Plus, Trash2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AddCameraForm } from '@/components/forms/AddCameraForm';
import { EditCameraForm } from '@/components/forms/EditCameraForm';
import { Camera } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { dbCameraToCamera, cameraToDbCamera } from '@/lib/supabaseHelpers';
import { toast } from '@/hooks/use-toast';

export const CameraManagement = () => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddCameraOpen, setIsAddCameraOpen] = useState(false);
  const [isEditCameraOpen, setIsEditCameraOpen] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCameras();
  }, []);

  const fetchCameras = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cameras')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedCameras = (data || []).map(dbCameraToCamera);
      setCameras(formattedCameras);
    } catch (error: any) {
      toast({
        title: 'Error loading cameras',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

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

  const handleAddCamera = async (newCameraData: Omit<Camera, "id" | "lastSeen">) => {
    try {
      const dbCamera = cameraToDbCamera(newCameraData);
      const { data, error } = await supabase
        .from('cameras')
        .insert([dbCamera])
        .select()
        .single();

      if (error) throw error;

      const newCamera = dbCameraToCamera(data);
      setCameras([newCamera, ...cameras]);
    } catch (error: any) {
      toast({
        title: 'Error adding camera',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleEditCamera = async (cameraId: string, updatedData: Omit<Camera, "id" | "lastSeen">) => {
    try {
      const dbCamera = cameraToDbCamera(updatedData);
      const { error } = await supabase
        .from('cameras')
        .update(dbCamera)
        .eq('id', cameraId);

      if (error) throw error;

      setCameras(cameras.map(camera =>
        camera.id === cameraId
          ? { ...camera, ...updatedData }
          : camera
      ));
    } catch (error: any) {
      toast({
        title: 'Error updating camera',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleDeleteCamera = async (cameraId: string) => {
    try {
      const { error } = await supabase
        .from('cameras')
        .delete()
        .eq('id', cameraId);

      if (error) throw error;

      setCameras(cameras.filter(camera => camera.id !== cameraId));
      toast({
        title: 'Camera deleted',
        description: 'Camera has been successfully removed.',
      });
    } catch (error: any) {
      toast({
        title: 'Error deleting camera',
        description: error.message,
        variant: 'destructive',
      });
    }
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
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Loading cameras...</p>
            </div>
          ) : (
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
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteCamera(camera.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>

      {!loading && filteredCameras.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {cameras.length === 0 
              ? 'No cameras yet. Click "Add New Camera" to get started.' 
              : 'No cameras found matching your search criteria.'}
          </p>
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