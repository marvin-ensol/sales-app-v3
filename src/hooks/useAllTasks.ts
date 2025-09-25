import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Task, TaskQueue } from '@/types/task';

export const useAllTasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<any>(null);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching all tasks from database');
      
      const { data, error: functionError } = await supabase.rpc('get_all_tasks');
      
      if (functionError) {
        console.error('Database function error:', functionError);
        throw new Error(`Database query failed: ${functionError.message}`);
      }
      
      console.log('All tasks fetched successfully from database:', data?.length || 0);
      
      // Transform database result to match Task interface
      const transformedTasks: Task[] = (data || []).map(task => ({
        id: task.id,
        title: task.title || 'Untitled Task',
        description: task.description,
        contact: task.contact,
        contactId: task.contact_id,
        contactPhone: task.contact_phone,
        status: task.status as 'not_started' | 'completed',
        dueDate: task.due_date,
        priority: task.priority as 'high' | 'medium' | 'low',
        owner: task.owner,
        hubspotId: task.hubspot_id,
        queue: task.queue as TaskQueue,
        queueIds: task.queue_ids || [],
        isUnassigned: task.is_unassigned,
        completionDate: task.completion_date ? new Date(task.completion_date) : null,
        hsTimestamp: task.hs_timestamp ? new Date(task.hs_timestamp) : null
      }));
      
      setTasks(transformedTasks);
      
    } catch (err) {
      console.error('Error fetching all tasks from database:', err);
      let errorMessage = 'Failed to fetch tasks from database';
      
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  // Set up real-time subscription for task updates
  useEffect(() => {
    console.log('Setting up real-time subscription for all tasks');
    
    // Initial fetch
    fetchTasks();
    
    // Set up real-time subscription
    channelRef.current = supabase
      .channel('all_tasks_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hs_tasks'
        },
        (payload) => {
          console.log('Real-time task change detected:', payload);
          // Refetch all tasks when any task changes
          fetchTasks();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hs_contacts'
        },
        (payload) => {
          console.log('Real-time contact change detected:', payload);
          // Refetch all tasks when contact data changes
          fetchTasks();
        }
      )
      .subscribe();
    
    return () => {
      if (channelRef.current) {
        console.log('Cleaning up real-time subscription for all tasks');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  const refetch = () => {
    fetchTasks();
  };

  return {
    tasks,
    loading,
    error,
    refetch
  };
};