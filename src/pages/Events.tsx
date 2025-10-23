import { useState } from "react";
import { EventsTable } from "@/components/EventsTable";
import { useEvents } from "@/hooks/useEvents";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IdFilterInput } from "@/components/IdFilterInput";

const Events = () => {
  const [eventFilter, setEventFilter] = useState<string | undefined>(undefined);
  const [updateStatusFilter, setUpdateStatusFilter] = useState<string | undefined>(undefined);
  const [eventIds, setEventIds] = useState<number[]>([]);
  const [contactIds, setContactIds] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data, isLoading } = useEvents({
    eventFilter,
    updateStatusFilter,
    eventIds,
    contactIds,
    sortOrder,
    page: currentPage,
    pageSize
  });

  const handleClearFilters = () => {
    setEventFilter(undefined);
    setUpdateStatusFilter(undefined);
    setEventIds([]);
    setContactIds([]);
    setCurrentPage(1);
  };

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'DESC' ? 'ASC' : 'DESC');
    setCurrentPage(1); // Reset to first page when changing sort
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of table when changing pages
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Event Log</h1>
          <p className="text-muted-foreground mt-2">
            Monitor automated actions and system events
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
            <CardDescription>Filter and sort events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              {/* Event Type Filter */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Event Type:</label>
                <Select
                  value={eventFilter || 'all'}
                  onValueChange={(value) => {
                    setEventFilter(value === 'all' ? undefined : value);
                    setCurrentPage(1); // Reset to first page when filtering
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Events" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    <SelectItem value="call_created">Call Created</SelectItem>
                    <SelectItem value="list_entry">List Entry</SelectItem>
                    <SelectItem value="list_exit">List Exit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Update Status Filter */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Update Status:</label>
                <Select
                  value={updateStatusFilter || 'all'}
                  onValueChange={(value) => {
                    setUpdateStatusFilter(value === 'all' ? undefined : value);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="tasks_updated">Task Updated</SelectItem>
                    <SelectItem value="tasks_update_failed">Error Updating Task</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Event ID Filter */}
              <IdFilterInput
                label="Event ID"
                placeholder="Enter event ID..."
                values={eventIds}
                onValuesChange={(values) => {
                  setEventIds(values as number[]);
                  setCurrentPage(1);
                }}
                type="number"
              />

              {/* Contact ID Filter */}
              <IdFilterInput
                label="Contact ID"
                placeholder="Enter contact ID..."
                values={contactIds}
                onValuesChange={(values) => {
                  setContactIds(values as string[]);
                  setCurrentPage(1);
                }}
                type="text"
              />

              {/* Sort Order */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Sort:</label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSortOrder}
                  className="gap-2"
                >
                  <ArrowUpDown className="h-4 w-4" />
                  {sortOrder === 'DESC' ? 'Newest First' : 'Oldest First'}
                </Button>
              </div>

              {/* Clear Filters */}
              {(eventFilter || updateStatusFilter || eventIds.length > 0 || contactIds.length > 0) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="gap-2"
                >
                  <X className="h-4 w-4" />
                  Clear Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Events Table with Pagination */}
        <EventsTable 
          events={data?.events || []} 
          isLoading={isLoading}
          currentPage={data?.currentPage || 1}
          totalPages={data?.totalPages || 1}
          totalCount={data?.totalCount || 0}
          pageSize={data?.pageSize || pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>
    </div>
  );
};

export default Events;
