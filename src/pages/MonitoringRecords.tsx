import { useState, useEffect } from 'react';
import { Plus, Download, Calendar, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { mockRecords } from '@/data/mockData';
import { MonitoringRecord } from '@/types';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export const MonitoringRecords = () => {
  const [records] = useState<MonitoringRecord[]>(mockRecords);
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
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
    
    return matchesSearch && matchesPriority && matchesDate;
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
          <p className="text-muted-foreground">View and manage monitoring logs and surveillance records</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button className="bg-primary hover:bg-primary-dark text-primary-foreground">
            <Plus className="h-4 w-4 mr-2" />
            Add Record
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
              placeholder="Search records..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
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

      {/* Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>Monitoring Records ({filteredRecords.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead>Camera</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{record.date}</div>
                      <div className="text-sm text-muted-foreground">{record.time}</div>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{record.cameraName}</TableCell>
                  <TableCell>
                    <div className="max-w-md">
                      <p className="text-sm">{record.description}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getPriorityBadge(record.priority)}>
                      {record.priority}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                      <Button variant="ghost" size="sm">
                        Edit
                      </Button>
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
          <p className="text-muted-foreground">No monitoring records found matching your criteria.</p>
        </div>
      )}
    </div>
  );
};