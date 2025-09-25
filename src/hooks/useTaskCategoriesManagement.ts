import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TaskCategoryManagement {
  id: number;
  label: string;
  color: string;
  hs_queue_id: string;
  order_column: number;
  system_default?: boolean;
  created_at?: string;
  visible_team_ids?: string[];
  locks_lower_categories?: boolean;
  task_display_order?: string;
}

export interface CategoryFormData {
  label: string;
  color: string;
  hs_queue_id: string;
  visible_team_ids: string[];
  locks_lower_categories: boolean;
  task_display_order: string;
}

export const useTaskCategoriesManagement = () => {
  const [categories, setCategories] = useState<TaskCategoryManagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: queryError } = await supabase
        .from('task_categories')
        .select('*')
        .order('order_column');

      if (queryError) {
        console.error('Database query error:', queryError);
        throw queryError;
      }

      // Transform the data to ensure visible_team_ids is properly typed
      const transformedCategories = (data || []).map(category => ({
        ...category,
        visible_team_ids: Array.isArray(category.visible_team_ids) 
          ? (category.visible_team_ids as string[])
          : [],
        locks_lower_categories: category.locks_lower_categories ?? false,
        task_display_order: category.task_display_order ?? 'oldest_tasks_first'
      }));
      setCategories(transformedCategories);
    } catch (err) {
      console.error('Error fetching task categories:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch task categories');
    } finally {
      setLoading(false);
    }
  };

  const createCategory = async (categoryData: CategoryFormData) => {
    try {
      // Get the next order_column value
      const { data: maxOrderData } = await supabase
        .from('task_categories')
        .select('order_column')
        .order('order_column', { ascending: false })
        .limit(1);

      const nextOrder = (maxOrderData?.[0]?.order_column || 0) + 1;

      const { data, error: insertError } = await supabase
        .from('task_categories')
        .insert({
          label: categoryData.label,
          color: categoryData.color,
          hs_queue_id: categoryData.hs_queue_id || null,
          visible_team_ids: categoryData.visible_team_ids || [],
          order_column: nextOrder,
          system_default: false,
          locks_lower_categories: categoryData.locks_lower_categories ?? false,
          task_display_order: categoryData.task_display_order || 'oldest_tasks_first'
        })
        .select()
        .single();

      if (insertError) {
        console.error('Database insert error:', insertError);
        throw insertError;
      }

      // Refresh categories list
      await fetchCategories();
      
      return data;
    } catch (err) {
      console.error('Error creating task category:', err);
      throw err;
    }
  };

  const updateCategory = async (id: number, categoryData: CategoryFormData) => {
    try {
      const { data, error: updateError } = await supabase
        .from('task_categories')
        .update({
          label: categoryData.label,
          color: categoryData.color,
          hs_queue_id: categoryData.hs_queue_id || null,
          visible_team_ids: categoryData.visible_team_ids || [],
          locks_lower_categories: categoryData.locks_lower_categories ?? false,
          task_display_order: categoryData.task_display_order || 'oldest_tasks_first'
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        console.error('Database update error:', updateError);
        throw updateError;
      }

      // Refresh categories list
      await fetchCategories();
      
      return data;
    } catch (err) {
      console.error('Error updating task category:', err);
      throw err;
    }
  };

  const deleteCategory = async (id: number) => {
    try {
      const { error: deleteError } = await supabase
        .from('task_categories')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('Database delete error:', deleteError);
        throw deleteError;
      }

      // Refresh categories list
      await fetchCategories();
    } catch (err) {
      console.error('Error deleting task category:', err);
      throw err;
    }
  };

  const updateCategoryOrder = async (id: number, direction: 'up' | 'down') => {
    try {
      const currentIndex = categories.findIndex(cat => cat.id === id);
      if (currentIndex === -1) return;

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= categories.length) return;

      const currentCategory = categories[currentIndex];
      const targetCategory = categories[targetIndex];

      // Use a three-step atomic swap to avoid unique constraint violations
      // Step 1: Move current category to a temporary negative value
      const tempOrder = -Math.abs(currentCategory.order_column) - 1000;
      const { error: tempError } = await supabase
        .from('task_categories')
        .update({ order_column: tempOrder })
        .eq('id', currentCategory.id);

      if (tempError) {
        console.error('Error in temporary update:', tempError);
        throw tempError;
      }

      // Step 2: Move target category to current category's position
      const { error: updateError1 } = await supabase
        .from('task_categories')
        .update({ order_column: currentCategory.order_column })
        .eq('id', targetCategory.id);

      if (updateError1) {
        console.error('Error updating target category:', updateError1);
        throw updateError1;
      }

      // Step 3: Move current category to target category's position
      const { error: updateError2 } = await supabase
        .from('task_categories')
        .update({ order_column: targetCategory.order_column })
        .eq('id', currentCategory.id);

      if (updateError2) {
        console.error('Error updating current category:', updateError2);
        throw updateError2;
      }

      // No need to refresh - let the Settings component handle optimistic updates
    } catch (err) {
      console.error('Error updating category order:', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return {
    categories,
    loading,
    error,
    refetch: fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    updateCategoryOrder
  };
};
