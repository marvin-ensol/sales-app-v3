
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
      
      console.log('Fetching owners from HubSpot...');
      
      const { data, error: functionError } = await supabase.functions.invoke('fetch-hubspot-owners');
      
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
      
      console.log('Owners received successfully:', data?.owners?.length || 0);
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
    fetchOwners();
  }, []);

  return {
    owners,
    loading,
    error,
    refetch: fetchOwners
  };
};
