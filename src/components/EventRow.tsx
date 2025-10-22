import { EnrichedEvent } from "@/types/event";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Phone } from "lucide-react";
import { EventRowExpanded } from "./EventRowExpanded";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface EventRowProps {
  event: EnrichedEvent;
  expandedRowId: number | null;
  onToggleExpand: (id: number) => void;
}

export const EventRow = ({ event, expandedRowId, onToggleExpand }: EventRowProps) => {
  const isOpen = expandedRowId === event.id;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  const getEventName = (eventType: string) => {
    const eventNames: Record<string, string> = {
      'call_created': 'Call Created',
    };
    return eventNames[eventType] || eventType;
  };

  const getEventColor = (eventType: string) => {
    const eventColors: Record<string, string> = {
      'call_created': 'bg-blue-500 text-white hover:bg-blue-600',
    };
    return eventColors[eventType] || 'bg-gray-500 text-white hover:bg-gray-600';
  };

  const getContactDisplay = () => {
    if (event.contact_firstname || event.contact_lastname) {
      return `${event.contact_firstname || ''} ${event.contact_lastname || ''}`.trim();
    }
    return event.hs_contact_id || 'Unknown';
  };

  const getOwnerDisplay = () => {
    if (event.owner_firstname && event.owner_lastname) {
      return `${event.owner_firstname} ${event.owner_lastname.charAt(0)}.`;
    }
    return event.hs_owner_id || 'Unknown';
  };

  const hasExpandableContent = () => {
    return (event.logs.task_updates?.eligible_tasks.length ?? 0) > 0 || event.error_count > 0;
  };

  return (
    <>
      <TableRow 
        onClick={hasExpandableContent() ? () => onToggleExpand(event.id) : undefined}
        className={`transition-colors ${hasExpandableContent() ? 'cursor-pointer hover:bg-muted/70' : ''} ${isOpen ? 'bg-muted/90' : ''}`}
      >
        <TableCell className="w-[180px]">{formatDate(event.created_at)}</TableCell>
        <TableCell className="w-[140px]">
          <Badge className={getEventColor(event.event)}>{getEventName(event.event)}</Badge>
        </TableCell>
        <TableCell className="w-[200px]">
          {event.logs.call_details?.call_id && event.hubspot_url ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={event.hubspot_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm hover:underline text-primary"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Phone className="h-3.5 w-3.5" />
                  <span>{event.logs.call_details.call_id}</span>
                </a>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs space-y-1">
                  <div>Direction: {event.logs.call_details.hs_call_direction}</div>
                  <div>Duration: {(event.logs.call_details.hs_call_duration / 1000).toFixed(1)}s</div>
                </div>
              </TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          )}
        </TableCell>
        <TableCell className="w-[200px] truncate">{getContactDisplay()}</TableCell>
        <TableCell className="w-[150px] truncate">{getOwnerDisplay()}</TableCell>
        <TableCell className="w-[50px]">
          {hasExpandableContent() && (
            <ChevronDown
              className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          )}
        </TableCell>
      </TableRow>
      {isOpen && (
        <TableRow>
          <TableCell colSpan={6} className="p-0">
            <EventRowExpanded event={event} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
};
