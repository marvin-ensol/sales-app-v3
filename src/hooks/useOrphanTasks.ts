import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface OrphanTaskStats {
  count: number;
  loading: boolean;
  error?: string;
}

interface OrphanDeletionResult {
  success: boolean;
  deleted: number;
  total: number;
  errors: string[];
  message: string;
}

export const useOrphanTasks = () => {
  const [stats, setStats] = useState<OrphanTaskStats>({
    count: 0,
    loading: true
  });
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchOrphanCount = async () => {
    setStats(prev => ({ ...prev, loading: true, error: undefined }));

    try {
      const { data, error } = await supabase
        .from('hs_tasks')
        .select('*', { count: 'exact', head: true })
        .is('associated_contact_id', null)
        .is('associated_deal_id', null)
        .is('associated_company_id', null)
        .eq('archived', false);

      if (error) {
        throw new Error(error.message);
      }

      setStats({
        count: data?.length || 0,
        loading: false
      });
    } catch (error: any) {
      console.error('Error fetching orphan task count:', error);
      setStats({
        count: 0,
        loading: false,
        error: error.message
      });
    }
  };

  const deleteOrphanTasks = async (): Promise<OrphanDeletionResult> => {
    setIsDeleting(true);

    try {
      const { data, error } = await supabase.functions.invoke('delete-orphan-tasks', {
        body: {}
      });

      if (error) {
        throw new Error(`Function error: ${error.message}`);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Unknown error occurred');
      }

      // Refresh the count after deletion
      await fetchOrphanCount();

      toast({
        title: "Orphan Tasks Deleted",
        description: data.message,
      });

      return data;
    } catch (error: any) {
      console.error('Error deleting orphan tasks:', error);
      toast({
        title: "Deletion Failed",
        description: error.message || 'Unknown error occurred',
        variant: "destructive",
      });

      return {
        success: false,
        deleted: 0,
        total: 0,
        errors: [error.message],
        message: 'Deletion failed'
      };
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    fetchOrphanCount();
  }, []);

  return {
    stats,
    isDeleting,
    deleteOrphanTasks,
    refreshCount: fetchOrphanCount
  };
};