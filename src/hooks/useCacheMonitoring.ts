import { supabase } from "@/integrations/supabase/client";

export interface SyncMetadata {
  id: string;
  sync_type: 'full' | 'incremental';
  last_sync_timestamp: string;
  last_sync_success: boolean;
  sync_duration: number;
  tasks_added: number;
  tasks_updated: number;
  tasks_deleted: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface SyncStatus {
  isRunning: boolean;
  lastSync?: Date;
  lastSyncType?: 'full' | 'incremental';
  lastSyncSuccess?: boolean;
  tasksProcessed?: number;
  errors?: string[];
}

export const useCacheMonitoring = () => {
  const fetchSyncMetadata = async (): Promise<SyncMetadata | null> => {
    // Get latest sync execution (completed or failed) for metadata
    const { data, error } = await supabase
      .from('sync_executions')
      .select('*')
      .in('status', ['completed', 'failed'])
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching sync metadata from executions:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    // Transform sync_execution data to match SyncMetadata interface
    return {
      id: data.execution_id,
      sync_type: data.sync_type,
      last_sync_timestamp: data.completed_at || data.started_at,
      last_sync_success: data.status === 'completed',
      sync_duration: data.duration_ms ? Math.floor(data.duration_ms / 1000) : 0,
      tasks_added: data.tasks_created || 0,
      tasks_updated: data.tasks_updated || 0,
      tasks_deleted: 0, // Not tracked separately
      error_message: data.error_message,
      created_at: data.created_at,
      updated_at: data.updated_at
    } as SyncMetadata;
  };

  const triggerIncrementalSync = async (): Promise<any> => {
    const { data, error } = await supabase.functions.invoke('incremental-sync-hubspot-tasks', {
      body: {}
    });

    if (error) {
      console.error('Error triggering incremental sync:', error);
      throw error;
    }

    return data;
  };

  const triggerFullSync = async (): Promise<any> => {
    const { data, error } = await supabase.functions.invoke('sync-hubspot-tasks');

    if (error) {
      console.error('Error triggering full sync:', error);
      throw error;
    }

    return data;
  };

  const getSyncStatus = async (): Promise<SyncStatus> => {
    try {
      const metadata = await fetchSyncMetadata();
      
      if (!metadata) {
        return { isRunning: false };
      }

      // Check for currently running syncs
      const { data: runningSync } = await supabase
        .from('sync_executions')
        .select('id')
        .eq('status', 'running')
        .limit(1)
        .maybeSingle();

      return {
        isRunning: !!runningSync,
        lastSync: new Date(metadata.last_sync_timestamp),
        lastSyncType: metadata.sync_type,
        lastSyncSuccess: metadata.last_sync_success,
        tasksProcessed: metadata.tasks_added + metadata.tasks_updated,
        errors: metadata.error_message ? [metadata.error_message] : []
      };
    } catch (error) {
      console.error('Error getting sync status:', error);
      return { isRunning: false, errors: [error.message] };
    }
  };

  return {
    fetchSyncMetadata,
    triggerIncrementalSync,
    triggerFullSync,
    getSyncStatus
  };
};