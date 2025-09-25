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
      
      // Debug: Log raw database response
      console.log('🔍 Raw database response sample (first 3 tasks):');
      if (data && data.length > 0) {
        data.slice(0, 3).forEach((task, index) => {
          console.log(`Task ${index + 1}:`, {
            id: task.id,
            title: task.title,
            hs_timestamp: task.hs_timestamp,
            hs_timestamp_type: typeof task.hs_timestamp,
            hs_timestamp_value: task.hs_timestamp ? new Date(task.hs_timestamp).toISOString() : 'null'
          });
        });
      }
      
      // Transform database result to match Task interface
      const transformedTasks: Task[] = (data || []).map((task, index) => {
        // Debug transformation for first 3 tasks
        if (index < 3) {
          console.log(`🔄 Transforming task ${index + 1}:`, {
            raw_hs_timestamp: task.hs_timestamp,
            raw_hs_timestamp_exists: 'hs_timestamp' in task,
            raw_hs_timestamp_type: typeof task.hs_timestamp,
            will_transform_to: task.hs_timestamp ? new Date(task.hs_timestamp) : null
          });
        }
        
        const transformedTask = {
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
        };
        
        // Debug final transformation for first 3 tasks
        if (index < 3) {
          console.log(`✅ Transformed task ${index + 1}:`, {
            title: transformedTask.title,
            hsTimestamp: transformedTask.hsTimestamp,
            hsTimestamp_type: typeof transformedTask.hsTimestamp,
            hsTimestamp_iso: transformedTask.hsTimestamp ? transformedTask.hsTimestamp.toISOString() : 'null'
          });
        }
        
        return transformedTask;
      });
      
      console.log('🎯 Final transformation summary:');
      const tasksWithTimestamp = transformedTasks.filter(t => t.hsTimestamp);
      const tasksWithoutTimestamp = transformedTasks.filter(t => !t.hsTimestamp);
      console.log(`Tasks with hsTimestamp: ${tasksWithTimestamp.length}, without: ${tasksWithoutTimestamp.length}`);
      
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