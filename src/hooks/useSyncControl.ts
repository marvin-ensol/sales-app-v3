import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SyncControl {
  id: string;
  is_paused: boolean;
  custom_sync_timestamp?: string;
  paused_by?: string;
  paused_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export const useSyncControl = () => {
  const [syncControl, setSyncControl] = useState<SyncControl | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchSyncControl = async () => {
    try {
      const { data, error } = await supabase
        .from('sync_control')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setSyncControl(data || null);
    } catch (error) {
      console.error('Error fetching sync control:', error);
      toast({
        title: "Error",
        description: "Failed to fetch sync control status",
        variant: "destructive",
      });
    }
  };

  const togglePause = async (isPaused: boolean, notes?: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('toggle-sync-pause', {
        body: { 
          isPaused, 
          pausedBy: 'user',
          notes 
        }
      });

      if (error) throw error;

      await fetchSyncControl();
      
      toast({
        title: "Success",
        description: `Sync ${isPaused ? 'paused' : 'resumed'} successfully`,
      });

      return { success: true };
    } catch (error) {
      console.error('Error toggling sync pause:', error);
      toast({
        title: "Error", 
        description: `Failed to ${isPaused ? 'pause' : 'resume'} sync`,
        variant: "destructive",
      });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const setCustomTimestamp = async (timestamp: string, notes?: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('set-custom-sync-timestamp', {
        body: { 
          timestamp,
          notes 
        }
      });

      if (error) throw error;

      await fetchSyncControl();
      
      toast({
        title: "Success",
        description: "Custom sync timestamp set successfully",
      });

      return { success: true };
    } catch (error) {
      console.error('Error setting custom timestamp:', error);
      toast({
        title: "Error",
        description: "Failed to set custom sync timestamp",
        variant: "destructive",
      });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const clearCustomTimestamp = async () => {
    return await setCustomTimestamp(null);
  };

  useEffect(() => {
    fetchSyncControl();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('sync_control')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sync_control'
        },
        () => {
          fetchSyncControl();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    syncControl,
    loading,
    togglePause,
    setCustomTimestamp,
    clearCustomTimestamp,
    refreshSyncControl: fetchSyncControl
  };
};