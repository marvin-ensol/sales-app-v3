import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EventRow } from "./EventRow";
import { EnrichedEvent } from "@/types/event";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";

interface EventsTableProps {
  events: EnrichedEvent[];
  isLoading: boolean;
}

export const EventsTable = ({ events, isLoading }: EventsTableProps) => {
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
    <div className="border rounded-lg">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[160px]">Created At</TableHead>
            <TableHead className="w-[150px]">Event Name</TableHead>
            <TableHead className="w-[140px]">ID</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead className="w-8"></TableHead>
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
    </div>
  );
};
