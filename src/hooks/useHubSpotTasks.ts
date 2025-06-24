
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Task } from '@/types/task';

interface UseHubSpotTasksOptions {
  debugTaskId?: string;
}

export const useHubSpotTasks = (selectedOwnerId: string | undefined, options?: UseHubSpotTasksOptions) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = async (ownerId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching tasks from HubSpot for owner:', ownerId);
      if (options?.debugTaskId) {
        console.log('🔍 Debug mode enabled for task ID:', options.debugTaskId);
      }
      
      const { data, error: functionError } = await supabase.functions.invoke('fetch-hubspot-tasks', {
        body: { 
          ownerId,
          ...(options?.debugTaskId && { debugTaskId: options.debugTaskId })
        }
      });
      
      console.log('Raw response:', { data, functionError });
      
      if (functionError) {
        console.error('Supabase function error:', functionError);
        throw new Error(`Function call failed: ${functionError.message}`);
      }
      
      if (data?.error) {
        console.error('HubSpot API error:', data.error);
        throw new Error(`HubSpot API error: ${data.error}`);
      }
      
      if (!data?.success) {
        console.error('Function returned unsuccessful response:', data);
        throw new Error('Failed to fetch tasks from HubSpot');
      }
      
      console.log('Tasks received successfully:', data?.tasks?.length || 0);
      if (options?.debugTaskId) {
        const debugTask = data?.tasks?.find((task: Task) => task.id === options.debugTaskId);
        if (debugTask) {
          console.log('🔍 Debug task found in response:', debugTask);
        } else {
          console.log('🔍 Debug task NOT found in final response');
        }
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

  useEffect(() => {
    if (selectedOwnerId) {
      console.log('Owner ID changed, fetching tasks for:', selectedOwnerId);
      fetchTasks(selectedOwnerId);
      
      // Set up polling every 30 seconds
      const interval = setInterval(() => fetchTasks(selectedOwnerId), 30000);
      
      return () => clearInterval(interval);
    } else {
      console.log('No owner selected, clearing tasks');
      setTasks([]);
      setLoading(false);
      setError(null);
    }
  }, [selectedOwnerId, options?.debugTaskId]);

  const refetch = () => {
    if (selectedOwnerId) {
      fetchTasks(selectedOwnerId);
    }
  };

  return {
    tasks,
    loading,
    error,
    refetch
  };
};
