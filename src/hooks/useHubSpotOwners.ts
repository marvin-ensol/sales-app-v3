
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface HubSpotOwner {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  fullName: string;
  teamId: string | null;
  teamName: string | null;
}

export const useHubSpotOwners = () => {
  const [owners, setOwners] = useState<HubSpotOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOwners = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('=== FRONTEND OWNER FETCH START ===');
      console.log('Timestamp:', new Date().toISOString());
      console.log('About to call fetch-hubspot-owners edge function...');
      
      // Force a completely fresh fetch with timestamp
      const timestamp = Date.now();
      const { data, error: functionError } = await supabase.functions.invoke('fetch-hubspot-owners', {
        body: { 
          forceRefresh: true,
          timestamp: timestamp,
          debug: true
        }
      });
      
      console.log('=== EDGE FUNCTION RESPONSE ===');
      console.log('Function Error:', functionError);
      console.log('Response Data:', data);
      
      if (functionError) {
        console.error('Supabase function error:', functionError);
        throw new Error(`Function call failed: ${functionError.message}`);
      }
      
      if (data?.error) {
        console.error('HubSpot API error from edge function:', data.error);
        throw new Error(`HubSpot API error: ${data.error}`);
      }
      
      if (!data?.success) {
        console.error('Edge function returned unsuccessful response:', data);
        throw new Error('Failed to fetch owners from HubSpot');
      }
      
      console.log('=== FRONTEND PROCESSING OWNERS ===');
      console.log('Total owners received:', data?.owners?.length || 0);
      console.log('All owner names received:', data?.owners?.map((o: HubSpotOwner) => `${o.id}: ${o.fullName} (${o.email})`) || []);
      
      // Check specifically for Adrien
      const adrienInList = data?.owners?.find((o: HubSpotOwner) => 
        o.fullName.toLowerCase().includes('adrien') || 
        o.email.toLowerCase().includes('adrien')
      );
      
      console.log('=== ADRIEN HOLVOET CHECK IN FRONTEND ===');
      console.log('Adrien found in final filtered list:', !!adrienInList);
      if (adrienInList) {
        console.log('Adrien details:', adrienInList);
        console.error('❌ PROBLEM: Adrien Holvoet is still in the filtered list!');
      } else {
        console.log('✅ GOOD: Adrien Holvoet is NOT in the filtered list');
      }
      
      console.log('Setting owners state with:', data?.owners?.length, 'owners');
      setOwners(data?.owners || []);
      
    } catch (err) {
      console.error('=== FRONTEND ERROR ===');
      console.error('Error fetching HubSpot owners:', err);
      let errorMessage = 'Failed to fetch owners';
      
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setOwners([]);
    } finally {
      setLoading(false);
      console.log('=== FRONTEND FETCH COMPLETE ===');
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
