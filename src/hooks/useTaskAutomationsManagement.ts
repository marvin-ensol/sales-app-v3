import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TaskAutomation {
  id: string;
  task_category_id: number;
  name: string;
  hs_list_id?: string;
  hs_list_object?: string;
  automation_enabled: boolean;
  sequence_enabled?: boolean;
  sequence_exit_enabled?: boolean;
  first_task_creation?: boolean;
  auto_complete_on_exit_enabled?: boolean;
  auto_complete_on_engagement?: boolean;
  schedule_enabled?: boolean;
  schedule_configuration?: any;
  tasks_configuration?: any;
  total_tasks?: number;
  created_at?: string;
  updated_at?: string;
  task_categories?: {
    id: number;
    label: string;
    color: string;
    hs_queue_id: string;
  };
}

export interface AutomationFormData {
  task_category_id: number;
  name: string;
  hs_list_id?: string;
  hs_list_object?: string;
  automation_enabled?: boolean;
  sequence_enabled?: boolean;
  sequence_exit_enabled?: boolean;
  first_task_creation?: boolean;
  auto_complete_on_exit_enabled?: boolean;
  auto_complete_on_engagement?: boolean;
  schedule_enabled?: boolean;
  schedule_configuration?: any;
  tasks_configuration?: any;
  total_tasks?: number;
}

export const useTaskAutomationsManagement = () => {
  const [automations, setAutomations] = useState<TaskAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAutomations = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: automationData, error: queryError } = await supabase
        .from('task_automations')
        .select('*')
        .order('created_at');

      if (queryError) {
        console.error('Database query error:', queryError);
        throw queryError;
      }

      // Fetch categories separately to avoid relationship issues
      const { data: categoryData } = await supabase
        .from('task_categories')
        .select('id, label, color, hs_queue_id');

      const categoryMap = new Map();
      categoryData?.forEach(cat => categoryMap.set(cat.id, cat));

      // Combine the data
      const data = automationData?.map(automation => ({
        ...automation,
        task_categories: categoryMap.get(automation.task_category_id)
      }));

      setAutomations(data || []);
    } catch (err) {
      console.error('Error fetching task automations:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch task automations');
    } finally {
      setLoading(false);
    }
  };

  const getAutomationsByCategory = (categoryId: number): TaskAutomation[] => {
    return automations.filter(automation => automation.task_category_id === categoryId);
  };

  const createAutomation = async (automationData: AutomationFormData) => {
    try {
      const { data, error: insertError } = await supabase
        .from('task_automations')
        .insert({
          task_category_id: automationData.task_category_id,
          name: automationData.name,
          hs_list_id: automationData.hs_list_id || null,
          hs_list_object: automationData.hs_list_object || 'contacts',
          automation_enabled: automationData.automation_enabled ?? false,
          sequence_enabled: automationData.sequence_enabled ?? null,
          sequence_exit_enabled: automationData.sequence_exit_enabled ?? null,
          first_task_creation: automationData.first_task_creation ?? null,
          auto_complete_on_exit_enabled: automationData.auto_complete_on_exit_enabled ?? null,
          schedule_enabled: automationData.schedule_enabled ?? null,
          schedule_configuration: automationData.schedule_configuration ?? null,
          tasks_configuration: automationData.tasks_configuration ?? null
        })
        .select('*')
        .single();

      if (insertError) {
        console.error('Database insert error:', insertError);
        throw insertError;
      }

      // Refresh automations list
      await fetchAutomations();
      
      return data;
    } catch (err) {
      console.error('Error creating task automation:', err);
      throw err;
    }
  };

  const updateAutomation = async (id: string, automationData: Partial<AutomationFormData>) => {
    try {
      // Build the update payload
      const updatePayload: any = {};
      
      if (automationData.name !== undefined) updatePayload.name = automationData.name;
      if (automationData.hs_list_id !== undefined) updatePayload.hs_list_id = automationData.hs_list_id || null;
      if (automationData.hs_list_object !== undefined) updatePayload.hs_list_object = automationData.hs_list_object;
      if (automationData.automation_enabled !== undefined) updatePayload.automation_enabled = automationData.automation_enabled;
      if (automationData.sequence_enabled !== undefined) updatePayload.sequence_enabled = automationData.sequence_enabled;
      if (automationData.sequence_exit_enabled !== undefined) updatePayload.sequence_exit_enabled = automationData.sequence_exit_enabled;
      if (automationData.first_task_creation !== undefined) updatePayload.first_task_creation = automationData.first_task_creation;
      if (automationData.auto_complete_on_exit_enabled !== undefined) updatePayload.auto_complete_on_exit_enabled = automationData.auto_complete_on_exit_enabled;
      if (automationData.schedule_enabled !== undefined) updatePayload.schedule_enabled = automationData.schedule_enabled;
      if (automationData.schedule_configuration !== undefined) updatePayload.schedule_configuration = automationData.schedule_configuration;
      if (automationData.tasks_configuration !== undefined) updatePayload.tasks_configuration = automationData.tasks_configuration;
      if (automationData.total_tasks !== undefined) updatePayload.total_tasks = automationData.total_tasks;

      // Optimistically update local state first
      setAutomations(prev => prev.map(automation => 
        automation.id === id ? { ...automation, ...updatePayload } : automation
      ));

      console.log('[useTaskAutomationsManagement] Updating automation', id, updatePayload);

      const { data, error: updateError } = await supabase
        .from('task_automations')
        .update(updatePayload)
        .eq('id', id)
        .select('*')
        .single();

      console.log('[useTaskAutomationsManagement] Update response', { data, updateError });

      if (updateError) {
        console.error('Database update error:', updateError);
        // Revert optimistic update on error
        await fetchAutomations();
        throw updateError;
      }

      // Update with actual server response and fetch category data
      await fetchAutomations();
      
      return data;
    } catch (err) {
      console.error('Error updating task automation:', err);
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
        console.error('Database delete error:', deleteError);
        throw deleteError;
      }

      // Refresh automations list
      await fetchAutomations();
    } catch (err) {
      console.error('Error deleting task automation:', err);
      throw err;
    }
  };

  const toggleAutomationEnabled = async (id: string, enabled: boolean) => {
    try {
      const { error: updateError } = await supabase
        .from('task_automations')
        .update({ automation_enabled: enabled })
        .eq('id', id);

      if (updateError) {
        console.error('Database update error:', updateError);
        throw updateError;
      }

      // Refresh automations list
      await fetchAutomations();
    } catch (err) {
      console.error('Error toggling automation:', err);
      throw err;
    }
  };

  const getUsedListIds = (excludeAutomationId?: string): string[] => {
    return automations
      .filter(automation => 
        automation.hs_list_id && 
        automation.id !== excludeAutomationId
      )
      .map(automation => automation.hs_list_id!)
      .filter(Boolean);
  };

  useEffect(() => {
    fetchAutomations();
  }, []);

  return {
    automations,
    loading,
    error,
    refetch: fetchAutomations,
    getAutomationsByCategory,
    createAutomation,
    updateAutomation,
    deleteAutomation,
    toggleAutomationEnabled,
    getUsedListIds
  };
};