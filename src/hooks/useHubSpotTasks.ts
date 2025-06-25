
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Task } from '@/types/task';

export const useHubSpotTasks = (selectedOwnerId: string) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isVisibleRef = useRef(true);

  // Track page visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;
      console.log('Page visibility changed:', isVisibleRef.current ? 'visible' : 'hidden');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const fetchTasks = async (ownerId: string, retryCount = 0, forceFullSync = false) => {
    if (!isVisibleRef.current) {
      console.log('Skipping API call - app not visible');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log(`Fetching tasks from HubSpot for owner: ${ownerId} (${forceFullSync ? 'full sync' : 'incremental sync'})`);
      
      if (retryCount > 0) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        console.log(`Retrying after ${delay}ms delay (attempt ${retryCount + 1})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      const { data, error: functionError } = await supabase.functions.invoke('fetch-hubspot-tasks', {
        body: { 
          ownerId,
          forceFullSync
        }
      });
      
      console.log('Raw response:', { data, functionError });
      
      if (functionError) {
        console.error('Supabase function error:', functionError);
        throw new Error(`Function call failed: ${functionError.message}`);
      }
      
      if (data?.error) {
        console.error('HubSpot API error:', data.error);
        
        if (data.error.includes('429') || data.error.includes('rate limit')) {
          if (retryCount < 3) {
            console.log(`Rate limited, retrying in ${Math.pow(2, retryCount + 1)} seconds...`);
            return fetchTasks(ownerId, retryCount + 1, forceFullSync);
          }
        }
        
        throw new Error(`HubSpot API error: ${data.error}`);
      }
      
      if (!data?.success) {
        console.error('Function returned unsuccessful response:', data);
        throw new Error('Failed to fetch tasks from HubSpot');
      }
      
      console.log(`Tasks received successfully: ${data?.tasks?.length || 0} (source: ${data?.source || 'unknown'})`);
      if (data?.sync_type) {
        console.log(`Sync type: ${data.sync_type}`);
      }
      
      setTasks(data?.tasks || []);
      
    } catch (err) {
      console.error('Error fetching HubSpot tasks:', err);
      let errorMessage = 'Failed to fetch tasks';
      
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  // Set up realtime subscriptions for instant updates
  useEffect(() => {
    if (!selectedOwnerId) return;

    console.log('Setting up realtime subscription for tasks...');
    
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all changes (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'tasks'
        },
        (payload) => {
          console.log('Realtime task update:', payload);
          
          // Refetch tasks when database changes
          if (isVisibleRef.current) {
            fetchTasks(selectedOwnerId);
          }
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [selectedOwnerId]);

  useEffect(() => {
    if (selectedOwnerId) {
      console.log('Owner ID changed, fetching tasks for:', selectedOwnerId);
      fetchTasks(selectedOwnerId);
      
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      // Set up polling every 2 minutes (reduced frequency since we have caching)
      intervalRef.current = setInterval(() => {
        if (isVisibleRef.current) {
          // Use incremental sync for background updates
          fetchTasks(selectedOwnerId, 0, false);
        } else {
          console.log('Skipping scheduled fetch - app not visible');
        }
      }, 120000); // 2 minutes
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    } else {
      console.log('No owner selected, clearing tasks');
      setTasks([]);
      setLoading(false);
      setError(null);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
  }, [selectedOwnerId]);

  const refetch = (forceFullSync = false) => {
    if (selectedOwnerId && isVisibleRef.current) {
      fetchTasks(selectedOwnerId, 0, forceFullSync);
    }
  };

  return {
    tasks,
    loading,
    error,
    refetch
  };
};
