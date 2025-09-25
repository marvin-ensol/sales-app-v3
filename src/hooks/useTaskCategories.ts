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

// Fallback categories in case database fetch fails
const FALLBACK_CATEGORIES: TaskCategory[] = [
  { id: "rappels", title: "Rappels & RDV", color: "#9333ea", queueId: "22933271", order: 1, locks_lower_categories: false, task_display_order: "oldest_tasks_first" },
  { id: "new", title: "New", color: "#3b82f6", queueId: "22859489", order: 2, locks_lower_categories: true, task_display_order: "oldest_tasks_first" },
  { id: "simulations", title: "Simulations", color: "#22c55e", queueId: "22934016", order: 3, locks_lower_categories: false, task_display_order: "oldest_tasks_first" },
  { id: "communications", title: "Communications", color: "#eab308", queueId: "22934015", order: 4, locks_lower_categories: false, task_display_order: "oldest_tasks_first" },
  { id: "attempted", title: "Attempted", color: "#f97316", queueId: "22859490", order: 5, locks_lower_categories: false, task_display_order: "oldest_tasks_first" },
  { id: "other", title: "Autres", color: "#6b7280", queueId: null, order: 6, locks_lower_categories: false, task_display_order: "oldest_tasks_first" }
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

      // Transform data to match expected interface
      const transformedCategories: TaskCategory[] = (data || []).map((category: any) => ({
        id: getColumnIdFromQueueId(category.hs_queue_id),
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

  // Map queue IDs to column IDs based on existing logic
  const getColumnIdFromQueueId = (queueId: string | null): string => {
    if (queueId === null || queueId === undefined) {
      return 'other'; // Fallback category for null queue IDs
    }
    
    switch (queueId) {
      case '22933271': return 'rappels';
      case '22859489': return 'new';
      case '22859490': return 'attempted';
      case '22934016': return 'simulations';
      case '22934015': return 'communications';
      case '22697278': return 'upsell';
      case '22839689': return 'securisation';
      default: return 'other'; // Fallback for unmatched queue IDs
    }
  };

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