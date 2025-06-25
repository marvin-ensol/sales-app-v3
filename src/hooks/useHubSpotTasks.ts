
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Task } from '@/types/task';

export const useHubSpotTasks = (selectedOwnerId: string) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isVisibleRef = useRef(true);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

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

  // Debounced fetch function to prevent realtime update storms
  const debouncedFetch = (ownerId: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      if (isVisibleRef.current) {
        fetchTasks(ownerId);
      }
    }, 500); // 500ms debounce
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
          
          // Use debounced fetch to prevent storms
          debouncedFetch(selectedOwnerId);
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up realtime subscription');
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
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

  // ENHANCED debug function to trigger FORCE FULL SYNC
  const debugTotalCounts = async () => {
    try {
      console.log('=== DEBUG: Investigating total task counts ===');
      
      // First check what's in our database
      const { data: dbTasks, error: dbError } = await supabase
        .from('tasks')
        .select('*');
      
      if (dbError) {
        console.error('Error fetching from database:', dbError);
      } else {
        console.log(`Total tasks in database: ${dbTasks?.length || 0}`);
        
        // Break down by status
        const notStarted = dbTasks?.filter(t => t.status === 'not_started') || [];
        const completed = dbTasks?.filter(t => t.status === 'completed') || [];
        
        console.log(`Not started tasks: ${notStarted.length}`);
        console.log(`Completed tasks: ${completed.length}`);
        
        // Break down by queue
        const queueBreakdown = dbTasks?.reduce((acc, task) => {
          acc[task.queue] = (acc[task.queue] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {};
        
        console.log('Queue breakdown:', queueBreakdown);
        
        // Break down by owner for not_started tasks
        const ownerBreakdown = notStarted.reduce((acc, task) => {
          const owner = task.owner || 'unassigned';
          acc[owner] = (acc[owner] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        console.log('Not started tasks by owner:', ownerBreakdown);
        
        // Check for tasks with contacts
        const tasksWithContacts = dbTasks?.filter(t => t.contact_id) || [];
        const tasksWithoutContacts = dbTasks?.filter(t => !t.contact_id) || [];
        
        console.log(`Tasks with contacts: ${tasksWithContacts.length}`);
        console.log(`Tasks without contacts: ${tasksWithoutContacts.length}`);
      }
      
      // Now trigger a FORCE FULL SYNC to see what HubSpot returns
      console.log('🚀 Triggering FORCE FULL SYNC to investigate...');
      const { data, error } = await supabase.functions.invoke('background-task-sync', {
        body: { forceRefresh: true, debug: true }
      });
      
      if (error) {
        console.error('Background sync error:', error);
      } else {
        console.log('🎯 FORCE FULL SYNC response:', data);
      }
      
    } catch (err) {
      console.error('Debug investigation failed:', err);
    }
  };

  return {
    tasks,
    loading,
    error,
    refetch,
    debugTotalCounts
  };
};
