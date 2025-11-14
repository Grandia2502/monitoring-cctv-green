import { useState, useEffect } from 'react';
import { Upload, FileDown, Calendar, X, Play, MoreVertical, Download, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { mockRecords, mockCameras } from '@/data/mockData';
import { MonitoringRecord } from '@/types';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { UploadFootageForm } from '@/components/forms/UploadFootageForm';
import { ViewFootageModal } from '@/components/modals/ViewFootageModal';
import { toast } from '@/hooks/use-toast';

export const MonitoringRecords = () => {
  const [records, setRecords] = useState<MonitoringRecord[]>(mockRecords);
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [cameraFilter, setCameraFilter] = useState<string>('all');
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedFootage, setSelectedFootage] = useState<MonitoringRecord | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
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
    const matchesPriority = priorityFilter === 'all' || record.priority === priorityFilter;
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
    
    return matchesSearch && matchesPriority && matchesDate && matchesCamera;
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

  const handleDeleteFootage = (id: string) => {
    setRecords(records.filter(r => r.id !== id));
  };

  const handleDownloadFootage = (record: MonitoringRecord) => {
    if (record.fileUrl) {
      const link = document.createElement('a');
      link.href = record.fileUrl;
      link.download = `footage-${record.id}.mp4`;
      link.click();
      
      toast({
        title: 'Download Started',
        description: 'Your footage is being downloaded.',
      });
    }
  };

  const handleExportMetadata = () => {
    // Convert records to CSV
    const headers = ['ID', 'Camera', 'Date', 'Time', 'Duration', 'Size (MB)', 'Priority', 'Description'];
    const csvData = [
      headers.join(','),
      ...filteredRecords.map(r => [
        r.id,
        r.cameraName,
        r.date,
        r.time,
        r.duration || 'N/A',
        r.size || 'N/A',
        r.priority,
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

  const getPriorityBadge = (priority: string) => {
    const variants = {
      low: 'bg-muted text-muted-foreground',
      medium: 'bg-status-warning text-white',
      high: 'bg-status-offline text-white'
    };
    return variants[priority as keyof typeof variants] || 'bg-muted';
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
                {mockCameras.map((camera) => (
                  <SelectItem key={camera.id} value={camera.id}>
                    {camera.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thumbnail</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Camera</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Priority</TableHead>
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
                    <span className="text-sm">{record.size ? `${record.size} MB` : 'N/A'}</span>
                  </TableCell>
                  <TableCell>
                    <Badge className={getPriorityBadge(record.priority)}>
                      {record.priority}
                    </Badge>
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
                            onClick={() => handleDeleteFootage(record.id)}
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
        </CardContent>
      </Card>

      {filteredRecords.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No footage found matching your criteria.</p>
        </div>
      )}

      <UploadFootageForm
        open={isUploadDialogOpen}
        onOpenChange={setIsUploadDialogOpen}
        cameras={mockCameras}
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