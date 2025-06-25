
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const useTaskAssignment = () => {
  const [isAssigning, setIsAssigning] = useState(false);

  const assignTask = async (
    taskId: string,
    hubspotId: string,
    contactId: string,
    selectedOwnerId: string,
    onSuccess?: () => void
  ) => {
    if (isAssigning) return;
    
    if (!selectedOwnerId) {
      toast({
        title: "Erreur",
        description: "Aucun propriétaire sélectionné",
        variant: "destructive",
      });
      return;
    }
    
    setIsAssigning(true);
    
    try {
      console.log('Assigning unassigned task:', taskId, 'to owner:', selectedOwnerId);
      
      const { data, error } = await supabase.functions.invoke('assign-task', {
        body: { 
          taskId: hubspotId,
          contactId: contactId,
          ownerId: selectedOwnerId
        }
      });
      
      if (error) {
        console.error('Error assigning task:', error);
        toast({
          title: "Erreur",
          description: "Une erreur s'est produite lors de l'attribution de la tâche",
          variant: "destructive",
        });
        return;
      }
      
      if (data?.error) {
        console.error('API error:', data.error);
        if (data.error.includes('already assigned')) {
          toast({
            title: "Lead déjà attribué",
            description: "Le lead a déjà été attribué",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Erreur",
            description: data.error,
            variant: "destructive",
          });
        }
        return;
      }
      
      if (data?.success) {
        console.log('Task assigned successfully');
        toast({
          title: "Succès",
          description: "La tâche a été attribuée avec succès",
        });
        
        if (onSuccess) {
          onSuccess();
        }
      }
      
    } catch (err) {
      console.error('Error assigning task:', err);
      toast({
        title: "Erreur",
        description: "Une erreur s'est produite lors de l'attribution de la tâche",
        variant: "destructive",
      });
    } finally {
      setIsAssigning(false);
    }
  };

  return {
    isAssigning,
    assignTask
  };
};
