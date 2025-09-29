import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useTaskCompletion = () => {
  const [isCompleting, setIsCompleting] = useState(false);
  const [optimisticallyCompleted, setOptimisticallyCompleted] = useState<Set<string>>(new Set());

  const completeTask = async (hubspotId: string, taskId: string, onComplete?: () => void) => {
    try {
      setIsCompleting(true);
      
      // Optimistic update - immediately mark as completed
      setOptimisticallyCompleted(prev => new Set([...prev, taskId]));
      
      console.log('Completing task:', { hubspotId, taskId });
      
      // Call edge function to update HubSpot
      const { data, error } = await supabase.functions.invoke('complete-hubspot-task', {
        body: {
          hubspot_id: hubspotId,
          task_id: taskId
        }
      });

      if (error) {
        console.error('Error completing task:', error);
        // Rollback optimistic update on error
        setOptimisticallyCompleted(prev => {
          const updated = new Set(prev);
          updated.delete(taskId);
          return updated;
        });
        throw error;
      }

      console.log('Task completed successfully:', data);
      
      // Call success callback
      if (onComplete) {
        onComplete();
      }
      
      // Trigger background refresh of team statistics via useTeamSummary refetch
      // This will be handled by the parent component that calls this hook

      // The real-time subscription will handle the actual UI update
      // Keep optimistic state until then
      setTimeout(() => {
        setOptimisticallyCompleted(prev => {
          const updated = new Set(prev);
          updated.delete(taskId);
          return updated;
        });
      }, 2000); // Clean up optimistic state after 2 seconds

    } catch (error) {
      console.error('Failed to complete task:', error);
      throw error;
    } finally {
      setIsCompleting(false);
    }
  };

  const isTaskOptimisticallyCompleted = (taskId: string) => {
    return optimisticallyCompleted.has(taskId);
  };

  return {
    completeTask,
    isCompleting,
    isTaskOptimisticallyCompleted
  };
};
