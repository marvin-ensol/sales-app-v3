import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Task, TaskQueue, TaskStatus } from '@/types/task';
import { useRealtimeManager } from './useRealtimeManager';

export const useConsolidatedLocalTasks = (selectedOwnerId: string) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  
  const realtimeManager = useRealtimeManager();

  const fetchTasks = useCallback(async (ownerId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 [CONSOLIDATED] Fetching tasks from database for owner:', ownerId);
      
      const { data, error: functionError } = await supabase.rpc('get_owner_tasks', {
        owner_id_param: ownerId
      });
      
      if (functionError) {
        console.error('❌ [CONSOLIDATED] Database function error:', functionError);
        throw new Error(`Database query failed: ${functionError.message}`);
      }
      
      console.log('✅ [CONSOLIDATED] Tasks fetched successfully from database:', data?.length || 0);
      
      // Transform database result to match Task interface
      const transformedTasks: Task[] = (data || []).map(task => ({
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
        hubspotOwnerId: (task as any).hubspot_owner_id || null
      }));
      
      setTasks(transformedTasks);
      setLastSyncTime(new Date());
      
    } catch (err) {
      console.error('❌ [CONSOLIDATED] Error fetching tasks from database:', err);
      let errorMessage = 'Failed to fetch tasks from database';
      
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Set up real-time subscription
  useEffect(() => {
    if (!selectedOwnerId) {
      console.log('📭 [CONSOLIDATED] No owner selected, clearing tasks');
      setTasks([]);
      setLoading(false);
      setError(null);
      setLastSyncTime(null);
      return;
    }

    console.log('🔗 [CONSOLIDATED] Setting up consolidated real-time subscription for owner:', selectedOwnerId);
    
    // Initial fetch
    fetchTasks(selectedOwnerId);
    
    // Register with the real-time manager
    const unsubscribe = realtimeManager.subscribe(
      `tasks_${selectedOwnerId}`,
      () => fetchTasks(selectedOwnerId),
      ['hs_tasks', 'hs_contacts', 'hs_users']
    );

    return unsubscribe;
  }, [selectedOwnerId, fetchTasks, realtimeManager]);

  const refetch = useCallback(() => {
    if (selectedOwnerId) {
      fetchTasks(selectedOwnerId);
    }
  }, [selectedOwnerId, fetchTasks]);

  // Check if data is stale
  const isStale = useCallback(() => {
    if (!lastSyncTime) return true;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return lastSyncTime < fiveMinutesAgo;
  }, [lastSyncTime]);

  return {
    tasks,
    loading,
    error,
    refetch,
    lastSyncTime,
    isStale: isStale(),
    isRealtimeConnected: realtimeManager.isConnected,
    isRealtimeUpdating: realtimeManager.isUpdating
  };
};