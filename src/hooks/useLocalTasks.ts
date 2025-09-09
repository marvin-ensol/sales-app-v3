import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Task } from '@/types/task';

export const useLocalTasks = (selectedOwnerId: string) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<any>(null);

  const fetchTasks = async (ownerId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching tasks from database for owner:', ownerId);
      
      const { data, error: queryError } = await supabase.rpc('get_owner_tasks', {
        owner_id_param: ownerId
      });
      
      if (queryError) {
        console.error('Database query error:', queryError);
        throw new Error(`Database query failed: ${queryError.message}`);
      }
      
      // Transform database result to match Task interface
      const transformedTasks: Task[] = (data || []).map((row: any) => ({
        id: row.id,
        title: row.title || 'Untitled Task',
        description: row.description,
        contact: row.contact,
        contactId: row.contact_id,
        contactPhone: row.contact_phone,
        status: row.status,
        dueDate: row.due_date,
        priority: row.priority,
        owner: row.owner,
        hubspotId: row.hubspot_id,
        queue: row.queue,
        queueIds: row.queue_ids || [],
        isUnassigned: row.is_unassigned,
        completionDate: row.completion_date
      }));
      
      console.log('Tasks fetched successfully from database:', transformedTasks.length);
      setTasks(transformedTasks);
      
    } catch (err) {
      console.error('Error fetching tasks from database:', err);
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

  // Set up real-time subscription to tasks table
  useEffect(() => {
    if (selectedOwnerId) {
      console.log('Setting up real-time subscription for owner:', selectedOwnerId);
      
      // Initial fetch
      fetchTasks(selectedOwnerId);
      
      // Set up real-time subscription
      channelRef.current = supabase
        .channel('tasks-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'hs_tasks'
          },
          (payload) => {
            console.log('Real-time update received:', payload);
            // Refetch tasks when any task changes
            fetchTasks(selectedOwnerId);
          }
        )
        .subscribe();
      
      return () => {
        if (channelRef.current) {
          console.log('Cleaning up real-time subscription');
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
      };
    } else {
      console.log('No owner selected, clearing tasks');
      setTasks([]);
      setLoading(false);
      setError(null);
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    }
  }, [selectedOwnerId]);

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