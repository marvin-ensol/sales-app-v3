
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Task } from '@/types/task';

export const useHubSpotTasks = (selectedOwnerId: string) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const fetchTasks = async (ownerId: string, forceFullSync = false) => {
    if (!isVisibleRef.current && !forceFullSync) {
      console.log('Skipping API call - app not visible');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log(`Fetching tasks from cache for owner: ${ownerId} ${forceFullSync ? '(force refresh)' : ''}`);
      
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
        console.error('API error:', data.error);
        throw new Error(`API error: ${data.error}`);
      }
      
      if (!data?.success) {
        console.error('Function returned unsuccessful response:', data);
        throw new Error('Failed to fetch tasks');
      }
      
      console.log(`Tasks received successfully: ${data?.tasks?.length || 0} (source: ${data?.source || 'unknown'})`);
      
      setTasks(data?.tasks || []);
      
    } catch (err) {
      console.error('Error fetching tasks:', err);
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

  // Set up realtime subscriptions for instant updates from background sync
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
          
          // Refetch tasks when database changes (from background sync)
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

  // Initial fetch when owner changes (no more periodic polling)
  useEffect(() => {
    if (selectedOwnerId) {
      console.log('Owner ID changed, fetching tasks for:', selectedOwnerId);
      fetchTasks(selectedOwnerId);
    } else {
      console.log('No owner selected, clearing tasks');
      setTasks([]);
      setLoading(false);
      setError(null);
    }
  }, [selectedOwnerId]);

  const refetch = (forceFullSync = false) => {
    if (selectedOwnerId && isVisibleRef.current) {
      fetchTasks(selectedOwnerId, forceFullSync);
    }
  };

  return {
    tasks,
    loading,
    error,
    refetch
  };
};
