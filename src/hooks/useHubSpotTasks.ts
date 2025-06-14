
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Task } from '@/types/task';

export const useHubSpotTasks = (selectedOwnerId?: string) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching tasks from HubSpot for owner:', selectedOwnerId || 'all');
      
      const { data, error: functionError } = await supabase.functions.invoke('fetch-hubspot-tasks', {
        body: { ownerId: selectedOwnerId }
      });
      
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
    fetchTasks();
    
    // Set up polling every 30 seconds
    const interval = setInterval(fetchTasks, 30000);
    
    return () => clearInterval(interval);
  }, [selectedOwnerId]);

  return {
    tasks,
    loading,
    error,
    refetch: fetchTasks
  };
};
