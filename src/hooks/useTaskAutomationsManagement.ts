import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TaskAutomation {
  id: string;
  task_category_id: number;
  name: string;
  hs_list_id: string | null;
  hs_list_object: string;
  automation_enabled: boolean;
  sequence_enabled: boolean | null;
  sequence_exit_enabled: boolean | null;
  first_task_creation: boolean | null;
  auto_complete_on_exit_enabled: boolean;
  schedule_enabled: boolean;
  schedule_configuration: any;
  tasks_configuration: any;
  created_at: string;
  updated_at: string;
  task_categories?: {
    id: number;
    label: string;
    color: string;
    hs_queue_id: string;
  };
}

export interface AutomationFormData {
  name: string;
  task_category_id: number;
  hs_list_id?: string;
  hs_list_object: string;
  automation_enabled: boolean;
  sequence_enabled?: boolean;
  sequence_exit_enabled?: boolean;
  first_task_creation?: boolean;
  auto_complete_on_exit_enabled: boolean;
  schedule_enabled: boolean;
  schedule_configuration?: any;
  tasks_configuration?: any;
}

export const useTaskAutomationsManagement = () => {
  const [automations, setAutomations] = useState<TaskAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Normalize automation data to ensure consistent structure
  const normalizeAutomation = (automation: any): TaskAutomation => {
    const normalized = {
      ...automation,
      tasks_configuration: automation.tasks_configuration || { tasks: [] },
      schedule_configuration: automation.schedule_configuration || { delay: 1, unit: 'hours' },
      sequence_enabled: automation.sequence_enabled || false,
      sequence_exit_enabled: automation.sequence_exit_enabled || false,
      first_task_creation: automation.first_task_creation || false,
      auto_complete_on_exit_enabled: automation.auto_complete_on_exit_enabled || false,
      schedule_enabled: automation.schedule_enabled || false
    };
    
    // Additional safety check for tasks_configuration
    if (!normalized.tasks_configuration || typeof normalized.tasks_configuration !== 'object') {
      normalized.tasks_configuration = { tasks: [] };
    }
    if (!Array.isArray(normalized.tasks_configuration.tasks)) {
      normalized.tasks_configuration.tasks = [];
    }
    
    console.log('Normalized automation:', automation.id, normalized);
    return normalized;
  };

  const fetchAutomations = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching automations...');
      
      const { data, error: fetchError } = await supabase
        .from('task_automations')
        .select(`
          *,
          task_categories (
            id,
            label,
            color,
            hs_queue_id
          )
        `)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching automations:', fetchError);
        setError(fetchError.message);
        toast.error('Failed to fetch automations');
        return;
      }

      console.log('Raw automations data:', data);
      
      // Normalize each automation
      const normalizedAutomations = (data || []).map(normalizeAutomation);
      console.log('Normalized automations:', normalizedAutomations);
      
      setAutomations(normalizedAutomations);
    } catch (err) {
      console.error('Unexpected error fetching automations:', err);
      setError('An unexpected error occurred');
      toast.error('Failed to fetch automations');
    } finally {
      setLoading(false);
    }
  };

  const createAutomation = async (automationData: AutomationFormData) => {
    try {
      // Ensure proper default structure for new automations
      const normalizedData = {
        ...automationData,
        tasks_configuration: automationData.tasks_configuration || { tasks: [] },
        schedule_configuration: automationData.schedule_configuration || { delay: 1, unit: 'hours' }
      };
      
      console.log('Creating automation with data:', normalizedData);
      
      const { data, error: createError } = await supabase
        .from('task_automations')
        .insert([normalizedData])
        .select(`
          *,
          task_categories (
            id,
            label,
            color,
            hs_queue_id
          )
        `)
        .single();

      if (createError) {
        console.error('Error creating automation:', createError);
        toast.error('Failed to create automation');
        throw createError;
      }

      const normalizedAutomation = normalizeAutomation(data);
      setAutomations(prev => [normalizedAutomation, ...prev]);
      toast.success('Automation created successfully');
      return normalizedAutomation;
    } catch (err) {
      console.error('Error creating automation:', err);
      throw err;
    }
  };

  const updateAutomation = async (id: string, automationData: Partial<AutomationFormData>) => {
    try {
      console.log('Updating automation:', id, 'with data:', automationData);
      
      const { data, error: updateError } = await supabase
        .from('task_automations')
        .update(automationData)
        .eq('id', id)
        .select(`
          *,
          task_categories (
            id,
            label,
            color,
            hs_queue_id
          )
        `)
        .single();

      if (updateError) {
        console.error('Error updating automation:', updateError);
        toast.error('Failed to update automation');
        throw updateError;
      }

      const normalizedAutomation = normalizeAutomation(data);
      setAutomations(prev => 
        prev.map(automation => 
          automation.id === id ? normalizedAutomation : automation
        )
      );
      toast.success('Automation updated successfully');
      return normalizedAutomation;
    } catch (err) {
      console.error('Error updating automation:', err);
      throw err;
    }
  };

  const deleteAutomation = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('task_automations')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('Error deleting automation:', deleteError);
        toast.error('Failed to delete automation');
        throw deleteError;
      }

      setAutomations(prev => prev.filter(automation => automation.id !== id));
      toast.success('Automation deleted successfully');
    } catch (err) {
      console.error('Error deleting automation:', err);
      throw err;
    }
  };

  const toggleAutomationEnabled = async (id: string, enabled: boolean) => {
    try {
      await updateAutomation(id, { automation_enabled: enabled });
    } catch (err) {
      console.error('Error toggling automation enabled:', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchAutomations();
  }, []);

  return {
    automations,
    loading,
    error,
    fetchAutomations,
    createAutomation,
    updateAutomation,
    deleteAutomation,
    toggleAutomationEnabled,
  };
};