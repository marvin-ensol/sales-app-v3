import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { Activity, Clock, AlertTriangle, CheckCircle, XCircle, Zap } from 'lucide-react';
import { realtimeManager } from '@/lib/realtimeManager';

interface SyncStatus {
  lastExecution?: {
    status: string;
    started_at: string;
    completed_at?: string;
    tasks_fetched: number;
    tasks_failed: number;
    error_message?: string;
  };
  activeExecutions: number;
  isLive: boolean;
}

export const SyncStatusWidget = () => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    activeExecutions: 0,
    isLive: false
  });
  const [isOpen, setIsOpen] = useState(false);
  const subscriptionHandleRef = useRef<any>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();
  const intervalRef = useRef<NodeJS.Timeout>();

  const fetchSyncStatus = useCallback(async () => {
    try {
      // Get latest execution
      const { data: executions, error: execError } = await supabase
        .from('sync_executions')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(1);

      if (execError) throw execError;

      // Count active executions
      const { data: activeExecs, error: activeError } = await supabase
        .from('sync_executions')
        .select('id')
        .eq('status', 'running');

      if (activeError) throw activeError;

      setSyncStatus({
        lastExecution: executions?.[0],
        activeExecutions: activeExecs?.length || 0,
        isLive: (activeExecs?.length || 0) > 0
      });
    } catch (error) {
      console.error('Error fetching sync status:', error);
    }
  }, []);

  const debouncedRefetch = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      console.log('[SyncStatusWidget] Debounced refetch triggered');
      fetchSyncStatus();
    }, 500);
  }, [fetchSyncStatus]);

  useEffect(() => {
    fetchSyncStatus();
    
    // Set up real-time subscription with centralized manager
    const handle = realtimeManager.subscribe(
      'sync_status_widget',
      [
        {
          schema: 'public',
          table: 'sync_executions',
          event: '*',
        }
      ],
      () => {
        debouncedRefetch();
      }
    );

    subscriptionHandleRef.current = handle;

    // Refresh every 30 seconds
    intervalRef.current = setInterval(fetchSyncStatus, 30000);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      handle.unsubscribe();
    };
  }, [fetchSyncStatus, debouncedRefetch]);

  const getStatusIcon = () => {
    if (syncStatus.isLive) {
      return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />;
    }
    
    if (!syncStatus.lastExecution) {
      return <Clock className="h-4 w-4 text-gray-500" />;
    }

    switch (syncStatus.lastExecution.status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    if (syncStatus.isLive) {
      return `${syncStatus.activeExecutions} sync${syncStatus.activeExecutions > 1 ? 's' : ''} running`;
    }
    
    if (!syncStatus.lastExecution) {
      return 'No sync history';
    }

    const lastSync = new Date(syncStatus.lastExecution.started_at);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - lastSync.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) {
      return 'Just synced';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else {
      const hours = Math.floor(diffMinutes / 60);
      return `${hours}h ago`;
    }
  };

  const getStatusColor = () => {
    if (syncStatus.isLive) return 'default';
    if (!syncStatus.lastExecution) return 'outline';
    
    switch (syncStatus.lastExecution.status) {
      case 'completed':
        return 'secondary';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const triggerQuickSync = async () => {
    try {
      const { error } = await supabase.functions.invoke('incremental-sync-hubspot-tasks', {
        body: { 
          triggerSource: 'widget',
          triggerTime: new Date().toISOString()
        }
      });

      if (error) throw error;
      setIsOpen(false);
    } catch (error) {
      console.error('Error triggering sync:', error);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <Badge variant={getStatusColor()} className="text-xs">
              {getStatusText()}
            </Badge>
          </div>
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Sync Status</h4>
            {syncStatus.isLive && (
              <Badge variant="default" className="animate-pulse">
                <Activity className="h-3 w-3 mr-1" />
                Live
              </Badge>
            )}
          </div>
          
          {syncStatus.lastExecution && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Sync:</span>
                <span>{new Date(syncStatus.lastExecution.started_at).toLocaleTimeString()}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant={getStatusColor()}>
                  {syncStatus.lastExecution.status}
                </Badge>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tasks Fetched:</span>
                <span>{syncStatus.lastExecution.tasks_fetched}</span>
              </div>
              
              {syncStatus.lastExecution.tasks_failed > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Failed:</span>
                  <span>{syncStatus.lastExecution.tasks_failed}</span>
                </div>
              )}
              
              {syncStatus.lastExecution.error_message && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs">
                  <AlertTriangle className="h-3 w-3 inline mr-1" />
                  {syncStatus.lastExecution.error_message}
                </div>
              )}
            </div>
          )}
          
          <div className="flex gap-2">
            <Button
              onClick={triggerQuickSync}
              disabled={syncStatus.isLive}
              size="sm"
              className="flex-1"
            >
              <Zap className="h-3 w-3 mr-1" />
              Quick Sync
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};