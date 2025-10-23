import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useEvents } from "@/hooks/useEvents";
import { useUsers } from "@/hooks/useUsers";
import { EventsTable } from "@/components/EventsTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, X, Copy } from "lucide-react";
import { OwnerFilter } from "@/components/OwnerFilter";
import { IdFilterInput } from "@/components/IdFilterInput";
import { EventTypeFilter } from "@/components/EventTypeFilter";
import { useToast } from "@/hooks/use-toast";

const Events = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [eventFilters, setEventFilters] = useState<string[]>([]);
  const [updateStatusFilter, setUpdateStatusFilter] = useState<string | undefined>(undefined);
  const [eventIds, setEventIds] = useState<number[]>([]);
  const [contactIds, setContactIds] = useState<string[]>([]);
  const [ownerFilter, setOwnerFilter] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  const { owners, loading: ownersLoading } = useUsers();

  // Initialize state from URL params on mount
  useEffect(() => {
    const eventTypesParam = searchParams.get('event_type');
    const statusParam = searchParams.get('status');
    const ownerParam = searchParams.get('owner');
    const eventIdsParam = searchParams.get('event_id');
    const contactIdsParam = searchParams.get('contact_id');
    const sortParam = searchParams.get('sort');
    
    if (eventTypesParam) setEventFilters(eventTypesParam.split(','));
    if (statusParam) {
      setUpdateStatusFilter(statusParam === 'success' ? 'tasks_updated' : 'tasks_update_failed');
    }
    if (ownerParam) setOwnerFilter(ownerParam);
    if (eventIdsParam) {
      const parsedIds = eventIdsParam.split(',').map(Number).filter(id => !isNaN(id) && isFinite(id));
      setEventIds(parsedIds);
    }
    if (contactIdsParam) setContactIds(contactIdsParam.split(','));
    if (sortParam === 'oldest') setSortOrder('ASC');
  }, []);

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    
    if (eventFilters.length > 0) params.set('event_type', eventFilters.join(','));
    if (updateStatusFilter) {
      params.set('status', updateStatusFilter === 'tasks_updated' ? 'success' : 'failed');
    }
    if (ownerFilter) params.set('owner', ownerFilter);
    if (eventIds.length > 0) params.set('event_id', eventIds.join(','));
    if (contactIds.length > 0) params.set('contact_id', contactIds.join(','));
    if (sortOrder === 'ASC') params.set('sort', 'oldest');
    
    setSearchParams(params, { replace: true });
  }, [eventFilters, updateStatusFilter, ownerFilter, eventIds, contactIds, sortOrder, setSearchParams]);

  const { data, isLoading } = useEvents({
    eventFilters,
    updateStatusFilter,
    eventIds,
    contactIds,
    ownerIds: ownerFilter ? [ownerFilter] : undefined,
    sortOrder,
    page: currentPage,
    pageSize
  });

  const handleClearFilters = () => {
    setEventFilters([]);
    setUpdateStatusFilter(undefined);
    setEventIds([]);
    setContactIds([]);
    setOwnerFilter(undefined);
    setSortOrder('DESC');
    setCurrentPage(1);
  };

  const handleSaveQuery = async () => {
    const currentUrl = window.location.href;
    await navigator.clipboard.writeText(currentUrl);
    
    toast({
      title: "Query Saved",
      description: "The URL has been copied to your clipboard",
    });
  };

  const hasActiveFilters = 
    eventFilters.length > 0 || 
    updateStatusFilter !== undefined || 
    ownerFilter !== undefined || 
    eventIds.length > 0 || 
    contactIds.length > 0 || 
    sortOrder === 'ASC';

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'DESC' ? 'ASC' : 'DESC');
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Event Log</h1>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Main Filters Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Event Type Filter */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Event Type</label>
                  <EventTypeFilter
                    selectedTypes={eventFilters}
                    onTypesChange={(types) => {
                      setEventFilters(types);
                      setCurrentPage(1);
                    }}
                  />
                </div>

                {/* Status Filter */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={updateStatusFilter || 'all'}
                    onValueChange={(value) => {
                      setUpdateStatusFilter(value === 'all' ? undefined : value);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="tasks_updated">Task Updated</SelectItem>
                      <SelectItem value="tasks_update_failed">Error Updating Task</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Contact IDs Filter */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Contact IDs</label>
                  <IdFilterInput
                    placeholder="Add one or more contact ID..."
                    values={contactIds}
                    onValuesChange={(values) => {
                      setContactIds(values as string[]);
                      setCurrentPage(1);
                    }}
                    type="text"
                  />
                </div>

                {/* Owner Filter */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Owner</label>
                  <OwnerFilter
                    owners={owners}
                    selectedOwnerId={ownerFilter}
                    onOwnerChange={(ownerId) => {
                      setOwnerFilter(ownerId);
                      setCurrentPage(1);
                    }}
                    loading={ownersLoading}
                  />
                </div>

                {/* Sort Order */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Sort</label>
                  <Button
                    variant="outline"
                    onClick={toggleSortOrder}
                    className="justify-start gap-2"
                  >
                    <ArrowUpDown className="h-4 w-4" />
                    {sortOrder === 'DESC' ? 'Newest First' : 'Oldest First'}
                  </Button>
                </div>
              </div>

              {/* ID Filters Row with Action Buttons */}
              <div className="flex flex-col md:flex-row gap-4 items-end">
                {/* Event IDs Filter */}
                <div className="flex flex-col gap-2 flex-1 md:max-w-md">
                  <label className="text-sm font-medium">Event IDs</label>
                  <IdFilterInput
                    placeholder="Add one or more event ID..."
                    values={eventIds}
                    onValuesChange={(values) => {
                      setEventIds(values as number[]);
                      setCurrentPage(1);
                    }}
                    type="number"
                  />
                </div>

                {/* Action Buttons */}
                {hasActiveFilters && (
                  <div className="flex items-center gap-2 md:ml-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearFilters}
                      className="gap-2"
                    >
                      <X className="h-4 w-4" />
                      Clear Filters
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleSaveQuery}
                      className="gap-2"
                    >
                      <Copy className="h-4 w-4" />
                      Save Query
                    </Button>
                  </div>
                )}
              </div>
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
