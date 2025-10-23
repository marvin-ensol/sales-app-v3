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
      
      <div className="border rounded-lg overflow-hidden">
        <div className="w-full overflow-x-auto">
          <TooltipProvider>
            <table className="w-full caption-bottom text-sm">
              <thead className="sticky top-[72px] z-10 bg-background [&_tr]:border-b">
                <tr className="border-b transition-colors bg-background hover:bg-background">
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[180px] bg-background">Created At</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[140px] bg-background">Event Name</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[200px] bg-background">ID</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[200px] bg-background">Contact</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[150px] bg-background">Owner</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[50px] bg-background"></th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {events.map((event) => (
                  <EventRow 
                    key={event.id} 
                    event={event} 
                    expandedRowId={expandedRowId}
                    onToggleExpand={handleToggleExpand}
                  />
                ))}
              </tbody>
            </table>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
};
