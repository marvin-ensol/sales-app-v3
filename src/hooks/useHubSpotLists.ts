import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface HubSpotList {
  listId: string;
  name: string;
  updatedAt: string;
  objectTypeId: string;
  processingType: string;
  additionalProperties?: {
    hs_list_size?: string;
    hs_list_reference_count?: string;
  };
}

interface UseHubSpotListsReturn {
  lists: HubSpotList[];
  loading: boolean;
  error: string | null;
  refetch: (forceRefresh?: boolean) => Promise<void>;
  searchLists: (query: string) => HubSpotList[];
  needsRefresh: () => boolean;
}

export const useHubSpotLists = (): UseHubSpotListsReturn => {
  const [lists, setLists] = useState<HubSpotList[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLists = async (forceRefresh: boolean = false) => {
    try {
      setLoading(true);
      setError(null);

      // First, try to get cached lists from database
      const { data: cachedData, error: fetchError } = await supabase
        .from('lists')
        .select('*')
        .eq('type', 'contacts')
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw new Error(`Database error: ${fetchError.message}`);
      }

      // Check if we have cached data and if it's recent (less than 1 hour old)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const shouldRefetch = forceRefresh || !cachedData || new Date(cachedData.last_updated_at) < oneHourAgo;

      if (shouldRefetch) {
        console.log('🔄 Fetching fresh lists from HubSpot...');
        // Fetch fresh data from HubSpot
        const { data: functionData, error: functionError } = await supabase.functions.invoke('fetch-hubspot-lists');

        if (functionError) {
          throw new Error(`Function error: ${functionError.message}`);
        }

        if (!functionData.success) {
          throw new Error(functionData.error || 'Failed to fetch lists');
        }

        setLists(functionData.lists);
      } else {
        console.log('📋 Using cached lists from database');
        setLists((cachedData.data as unknown) as HubSpotList[]);
      }
    } catch (err) {
      console.error('Error fetching HubSpot lists:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const searchLists = (query: string): HubSpotList[] => {
    if (!query.trim()) {
      return lists;
    }
    
    return lists.filter(list => 
      list.name.toLowerCase().includes(query.toLowerCase())
    );
  };

  const needsRefresh = (): boolean => {
    return lists.length === 0;
  };

  return {
    lists,
    loading,
    error,
    refetch: fetchLists,
    searchLists,
    needsRefresh
  };
};