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
}

interface CategoryFormData {
  label: string;
  color: string;
  hs_queue_id: string;
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

      setCategories(data || []);
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
          order_column: nextOrder,
          system_default: false
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
          hs_queue_id: categoryData.hs_queue_id || null
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
    deleteCategory
  };
};