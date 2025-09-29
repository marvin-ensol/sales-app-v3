import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const useTaskSkipping = () => {
  const [isSkipping, setIsSkipping] = useState(false);

  const skipTask = async (
    hubspotId: string,
    taskId: string,
    taskTitle: string,
    onSuccess?: () => void
  ) => {
    if (isSkipping) return;
    
    setIsSkipping(true);
    
    try {
      console.log('Skipping task with HubSpot ID:', hubspotId);
      
      const { data, error } = await supabase.functions.invoke('skip-hubspot-task', {
        body: { 
          hubspot_id: hubspotId,
          task_id: taskId,
          task_title: taskTitle
        }
      });
      
      if (error) {
        console.error('Error skipping task:', error);
        toast({
          title: "Erreur",
          description: "Erreur. La tâche n'a pas pu être sautée.",
          variant: "destructive",
        });
        return;
      }
      
      if (data?.error) {
        console.error('API error:', data.error);
        toast({
          title: "Erreur",
          description: "Erreur. La tâche n'a pas pu être sautée.",
          variant: "destructive",
        });
        return;
      }
      
      // Success - task skipped
      console.log('Task skipped successfully');
      
      if (onSuccess) {
        onSuccess();
      }
      
    } catch (err) {
      console.error('Error skipping task:', err);
      toast({
        title: "Erreur",
        description: "Erreur. La tâche n'a pas pu être sautée.",
        variant: "destructive",
      });
    } finally {
      setIsSkipping(false);
    }
  };

  return {
    isSkipping,
    skipTask
  };
};