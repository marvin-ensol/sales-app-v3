import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Team {
  id: string;
  name: string;
}

export const NO_TEAM_ID = 'NO_TEAM';

export const useTeams = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: queryError } = await supabase
        .from('hs_users')
        .select('team_id, team_name')
        .not('team_id', 'is', null)
        .not('team_name', 'is', null)
        .eq('archived', false);

      if (queryError) {
        throw queryError;
      }

      // Get unique teams
      const uniqueTeams = (data || [])
        .reduce((acc: Team[], user) => {
          const existingTeam = acc.find(team => team.id === user.team_id);
          if (!existingTeam && user.team_id && user.team_name) {
            acc.push({
              id: user.team_id,
              name: user.team_name
            });
          }
          return acc;
        }, [])
        .sort((a, b) => a.name.localeCompare(b.name));

      // Add "Sans équipe" option at the end
      uniqueTeams.push({
        id: NO_TEAM_ID,
        name: 'Sans équipe'
      });

      setTeams(uniqueTeams);
    } catch (err) {
      console.error('Error fetching teams:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch teams');
      setTeams([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  return {
    teams,
    loading,
    error,
    refetch: fetchTeams
  };
};