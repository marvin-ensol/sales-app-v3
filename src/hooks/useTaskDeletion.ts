import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const useTaskDeletion = () => {
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteTask = async (
    hubspotId: string,
    onSuccess?: () => void
  ) => {
    if (isDeleting) return;
    
    setIsDeleting(true);
    
    try {
      console.log('Deleting task with HubSpot ID:', hubspotId);
      
      const { data, error } = await supabase.functions.invoke('delete-hubspot-task', {
        body: { 
          taskId: hubspotId
        }
      });
      
      if (error) {
        console.error('Error deleting task:', error);
        toast({
          title: "Erreur",
          description: "Erreur. La tâche n'a pas pu être supprimée.",
          variant: "destructive",
        });
        return;
      }
      
      if (data?.error) {
        console.error('API error:', data.error);
        toast({
          title: "Erreur",
          description: "Erreur. La tâche n'a pas pu être supprimée.",
          variant: "destructive",
        });
        return;
      }
      
      // Success - either deleted from HubSpot or marked as deleted locally
      console.log('Task deleted successfully');
      toast({
        title: "Succès",
        description: "Succès. La tâche a bien été supprimée",
      });
      
      if (onSuccess) {
        onSuccess();
      }
      
    } catch (err) {
      console.error('Error deleting task:', err);
      toast({
        title: "Erreur",
        description: "Erreur. La tâche n'a pas pu être supprimée.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    isDeleting,
    deleteTask
  };
};