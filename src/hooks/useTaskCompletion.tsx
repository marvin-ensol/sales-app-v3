import React, { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

export const useTaskCompletion = () => {
  const [isCompleting, setIsCompleting] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const toastRef = useRef<{ dismiss: () => void } | null>(null);

  const completeTask = async (
    hubspotId: string,
    contactName: string,
    taskTitle: string,
    onSuccess?: () => void,
    onOptimisticUpdate?: () => void
  ) => {
    if (isCompleting === hubspotId) return;
    
    setIsCompleting(hubspotId);
    
    // Immediately apply optimistic update
    if (onOptimisticUpdate) {
      onOptimisticUpdate();
    }

    let actionExecuted = false;

    // Create undo action for toast
    const undoAction = () => {
      // Cancel the completion
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      if (!actionExecuted) {
        // Revert optimistic update by forcing a refetch
        if (onSuccess) {
          onSuccess();
        }
        setIsCompleting(null);
        
        toast({
          title: "Annulation",
          description: "La tâche n'a pas été marquée comme terminée",
        });
      }
    };

    // Show confirmation toast with undo option
    const toastResult = toast({
      title: "Tâche terminée",
      description: `${contactName} - ${taskTitle}`,
      duration: 6000,
      action: (
        <ToastAction altText="Annuler" onClick={undoAction}>
          Annuler
        </ToastAction>
      ),
    });

    toastRef.current = toastResult;

    // Execute the actual completion after 6 seconds
    timeoutRef.current = setTimeout(async () => {
      actionExecuted = true;
      
      try {
        console.log('Completing task with HubSpot ID:', hubspotId);
        
        const { data, error } = await supabase.functions.invoke('complete-hubspot-task', {
          body: { 
            taskId: hubspotId
          }
        });
        
        if (error) {
          console.error('Error completing task:', error);
          toast({
            title: "Erreur",
            description: "Erreur. La tâche n'a pas pu être marquée comme terminée.",
            variant: "destructive",
          });
          
          // Revert optimistic update on error
          if (onSuccess) {
            onSuccess();
          }
          return;
        }
        
        if (data?.error) {
          console.error('API error:', data.error);
          toast({
            title: "Erreur",
            description: "Erreur. La tâche n'a pas pu être marquée comme terminée.",
            variant: "destructive",
          });
          
          // Revert optimistic update on error
          if (onSuccess) {
            onSuccess();
          }
          return;
        }
        
        // Success
        console.log('Task completed successfully');
        
        if (onSuccess) {
          onSuccess();
        }
        
      } catch (err) {
        console.error('Error completing task:', err);
        toast({
          title: "Erreur",
          description: "Erreur. La tâche n'a pas pu être marquée comme terminée.",
          variant: "destructive",
        });
        
        // Revert optimistic update on error
        if (onSuccess) {
          onSuccess();
        }
      } finally {
        setIsCompleting(null);
        timeoutRef.current = null;
        toastRef.current = null;
      }
    }, 6000);

    // Return undo function for external use
    return undoAction;
  };

  // Cleanup function
  const cleanup = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (toastRef.current) {
      toastRef.current.dismiss();
      toastRef.current = null;
    }
    setIsCompleting(null);
  };

  return {
    isCompleting,
    completeTask,
    cleanup
  };
};