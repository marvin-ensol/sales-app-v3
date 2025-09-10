import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SyncHealth {
  isHealthy: boolean;
  lastSyncAge: number; // minutes
  activeExecutions: number;
  failureRate: number; // percentage
  avgSyncDuration: number; // milliseconds
}

interface TaskSyncIssue {
  taskId: string;
  hubspotId: string;
  issueType: 'missing_contact' | 'sync_failure' | 'timeout' | 'rate_limit';
  lastAttempt: string;
  errorMessage?: string;
  attemptCount: number;
}

export const useSyncDebug = () => {
  const [syncHealth, setSyncHealth] = useState<SyncHealth>({
    isHealthy: true,
    lastSyncAge: 0,
    activeExecutions: 0,
    failureRate: 0,
    avgSyncDuration: 0
  });
  
  const [taskIssues, setTaskIssues] = useState<TaskSyncIssue[]>([]);
  const [loading, setLoading] = useState(false);

  const calculateSyncHealth = async (): Promise<SyncHealth> => {
    try {
      // Get recent executions (last 24 hours)
      const { data: executions, error: execError } = await supabase
        .from('sync_executions')
        .select('*')
        .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('started_at', { ascending: false });

      if (execError) throw execError;

      if (!executions || executions.length === 0) {
        return {
          isHealthy: false,
          lastSyncAge: Infinity,
          activeExecutions: 0,
          failureRate: 100,
          avgSyncDuration: 0
        };
      }

      // Calculate metrics
      const activeExecutions = executions.filter(e => e.status === 'running').length;
      const completedExecutions = executions.filter(e => e.status === 'completed');
      const failedExecutions = executions.filter(e => e.status === 'failed');
      
      const failureRate = executions.length > 0 
        ? (failedExecutions.length / executions.length) * 100 
        : 0;

      const avgSyncDuration = completedExecutions.length > 0
        ? completedExecutions.reduce((sum, e) => sum + (e.duration_ms || 0), 0) / completedExecutions.length
        : 0;

      const lastSyncTime = new Date(executions[0].started_at);
      const lastSyncAge = Math.floor((Date.now() - lastSyncTime.getTime()) / (1000 * 60));

      const isHealthy = failureRate < 20 && lastSyncAge < 60 && activeExecutions < 3;

      return {
        isHealthy,
        lastSyncAge,
        activeExecutions,
        failureRate,
        avgSyncDuration
      };
    } catch (error) {
      console.error('Error calculating sync health:', error);
      return {
        isHealthy: false,
        lastSyncAge: Infinity,
        activeExecutions: 0,
        failureRate: 100,
        avgSyncDuration: 0
      };
    }
  };

  const findTaskIssues = async (): Promise<TaskSyncIssue[]> => {
    try {
      // Find tasks with repeated failures
      const { data: failedAttempts, error } = await supabase
        .from('task_sync_attempts')
        .select('*')
        .eq('status', 'failed')
        .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('started_at', { ascending: false });

      if (error) throw error;

      // Group by task and count failures
      const taskFailures: { [taskId: string]: any[] } = {};
      failedAttempts?.forEach(attempt => {
        if (!taskFailures[attempt.task_hubspot_id]) {
          taskFailures[attempt.task_hubspot_id] = [];
        }
        taskFailures[attempt.task_hubspot_id].push(attempt);
      });

      // Convert to issues array
      const issues: TaskSyncIssue[] = Object.entries(taskFailures)
        .filter(([_, attempts]) => attempts.length >= 3) // Only show tasks with 3+ failures
        .map(([taskId, attempts]) => {
          const lastAttempt = attempts[0];
          
          let issueType: TaskSyncIssue['issueType'] = 'sync_failure';
          if (lastAttempt.error_message?.includes('contact')) {
            issueType = 'missing_contact';
          } else if (lastAttempt.error_message?.includes('timeout')) {
            issueType = 'timeout';
          } else if (lastAttempt.error_message?.includes('rate')) {
            issueType = 'rate_limit';
          }

          return {
            taskId,
            hubspotId: taskId,
            issueType,
            lastAttempt: lastAttempt.started_at,
            errorMessage: lastAttempt.error_message,
            attemptCount: attempts.length
          };
        });

      return issues;
    } catch (error) {
      console.error('Error finding task issues:', error);
      return [];
    }
  };

  const refreshHealthData = async () => {
    setLoading(true);
    try {
      const [health, issues] = await Promise.all([
        calculateSyncHealth(),
        findTaskIssues()
      ]);
      
      setSyncHealth(health);
      setTaskIssues(issues);
    } catch (error) {
      console.error('Error refreshing health data:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerTaskSync = async (taskHubspotId: string) => {
    try {
      // Trigger a specific task sync by calling incremental sync
      // The sync will pick up this task if it's been modified
      const { error } = await supabase.functions.invoke('incremental-sync-hubspot-tasks', {
        body: { 
          triggerSource: `debug-task-${taskHubspotId}`,
          triggerTime: new Date().toISOString()
        }
      });

      if (error) throw error;
      
      // Refresh data after a short delay
      setTimeout(refreshHealthData, 3000);
      
      return { success: true };
    } catch (error) {
      console.error('Error triggering task sync:', error);
      return { success: false, error: error.message };
    }
  };

  const getHealthStatus = () => {
    if (!syncHealth.isHealthy) {
      if (syncHealth.lastSyncAge > 120) return 'critical';
      if (syncHealth.failureRate > 50) return 'critical';
      return 'warning';
    }
    return 'healthy';
  };

  const getHealthMessage = () => {
    const status = getHealthStatus();
    
    if (status === 'critical') {
      if (syncHealth.lastSyncAge > 120) {
        return `Last sync was ${syncHealth.lastSyncAge} minutes ago`;
      }
      return `High failure rate: ${syncHealth.failureRate.toFixed(1)}%`;
    }
    
    if (status === 'warning') {
      return `${syncHealth.activeExecutions} active syncs, ${syncHealth.failureRate.toFixed(1)}% failure rate`;
    }
    
    return 'All systems operational';
  };

  useEffect(() => {
    refreshHealthData();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('sync_debug')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sync_executions'
        },
        () => {
          refreshHealthData();
        }
      )
      .subscribe();

    // Refresh every 2 minutes
    const interval = setInterval(refreshHealthData, 2 * 60 * 1000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  return {
    syncHealth,
    taskIssues,
    loading,
    refreshHealthData,
    triggerTaskSync,
    getHealthStatus,
    getHealthMessage
  };
};