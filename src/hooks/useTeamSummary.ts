import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TasksByStatus {
  status: string;
  task_queues: Record<string, number>;
  total: number;
}

export interface OwnerSummary {
  owner_id: string;
  tasks: TasksByStatus[];
  total_tasks: number;
  overdue_count: number;
  completed_today_count: number;
}

export interface TaskSummaryData {
  task_summary: {
    owners: OwnerSummary[];
    grand_totals: {
      by_status: Record<string, number>;
      by_task_queue: Record<string, number>;
      total_all_tasks: number;
    };
  };
  owner_header_summary?: {
    completed_today_count: number;
    overdue_count: number;
    future_tasks_count: number;
  };
  category_counts?: {
    overdue_by_category: Record<string, number>;
    completed_by_category: Record<string, number>;
  };
}

interface UseTeamSummaryProps {
  teamId: string;
  ownerId?: string;
}

export const useTeamSummary = ({ teamId, ownerId }: UseTeamSummaryProps) => {
  const [data, setData] = useState<TaskSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeamSummary = async () => {
    if (!teamId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log(`🔍 Fetching team summary for team: ${teamId}, owner: ${ownerId || 'all'}`);

      const { data: result, error: functionError } = await supabase.functions.invoke('team-task-summary', {
        body: {
          team_id: teamId,
          owner_id: ownerId
        }
      });

      if (functionError) {
        throw new Error(`Function error: ${functionError.message}`);
      }

      if (!result) {
        throw new Error('No data returned from function');
      }

      console.log(`✅ Team summary fetched:`, {
        owners_count: result.task_summary?.owners?.length || 0,
        total_tasks: result.task_summary?.grand_totals?.total_all_tasks || 0,
        owner_header_summary: result.owner_header_summary
      });

      setData(result);
    } catch (err) {
      console.error('Error fetching team summary:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch team summary');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamSummary();
  }, [teamId, ownerId]);

  // Set up real-time subscription to automatically refresh when tasks change
  useEffect(() => {
    if (!teamId) return;

    const channelName = `team-${teamId}-${ownerId || 'all'}-tasks`;
    console.log(`🔄 Setting up real-time subscription for ${channelName}`);
    
    try {
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'hs_tasks',
            filter: `hubspot_team_id=eq.${teamId}`,
          },
          (payload) => {
            console.log('🔄 Task changed, refreshing team summary:', payload.eventType);
            // Refetch team summary when tasks change
            fetchTeamSummary();
          }
        )
        .subscribe();

      return () => {
        console.log(`🔄 Cleaning up real-time subscription for ${channelName}`);
        supabase.removeChannel(channel);
      };
    } catch (error) {
      console.error(`Failed to set up real-time subscription for ${channelName}:`, error);
    }
  }, [teamId, ownerId]);

  return {
    data,
    loading,
    error,
  };
};