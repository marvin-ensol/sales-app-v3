import { EnrichedEvent } from "@/types/event";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, ChevronDown } from "lucide-react";
import { EventRowExpanded } from "./EventRowExpanded";
import { useState } from "react";

interface EventRowProps {
  event: EnrichedEvent;
}

export const EventRow = ({ event }: EventRowProps) => {
  const [isOpen, setIsOpen] = useState(false);

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

  return (
    <>
      <TableRow 
        onClick={() => setIsOpen(!isOpen)} 
        className="cursor-pointer hover:bg-muted/50 transition-colors"
      >
        <TableCell className="w-[160px] font-mono text-xs">{formatDate(event.created_at)}</TableCell>
        <TableCell className="w-[150px]">
          <Badge variant="outline">{getEventName(event.event)}</Badge>
        </TableCell>
        <TableCell className="truncate">{getContactDisplay()}</TableCell>
        <TableCell className="truncate">{getOwnerDisplay()}</TableCell>
        <TableCell className="w-[120px]">
          <div className="flex items-center gap-2">
            {event.error_count > 0 ? (
              <>
                <AlertCircle className="h-4 w-4 text-destructive" />
                <Badge variant="destructive" className="text-xs">{event.error_count}</Badge>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-xs text-muted-foreground">Success</span>
              </>
            )}
          </div>
        </TableCell>
        <TableCell className="w-8">
          <ChevronDown
            className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
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
