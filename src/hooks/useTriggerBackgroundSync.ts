
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useTriggerBackgroundSync = () => {
  const [syncing, setSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<any>(null);

  const triggerSync = async () => {
    if (syncing) return;
    
    try {
      setSyncing(true);
      console.log('Triggering background sync...');
      
      const { data, error } = await supabase.functions.invoke('background-task-sync', {
        body: {}
      });
      
      if (error) {
        console.error('Background sync error:', error);
        throw error;
      }
      
      console.log('Background sync completed:', data);
      setLastSyncResult(data);
      
      return data;
    } catch (error) {
      console.error('Failed to trigger background sync:', error);
      throw error;
    } finally {
      setSyncing(false);
    }
  };

  return {
    triggerSync,
    syncing,
    lastSyncResult
  };
};
