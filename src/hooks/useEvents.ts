import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EnrichedEvent } from "@/types/event";

interface UseEventsOptions {
  eventFilter?: string;
  contactFilter?: string;
  sortOrder: 'ASC' | 'DESC';
  limit?: number;
}

export const useEvents = (options: UseEventsOptions) => {
  const { eventFilter, contactFilter, sortOrder = 'DESC', limit = 100 } = options;

  return useQuery({
    queryKey: ['events', eventFilter, contactFilter, sortOrder, limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_enriched_events', {
        event_filter: eventFilter || null,
        contact_filter: contactFilter || null,
        sort_order: sortOrder,
        limit_count: limit
      });

      if (error) throw error;
      return data as EnrichedEvent[];
    },
    staleTime: 30000, // 30 seconds
  });
};
