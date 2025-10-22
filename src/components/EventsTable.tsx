import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EventRow } from "./EventRow";
import { EnrichedEvent } from "@/types/event";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EventsPagination } from "./EventsPagination";

interface EventsTableProps {
  events: EnrichedEvent[];
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export const EventsTable = ({ 
  events, 
  isLoading,
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  onPageSizeChange
}: EventsTableProps) => {
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);

  const handleToggleExpand = (id: number) => {
    setExpandedRowId(expandedRowId === id ? null : id);
  };
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No events found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg">
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Created At</TableHead>
                <TableHead className="w-[140px]">Event Name</TableHead>
                <TableHead className="w-[200px]">ID</TableHead>
                <TableHead className="w-[200px]">Contact</TableHead>
                <TableHead className="w-[150px]">Owner</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <EventRow 
                  key={event.id} 
                  event={event} 
                  expandedRowId={expandedRowId}
                  onToggleExpand={handleToggleExpand}
                />
              ))}
            </TableBody>
          </Table>
        </TooltipProvider>
      </div>
      
      {/* Pagination Controls */}
      <EventsPagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
};
