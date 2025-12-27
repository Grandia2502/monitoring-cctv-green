import { useState, useEffect } from 'react';
import { Upload, FileDown, Calendar, X, Play, MoreVertical, Download, Trash2, Eye } from 'lucide-react';

const formatFileSize = (bytes: number | null | undefined): string => {
  if (bytes === null || bytes === undefined || bytes === 0) return 'N/A';
  
  const KB = 1024;
  const MB = KB * 1024;
  
  if (bytes < KB) {
    return `${bytes} B`;
  } else if (bytes < MB) {
    const sizeInKB = (bytes / KB).toFixed(2);
    return `${sizeInKB} KB`;
  } else {
    const sizeInMB = (bytes / MB).toFixed(2);
    return `${sizeInMB} MB`;
  }
};
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { MonitoringRecord, Camera } from '@/types';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { UploadFootageForm } from '@/components/forms/UploadFootageForm';
import { ViewFootageModal } from '@/components/modals/ViewFootageModal';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { dbRecordingToMonitoringRecord, dbCameraToCamera, getSignedRecordingUrl } from '@/lib/supabaseHelpers';

export const MonitoringRecords = () => {
  const [records, setRecords] = useState<MonitoringRecord[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cameraFilter, setCameraFilter] = useState<string>('all');
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedFootage, setSelectedFootage] = useState<MonitoringRecord | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>(() => {
    const saved = localStorage.getItem('monitoringRecordsDateRange');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        from: parsed.from ? new Date(parsed.from) : undefined,
        to: parsed.to ? new Date(parsed.to) : undefined,
      };
    }
    return { from: undefined, to: undefined };
  });
  const [tempDateRange, setTempDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>(dateRange);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  
  useEffect(() => {
    fetchCameras();
    fetchRecordings();

    // Setup realtime subscription for recordings
    const channel = supabase
      .channel('recordings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recordings'
        },
        () => {
          console.log('Recordings updated, refreshing data...');
          fetchRecordings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCameras = async () => {
    try {
      const { data, error } = await supabase
        .from('cameras')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;

      const formattedCameras = (data || []).map(dbCameraToCamera);
      setCameras(formattedCameras);
    } catch (error: any) {
      toast({
        title: 'Error loading cameras',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const fetchRecordings = async () => {
    try {
      setLoading(true);
      const { data: recordingsData, error: recordingsError } = await supabase
        .from('recordings')
        .select('*, cameras(name)')
        .order('recorded_at', { ascending: false });

      if (recordingsError) throw recordingsError;

      const formattedRecords = (recordingsData || []).map((dbRecord: any) => 
        dbRecordingToMonitoringRecord(dbRecord, dbRecord.cameras?.name || 'Unknown Camera')
      );
      setRecords(formattedRecords);
    } catch (error: any) {
      toast({
        title: 'Error loading recordings',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dateRange.from || dateRange.to) {
      localStorage.setItem('monitoringRecordsDateRange', JSON.stringify({
        from: dateRange.from?.toISOString(),
        to: dateRange.to?.toISOString(),
      }));
    } else {
      localStorage.removeItem('monitoringRecordsDateRange');
    }
  }, [dateRange]);

  const filteredRecords = records.filter(record => {
    const matchesSearch = record.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.cameraName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCamera = cameraFilter === 'all' || record.cameraId === cameraFilter;
    
    let matchesDate = true;
    if (dateRange.from || dateRange.to) {
      const recordDate = new Date(record.date);
      if (dateRange.from && dateRange.to) {
        matchesDate = recordDate >= dateRange.from && recordDate <= dateRange.to;
      } else if (dateRange.from) {
        matchesDate = recordDate >= dateRange.from;
      } else if (dateRange.to) {
        matchesDate = recordDate <= dateRange.to;
      }
    }
    
    return matchesSearch && matchesDate && matchesCamera;
  });

  const handleApplyDateRange = () => {
    setDateRange(tempDateRange);
    setIsDatePickerOpen(false);
  };

  const handleClearDateRange = () => {
    setDateRange({ from: undefined, to: undefined });
    setTempDateRange({ from: undefined, to: undefined });
    setIsDatePickerOpen(false);
  };

  const getDateRangeLabel = () => {
    if (dateRange.from && dateRange.to) {
      return `${format(dateRange.from, 'MMM d')} – ${format(dateRange.to, 'MMM d, yyyy')}`;
    } else if (dateRange.from) {
      return `From ${format(dateRange.from, 'MMM d, yyyy')}`;
    } else if (dateRange.to) {
      return `Until ${format(dateRange.to, 'MMM d, yyyy')}`;
    }
    return 'Date Range';
  };

  const handleUploadFootage = (newRecord: MonitoringRecord) => {
    setRecords([newRecord, ...records]);
  };

  const handleViewFootage = (record: MonitoringRecord) => {
    setSelectedFootage(record);
    setIsViewModalOpen(true);
  };

  const handleDeleteFootage = async (id: string) => {
    try {
      // Find the recording to get the file URL
      const record = records.find(r => r.id === id);
      
      if (record?.fileUrl) {
        // Extract storage path from the public URL
        // Format: https://{project}.supabase.co/storage/v1/object/public/recordings/{path}
        const urlParts = record.fileUrl.split('/recordings/');
        if (urlParts.length > 1) {
          const storagePath = urlParts[1];
          
          // Delete file from storage
          const { error: storageError } = await supabase.storage
            .from('recordings')
            .remove([storagePath]);

          if (storageError) {
            console.error('Error deleting file from storage:', storageError);
            // Continue with database deletion even if storage deletion fails
          }
        }
      }

      // Delete from database
      const { error } = await supabase
        .from('recordings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setRecords(records.filter(r => r.id !== id));
      toast({
        title: 'Recording deleted',
        description: 'Recording and file have been successfully removed.',
      });
    } catch (error: any) {
      toast({
        title: 'Error deleting recording',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDownloadFootage = async (record: MonitoringRecord) => {
    if (record.fileUrl) {
      const signedUrl = await getSignedRecordingUrl(record.fileUrl);
      if (signedUrl) {
        const link = document.createElement('a');
        link.href = signedUrl;
        link.download = `footage-${record.id}.mp4`;
        link.click();
        
        toast({
          title: 'Download Started',
          description: 'Your footage is being downloaded.',
        });
      } else {
        toast({
          title: 'Download Failed',
          description: 'Could not generate download URL.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleExportMetadata = () => {
    // Convert records to CSV
    const headers = ['ID', 'Camera', 'Date', 'Time', 'Duration', 'Size (MB)', 'Description'];
    const csvData = [
      headers.join(','),
      ...filteredRecords.map(r => [
        r.id,
        r.cameraName,
        r.date,
        r.time,
        r.duration || 'N/A',
        r.size || 'N/A',
        `"${r.description}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `footage-metadata-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Metadata Exported',
      description: 'CSV file has been downloaded successfully.',
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Monitoring Records</h1>
          <p className="text-muted-foreground">Manage and view CCTV footage files</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportMetadata}>
            <FileDown className="h-4 w-4 mr-2" />
            Export Metadata
          </Button>
          <Button 
            className="bg-primary hover:bg-primary-dark text-primary-foreground"
            onClick={() => setIsUploadDialogOpen(true)}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Footage
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <Input
              placeholder="Search by description or camera..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Select value={cameraFilter} onValueChange={setCameraFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Cameras" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cameras</SelectItem>
                {cameras.map((camera) => (
                  <SelectItem key={camera.id} value={camera.id}>
                    {camera.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className={cn(
                    "justify-start text-left font-normal",
                    (dateRange.from || dateRange.to) && "border-primary"
                  )}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  {getDateRangeLabel()}
                  {(dateRange.from || dateRange.to) && (
                    <X 
                      className="h-4 w-4 ml-2 hover:text-destructive" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClearDateRange();
                      }}
                    />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3 space-y-3">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Select Date Range</div>
                    <CalendarComponent
                      mode="range"
                      selected={{ from: tempDateRange.from, to: tempDateRange.to }}
                      onSelect={(range) => setTempDateRange({ from: range?.from, to: range?.to })}
                      numberOfMonths={2}
                      className="pointer-events-auto"
                    />
                  </div>
                  <div className="flex gap-2 pt-2 border-t">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={handleClearDateRange}
                      className="flex-1"
                    >
                      Clear
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={handleApplyDateRange}
                      className="flex-1"
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* Footage Table */}
      <Card>
        <CardHeader>
          <CardTitle>CCTV Footage ({filteredRecords.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Loading recordings...</p>
            </div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thumbnail</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Camera</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Size</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <div className="w-20 h-14 rounded overflow-hidden bg-muted">
                      {record.thumbnailUrl ? (
                        <img 
                          src={record.thumbnailUrl} 
                          alt="Footage thumbnail"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Play className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{record.date}</div>
                      <div className="text-sm text-muted-foreground">{record.time}</div>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{record.cameraName}</TableCell>
                  <TableCell>
                    <span className="text-sm">{record.duration || 'N/A'}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{formatFileSize(record.size)}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleViewFootage(record)}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleDownloadFootage(record)}>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleViewFootage(record)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                           <DropdownMenuItem 
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this footage? This action cannot be undone.')) {
                                handleDeleteFootage(record.id);
                              }
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>

      {!loading && filteredRecords.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {records.length === 0 
              ? 'No footage yet. Click "Upload Footage" to get started.' 
              : 'No footage found matching your criteria.'}
          </p>
        </div>
      )}

      <UploadFootageForm
        open={isUploadDialogOpen}
        onOpenChange={setIsUploadDialogOpen}
        cameras={cameras}
        onUploadFootage={handleUploadFootage}
      />

      <ViewFootageModal
        open={isViewModalOpen}
        onOpenChange={setIsViewModalOpen}
        footage={selectedFootage}
        onDelete={handleDeleteFootage}
      />
    </div>
  );
};