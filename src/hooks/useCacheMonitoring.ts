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
    const { data, error } = await supabase
      .from('sync_metadata')
      .select('*')
      .single();

    if (error) {
      console.error('Error fetching sync metadata:', error);
      return null;
    }

    return data as SyncMetadata;
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

      return {
        isRunning: false, // We'd need to check if any sync is currently running
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