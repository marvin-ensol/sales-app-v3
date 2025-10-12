import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Task, TaskQueue } from '@/types/task';

interface UseEnhancedLocalTasksOptions {
  selectedOwnerId: string;
  enableRealtime?: boolean;
  selectiveUpdates?: boolean;
}

export const useEnhancedLocalTasks = ({ 
  selectedOwnerId, 
  enableRealtime = true,
  selectiveUpdates = true 
}: UseEnhancedLocalTasksOptions) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const channelRef = useRef<any>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTasks = async (ownerId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 [ENHANCED] Fetching tasks from database for owner:', ownerId);
      
      const { data, error: functionError } = await supabase.rpc('get_owner_tasks', {
        owner_id_param: ownerId
      });
      
      if (functionError) {
        console.error('❌ [ENHANCED] Database function error:', functionError);
        throw new Error(`Database query failed: ${functionError.message}`);
      }
      
      console.log('✅ [ENHANCED] Tasks fetched successfully from database:', data?.length || 0);
      
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
        hsTimestamp: task.hs_timestamp ? new Date(task.hs_timestamp) : null,
        numberInSequence: task.number_in_sequence ? Number(task.number_in_sequence) : null,
        createdByAutomationId: task.created_by_automation_id || null
      }));
      
      setTasks(transformedTasks);
      setLastSyncTime(new Date());
      
    } catch (err) {
      console.error('❌ [ENHANCED] Error fetching tasks from database:', err);
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

  // Debounced update function for performance
  const debouncedRefetch = (delay = 1000) => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    updateTimeoutRef.current = setTimeout(() => {
      if (selectedOwnerId) {
        console.log('🔄 [ENHANCED] Debounced refetch triggered');
        fetchTasks(selectedOwnerId);
      }
    }, delay);
  };

  // Selective update logic based on change type
  const handleRealtimeChange = (payload: any) => {
    const { eventType, new: newRecord, old: oldRecord, table } = payload;
    
    console.log('🔔 [ENHANCED] Real-time change detected:', {
      eventType,
      table,
      recordId: newRecord?.hs_object_id || oldRecord?.hs_object_id
    });

    if (!selectiveUpdates) {
      // Simple refetch for all changes
      debouncedRefetch();
      return;
    }

    // Selective updates based on relevance
    const isRelevantToOwner = (record: any) => {
      return record?.hubspot_owner_id === selectedOwnerId || 
             !record?.hubspot_owner_id; // Unassigned tasks
    };

    switch (eventType) {
      case 'INSERT':
        if (table === 'hs_tasks' && isRelevantToOwner(newRecord)) {
          console.log('📝 [ENHANCED] Relevant task inserted, refetching...');
          debouncedRefetch(500); // Faster update for inserts
        }
        break;
        
      case 'UPDATE':
        if (table === 'hs_tasks') {
          // Check if task was deleted (soft delete)
          if (newRecord?.hs_task_status === 'DELETED') {
            console.log('🗑️ [ENHANCED] Task soft-deleted, optimistically removing:', newRecord.hs_object_id);
            // Optimistically remove from state immediately
            setTasks(prev => prev.filter(t => t.hubspotId !== newRecord.hs_object_id));
            // Trigger immediate refetch for consistency
            debouncedRefetch(0);
            return;
          }

          const wasRelevant = isRelevantToOwner(oldRecord);
          const isRelevant = isRelevantToOwner(newRecord);
          
          if (wasRelevant || isRelevant) {
            console.log('✏️ [ENHANCED] Relevant task updated, refetching...');
            debouncedRefetch(500);
          }
        }
        break;
        
      case 'DELETE':
        if (table === 'hs_tasks' && isRelevantToOwner(oldRecord)) {
          console.log('🗑️ [ENHANCED] Relevant task deleted, refetching...');
          debouncedRefetch(500);
        }
        break;
        
      default:
        // For contact updates or other changes, use normal debounce
        debouncedRefetch();
    }
  };

  // Enhanced real-time subscription setup
  useEffect(() => {
    if (selectedOwnerId && enableRealtime) {
      console.log('🔗 [ENHANCED] Setting up enhanced real-time subscription for owner:', selectedOwnerId);
      
      // Initial fetch
      fetchTasks(selectedOwnerId);
      
      // Set up enhanced real-time subscription
      channelRef.current = supabase
        .channel(`enhanced_tasks_${selectedOwnerId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'hs_tasks'
          },
          (payload) => handleRealtimeChange({ ...payload, table: 'hs_tasks' })
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'hs_contacts'
          },
          (payload) => handleRealtimeChange({ ...payload, table: 'hs_contacts' })
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'hs_users'
          },
          (payload) => handleRealtimeChange({ ...payload, table: 'hs_users' })
        )
        .subscribe((status) => {
          console.log('🔔 [ENHANCED] Real-time subscription status:', status);
        });
      
      return () => {
        if (channelRef.current) {
          console.log('🔌 [ENHANCED] Cleaning up enhanced real-time subscription');
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
        
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
          updateTimeoutRef.current = null;
        }
      };
    } else {
      console.log('📭 [ENHANCED] No owner selected or realtime disabled, clearing tasks');
      setTasks([]);
      setLoading(false);
      setError(null);
      setLastSyncTime(null);
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    }
  }, [selectedOwnerId, enableRealtime, selectiveUpdates]);

  const refetch = () => {
    if (selectedOwnerId) {
      fetchTasks(selectedOwnerId);
    }
  };

  // Force refresh with conflict resolution
  const forceRefresh = async () => {
    console.log('🔄 [ENHANCED] Force refresh triggered');
    if (selectedOwnerId) {
      await fetchTasks(selectedOwnerId);
    }
  };

  // Check if data is stale
  const isStale = () => {
    if (!lastSyncTime) return true;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return lastSyncTime < fiveMinutesAgo;
  };

  return {
    tasks,
    loading,
    error,
    refetch,
    forceRefresh,
    lastSyncTime,
    isStale: isStale(),
    isRealtimeEnabled: enableRealtime && !!channelRef.current
  };
};