import { useRealtimeQuery } from './useRealtimeQuery';
import { Task, TaskQueue, TaskStatus } from '@/types/task';
import { supabase } from '@/integrations/supabase/client';

const transformTasks = (data: any[]): Task[] => {
  return (data || []).map(task => ({
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
    createdByAutomationId: task.created_by_automation_id || null
  }));
};

export const useLocalTasks = (selectedOwnerId: string) => {
  const queryFn = async () => {
    if (!selectedOwnerId) {
      return [];
    }

    console.log('Fetching tasks from database for owner:', selectedOwnerId);
    
    const { data, error: functionError } = await supabase.rpc('get_owner_tasks', {
      owner_id_param: selectedOwnerId
    });
    
    if (functionError) {
      console.error('Database function error:', functionError);
      throw new Error(`Database query failed: ${functionError.message}`);
    }
    
    console.log('Tasks fetched successfully from database:', data?.length || 0);
    return transformTasks(data || []);
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
    queryKey: ['owner-tasks', selectedOwnerId],
    queryFn,
    subscriptions: [
      { schema: 'public', table: 'hs_tasks', event: '*' },
      { schema: 'public', table: 'hs_contacts', event: '*' },
    ],
    enabled: !!selectedOwnerId,
    debounceMs: 300,
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