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
      {/* Sticky Pagination Controls */}
      <div className="sticky top-0 z-20 bg-background pb-4">
        <EventsPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      </div>
      
      <div className="border rounded-lg">
        <TooltipProvider>
          <Table>
            <TableHeader className="sticky top-[72px] z-10 bg-background">
              <TableRow className="bg-background hover:bg-background">
                <TableHead className="w-[180px] bg-background">Created At</TableHead>
                <TableHead className="w-[140px] bg-background">Event Name</TableHead>
                <TableHead className="w-[200px] bg-background">ID</TableHead>
                <TableHead className="w-[200px] bg-background">Contact</TableHead>
                <TableHead className="w-[150px] bg-background">Owner</TableHead>
                <TableHead className="w-[50px] bg-background"></TableHead>
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
    </div>
  );
};
