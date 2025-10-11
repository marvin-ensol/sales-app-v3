import { useRealtimeQuery } from './useRealtimeQuery';
import { supabase } from '@/integrations/supabase/client';
import { Task, TaskQueue, TaskStatus } from '@/types/task';

const transformTasks = (data: any[]): Task[] => {
  return (data || []).map((task, index) => {
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
      status: task.status as TaskStatus,
      dueDate: task.due_date,
      priority: task.priority as 'high' | 'medium' | 'low',
      owner: task.owner,
      hubspotId: task.hubspot_id,
      queue: task.queue as TaskQueue,
      queueIds: task.queue_ids || [],
      isUnassigned: task.is_unassigned,
      completionDate: task.completion_date ? new Date(task.completion_date) : null,
      hsTimestamp: task.hs_timestamp ? new Date(task.hs_timestamp) : null,
      numberInSequence: task.number_in_sequence ? Number(task.number_in_sequence) : null,
      createdByAutomationId: task.created_by_automation_id || null,
      hubspotOwnerId: task.hubspot_owner_id || null
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
};

export const useAllTasks = () => {
  const queryFn = async () => {
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
    
    const transformedTasks = transformTasks(data || []);
    
    console.log('🎯 Final transformation summary:');
    const tasksWithTimestamp = transformedTasks.filter(t => t.hsTimestamp);
    const tasksWithoutTimestamp = transformedTasks.filter(t => !t.hsTimestamp);
    console.log(`Tasks with hsTimestamp: ${tasksWithTimestamp.length}, without: ${tasksWithoutTimestamp.length}`);
    
    return transformedTasks;
  };

  const {
    data: tasks,
    isLoading: loading,
    error,
    refetch,
    forceRefresh,
    health,
    isStale,
    lastSyncTime,
  } = useRealtimeQuery<Task[]>({
    queryKey: ['all-tasks'],
    queryFn,
    subscriptions: [
      { schema: 'public', table: 'hs_tasks', event: '*' },
      { schema: 'public', table: 'hs_contacts', event: '*' },
    ],
    enabled: true,
    debounceMs: 500, // Slightly higher debounce for all tasks to handle larger datasets
    refetchOnReconnect: true,
    selectiveUpdates: false,
  });

  return {
    tasks: tasks || [],
    loading,
    error,
    refetch,
    forceRefresh,
    health,
    isStale,
    lastSyncTime,
  };
};