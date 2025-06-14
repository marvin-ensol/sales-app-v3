
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface HubSpotOwner {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  fullName: string;
}

export const useHubSpotOwners = () => {
  const [owners, setOwners] = useState<HubSpotOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOwners = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('=== FETCHING OWNERS FROM HUBSPOT ===');
      console.log('Calling fetch-hubspot-owners edge function...');
      
      const { data, error: functionError } = await supabase.functions.invoke('fetch-hubspot-owners', {
        body: { forceRefresh: true } // Add a parameter to ensure fresh fetch
      });
      
      console.log('Edge function response:', { data, functionError });
      
      if (functionError) {
        console.error('Supabase function error:', functionError);
        throw new Error(`Function call failed: ${functionError.message}`);
      }
      
      if (data?.error) {
        console.error('HubSpot API error:', data.error);
        throw new Error(`HubSpot API error: ${data.error}`);
      }
      
      if (!data?.success) {
        console.error('Function returned unsuccessful response:', data);
        throw new Error('Failed to fetch owners from HubSpot');
      }
      
      console.log('=== OWNERS FETCH COMPLETE ===');
      console.log('Final filtered owners received:', data?.owners?.length || 0);
      console.log('Owner names:', data?.owners?.map((o: HubSpotOwner) => o.fullName) || []);
      
      setOwners(data?.owners || []);
      
    } catch (err) {
      console.error('Error fetching HubSpot owners:', err);
      let errorMessage = 'Failed to fetch owners';
      
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setOwners([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('=== useHubSpotOwners HOOK INITIALIZED ===');
    fetchOwners();
    
    // Set up polling every 6 hours (6 * 60 * 60 * 1000 ms = 21,600,000 ms)
    const interval = setInterval(fetchOwners, 6 * 60 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  return {
    owners,
    loading,
    error,
    refetch: fetchOwners
  };
};
