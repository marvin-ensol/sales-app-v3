import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TaskCategory {
  id: string;
  title: string;
  color: string;
  queueId: string | null;
}

// Fallback categories in case database fetch fails
const FALLBACK_CATEGORIES: TaskCategory[] = [
  { id: "rappels", title: "Rappels & RDV", color: "border-l-4 border-l-purple-400", queueId: "22933271" },
  { id: "new", title: "New", color: "border-l-4 border-l-blue-400", queueId: "22859489" },
  { id: "simulations", title: "Simulations", color: "border-l-4 border-l-green-400", queueId: "22934016" },
  { id: "communications", title: "Communications", color: "border-l-4 border-l-yellow-400", queueId: "22934015" },
  { id: "attempted", title: "Attempted", color: "border-l-4 border-l-orange-400", queueId: "22859490" },
  { id: "other", title: "Autres", color: "border-l-4 border-l-gray-400", queueId: "other" }
];

export const useTaskCategories = () => {
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching task categories from database...');
      const { data, error: queryError } = await supabase.rpc('get_task_categories');

      if (queryError) {
        console.error('Database query error:', queryError);
        throw queryError;
      }

      console.log('Raw category data from database:', data);

      // Transform data to match expected interface
      const transformedCategories: TaskCategory[] = (data || []).map((category: any) => ({
        id: getColumnIdFromQueueId(category.hs_queue_id),
        title: category.label || '',
        color: `border-l-4` + (category.color ? ` border-l-[${category.color}]` : ' border-l-gray-400'),
        queueId: category.hs_queue_id
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