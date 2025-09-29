import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeManager } from './useRealtimeManager';
import { TaskSummaryData } from './useTeamSummary';

interface UseConsolidatedTeamSummaryProps {
  teamId: string;
  ownerId?: string;
}

export const useConsolidatedTeamSummary = ({ teamId, ownerId }: UseConsolidatedTeamSummaryProps) => {
  const [data, setData] = useState<TaskSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  
  const realtimeManager = useRealtimeManager();

  const fetchTeamSummary = useCallback(async () => {
    if (!teamId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log(`🔍 [CONSOLIDATED] Fetching team summary for team: ${teamId}, owner: ${ownerId || 'all'}`);

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

      console.log(`✅ [CONSOLIDATED] Team summary fetched:`, {
        owners_count: result.task_summary?.owners?.length || 0,
        total_tasks: result.task_summary?.grand_totals?.total_all_tasks || 0,
        owner_header_summary: result.owner_header_summary
      });

      setData(result);
      setLastSyncTime(new Date());
    } catch (err) {
      console.error('❌ [CONSOLIDATED] Error fetching team summary:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch team summary');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [teamId, ownerId]);

  // Set up real-time subscription
  useEffect(() => {
    if (!teamId) return;

    console.log(`🔗 [CONSOLIDATED] Setting up team summary real-time subscription for team: ${teamId}`);
    
    // Initial fetch
    fetchTeamSummary();
    
    // Register with the real-time manager with team filter
    const unsubscribe = realtimeManager.subscribe(
      `team_summary_${teamId}_${ownerId || 'all'}`,
      fetchTeamSummary,
      ['hs_tasks'],
      { hubspot_team_id: teamId }
    );

    return unsubscribe;
  }, [teamId, ownerId, fetchTeamSummary, realtimeManager]);

  const refetch = useCallback(() => {
    fetchTeamSummary();
  }, [fetchTeamSummary]);

  // Check if data is stale
  const isStale = useCallback(() => {
    if (!lastSyncTime) return true;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return lastSyncTime < fiveMinutesAgo;
  }, [lastSyncTime]);

  return {
    data,
    loading,
    error,
    refetch,
    lastSyncTime,
    isStale: isStale(),
    isRealtimeConnected: realtimeManager.isConnected,
    isRealtimeUpdating: realtimeManager.isUpdating
  };
};