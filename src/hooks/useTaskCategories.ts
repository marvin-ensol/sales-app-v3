import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TaskCategory {
  id: string;
  title: string;
  color: string;
  queueId: string | null;
  order: number;
  locks_lower_categories: boolean;
  task_display_order?: string;
}

// Fallback categories in case database fetch fails - using database IDs
const FALLBACK_CATEGORIES: TaskCategory[] = [
  { id: "4", title: "Rappels & RDV", color: "#a78bfa", queueId: "22933271", order: 1, locks_lower_categories: false, task_display_order: "oldest_tasks_first" },
  { id: "1", title: "New", color: "#60a5fa", queueId: "22859489", order: 2, locks_lower_categories: false, task_display_order: "oldest_tasks_first" },
  { id: "5", title: "Simulations", color: "#4ade80", queueId: "22934016", order: 3, locks_lower_categories: true, task_display_order: "oldest_tasks_first" },
  { id: "6", title: "Communications", color: "#facc15", queueId: "22934015", order: 5, locks_lower_categories: false, task_display_order: "oldest_tasks_first" },
  { id: "3", title: "Attempted", color: "#fb923c", queueId: "22859490", order: 4, locks_lower_categories: false, task_display_order: "oldest_tasks_first" },
  { id: "7", title: "Autres", color: "#9ca3af", queueId: null, order: 8, locks_lower_categories: false, task_display_order: "oldest_tasks_first" }
];

export const useTaskCategories = (userTeamId?: string | null) => {
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching task categories from database with team filter:', userTeamId);
      const { data, error: queryError } = await supabase.rpc('get_task_categories', { 
        team_id_param: userTeamId 
      });

      if (queryError) {
        console.error('Database query error:', queryError);
        throw queryError;
      }

      console.log('Raw category data from database:', data);

// Transform data to match expected interface - use database IDs directly
      const transformedCategories: TaskCategory[] = (data || []).map((category: any) => ({
        id: category.id.toString(), // Use database ID directly instead of hardcoded mapping
        title: category.label || '',
        color: category.color || '#6b7280', // Store raw hex color, fallback to gray
        queueId: category.hs_queue_id,
        order: category.order_column || 999,
        locks_lower_categories: category.locks_lower_categories || false,
        task_display_order: category.task_display_order || 'oldest_tasks_first'
      }));

      console.log('Transformed categories:', transformedCategories);

      if (transformedCategories.length === 0) {
        console.warn('No categories found in database, using fallback');
        setCategories(FALLBACK_CATEGORIES);
      } else {
        setCategories(transformedCategories);
      }
    } catch (err) {
      console.error('Error fetching task categories:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch task categories');
      console.warn('Using fallback categories due to error');
      setCategories(FALLBACK_CATEGORIES);
    } finally {
      setLoading(false);
    }
  };

// No longer needed - using database IDs directly

  useEffect(() => {
    fetchCategories();
  }, [userTeamId]);

  return {
    categories,
    loading,
    error,
    refetch: fetchCategories
  };
};