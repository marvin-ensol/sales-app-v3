import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EnrichedEvent, PaginatedEventsResponse } from "@/types/event";

interface UseEventsOptions {
  eventFilter?: string;
  contactFilter?: string;
  eventIds?: number[];
  contactIds?: string[];
  updateStatusFilter?: string;
  sortOrder: 'ASC' | 'DESC';
  page?: number;
  pageSize?: number;
}

export const useEvents = (options: UseEventsOptions) => {
  const { 
    eventFilter, 
    contactFilter,
    eventIds,
    contactIds,
    updateStatusFilter,
    sortOrder = 'DESC', 
    page = 1,
    pageSize = 25 
  } = options;

  return useQuery({
    queryKey: ['events', eventFilter, contactFilter, eventIds, contactIds, updateStatusFilter, sortOrder, page, pageSize],
    queryFn: async (): Promise<PaginatedEventsResponse> => {
      const offset = (page - 1) * pageSize;
      
      const { data, error } = await supabase.rpc('get_enriched_events', {
        event_filter: eventFilter || null,
        contact_filter: contactFilter || null,
        event_ids: eventIds && eventIds.length > 0 ? eventIds : null,
        contact_ids: contactIds && contactIds.length > 0 ? contactIds : null,
        update_status_filter: updateStatusFilter || null,
        sort_order: sortOrder,
        limit_count: pageSize,
        offset_count: offset
      });

      if (error) throw error;
      
      const events = data as EnrichedEvent[];
      const totalCount = events.length > 0 ? events[0].total_count || 0 : 0;
      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        events,
        totalCount,
        totalPages,
        currentPage: page,
        pageSize
      };
    },
    staleTime: 30000, // 30 seconds
  });
};
