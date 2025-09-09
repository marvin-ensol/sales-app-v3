import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TaskCategory {
  id: string;
  title: string;
  color: string;
  queueId: string | null;
}

export const useTaskCategories = () => {
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Using raw SQL query since task_categories table is not in types
      const { data, error: queryError } = await supabase.rpc('get_task_categories');

      if (queryError) {
        throw queryError;
      }

      // Transform data to match expected interface
      const transformedCategories: TaskCategory[] = (data || []).map(category => ({
        id: getColumnIdFromQueueId(category.hs_queue_id),
        title: category.label || '',
        color: `border-l-4` + (category.color ? ` border-l-[${category.color}]` : ''),
        queueId: category.hs_queue_id
      }));

      setCategories(transformedCategories);
    } catch (err) {
      console.error('Error fetching task categories:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch task categories');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  // Map queue IDs to column IDs based on existing logic
  const getColumnIdFromQueueId = (queueId: string | null): string => {
    switch (queueId) {
      case '22933271': return 'rappels';
      case '22859489': return 'new';
      case '22859490': return 'attempted';
      case '22934016': return 'simulations';
      case '22934015': return 'communications';
      default: return 'other';
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return {
    categories,
    loading,
    error,
    refetch: fetchCategories
  };
};