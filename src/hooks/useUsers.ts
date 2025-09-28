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
  profilePictureUrl: string | null;
}

export const useUsers = () => {
  const [owners, setOwners] = useState<HubSpotOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: queryError } = await supabase
        .from('hs_users')
        .select('owner_id, first_name, last_name, full_name, email, team_id, team_name, profile_picture_url')
        .eq('archived', false)
        .order('full_name');

      if (queryError) {
        throw queryError;
      }

      // Transform data to match HubSpotOwner interface
      const transformedOwners: HubSpotOwner[] = (data || []).map(user => ({
        id: user.owner_id,
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        email: user.email || '',
        fullName: user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        teamId: user.team_id || null,
        teamName: user.team_name || null,
        profilePictureUrl: user.profile_picture_url || null
      }));

      setOwners(transformedOwners);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
      setOwners([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return {
    owners,
    loading,
    error,
    refetch: fetchUsers
  };
};