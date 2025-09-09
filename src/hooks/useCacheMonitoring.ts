import { supabase } from "@/integrations/supabase/client";

export interface SyncMetadata {
  owner_id: string;
  last_sync_timestamp: string;
  incremental_sync_timestamp: string;
  full_sync_timestamp: string;
  last_sync_success: boolean;
  sync_type: string;
  sync_duration: number;
  tasks_added: number;
  tasks_updated: number;
  tasks_deleted: number;
  error_message?: string;
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
  const fetchSyncMetadata = async (): Promise<SyncMetadata[]> => {
    const { data, error } = await supabase
      .from('sync_metadata')
      .select('*')
      .order('last_sync_timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching sync metadata:', error);
      throw error;
    }

    return data || [];
  };

  const triggerIncrementalSync = async (ownerId?: string): Promise<any> => {
    const { data, error } = await supabase.functions.invoke('incremental-sync-hubspot-tasks', {
      body: { ownerId }
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
      const globalMetadata = metadata.find(m => m.owner_id === 'global');
      
      if (!globalMetadata) {
        return { isRunning: false };
      }

      return {
        isRunning: false, // We'd need to check if any sync is currently running
        lastSync: new Date(globalMetadata.last_sync_timestamp),
        lastSyncType: globalMetadata.sync_type as 'full' | 'incremental',
        lastSyncSuccess: globalMetadata.last_sync_success,
        tasksProcessed: globalMetadata.tasks_added + globalMetadata.tasks_updated,
        errors: globalMetadata.error_message ? [globalMetadata.error_message] : []
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