import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, Activity, Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SyncExecution {
  id: string;
  execution_id: string;
  sync_type: string;
  trigger_source: string;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  status: string;
  tasks_fetched: number;
  tasks_created?: number;
  tasks_updated: number;
  tasks_failed: number;
  hubspot_api_calls: number;
  error_message?: string;
  execution_log?: any;
  created_at: string;
  updated_at: string;
  error_details?: any;
}

interface TaskSyncAttempt {
  id: string;
  execution_id: string;
  task_hubspot_id: string;
  status: string;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  error_message?: string;
}

export const SyncMonitor = () => {
  const [executions, setExecutions] = useState<SyncExecution[]>([]);
  const [taskAttempts, setTaskAttempts] = useState<TaskSyncAttempt[]>([]);
  const [selectedExecution, setSelectedExecution] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchExecutions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sync_executions')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setExecutions(data || []);
    } catch (error) {
      console.error('Error fetching sync executions:', error);
      toast({
        title: "Error",
        description: "Failed to fetch sync executions",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTaskAttempts = async (executionId: string) => {
    try {
      const { data, error } = await supabase
        .from('task_sync_attempts')
        .select('*')
        .eq('execution_id', executionId)
        .order('started_at', { ascending: false });

      if (error) throw error;
      setTaskAttempts(data || []);
    } catch (error) {
      console.error('Error fetching task attempts:', error);
      toast({
        title: "Error",
        description: "Failed to fetch task sync attempts",
        variant: "destructive"
      });
    }
  };

  const triggerSync = async (type: 'incremental' | 'full') => {
    try {
      const functionName = type === 'incremental' 
        ? 'incremental-sync-hubspot-tasks'
        : 'sync-hubspot-tasks';
      
      const { error } = await supabase.functions.invoke(functionName, {
        body: { 
          triggerSource: 'manual',
          triggerTime: new Date().toISOString()
        }
      });

      if (error) throw error;
      
      toast({
        title: "Sync Started",
        description: `${type} sync has been triggered`,
      });
      
      // Refresh executions after a short delay
      setTimeout(fetchExecutions, 2000);
    } catch (error) {
      console.error('Error triggering sync:', error);
      toast({
        title: "Error",
        description: "Failed to trigger sync",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchExecutions();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('sync_monitor')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sync_executions'
        },
        () => {
          fetchExecutions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (selectedExecution) {
      fetchTaskAttempts(selectedExecution);
    }
  }, [selectedExecution]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Activity className="h-4 w-4 text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'default';
      case 'completed':
        return 'secondary';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Sync Monitor</h2>
          <p className="text-muted-foreground">Real-time monitoring of HubSpot sync operations</p>
        </div>
        
        <div className="flex gap-2">
          <Button
            onClick={() => triggerSync('incremental')}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Incremental Sync
          </Button>
          <Button
            onClick={() => triggerSync('full')}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Full Sync
          </Button>
          <Button
            onClick={fetchExecutions}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="executions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="executions">Sync Executions</TabsTrigger>
          <TabsTrigger value="task-details">Task Details</TabsTrigger>
        </TabsList>

        <TabsContent value="executions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Sync Executions</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {executions.map((execution) => (
                    <div
                      key={execution.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedExecution === execution.execution_id
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedExecution(execution.execution_id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(execution.status)}
                          <span className="font-mono text-sm">{execution.execution_id}</span>
                          <Badge variant={getStatusColor(execution.status)}>
                            {execution.status}
                          </Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {formatTime(execution.started_at)}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Type:</span> {execution.sync_type}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Source:</span> {execution.trigger_source}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Duration:</span> {formatDuration(execution.duration_ms)}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Tasks:</span> {execution.tasks_fetched}
                        </div>
                      </div>
                      
                      {execution.error_message && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                          <AlertTriangle className="h-4 w-4 inline mr-1" />
                          {execution.error_message}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="task-details" className="space-y-4">
          {selectedExecution ? (
            <Card>
              <CardHeader>
                <CardTitle>Task Sync Attempts</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Execution: {selectedExecution}
                </p>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <div className="space-y-2">
                    {taskAttempts.map((attempt) => (
                      <div key={attempt.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(attempt.status)}
                            <span className="font-mono text-sm">
                              Task {attempt.task_hubspot_id}
                            </span>
                            <Badge variant={getStatusColor(attempt.status)}>
                              {attempt.status}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDuration(attempt.duration_ms)}
                          </span>
                        </div>
                        
                        {attempt.error_message && (
                          <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                            {attempt.error_message}
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {taskAttempts.length === 0 && (
                      <div className="text-center text-muted-foreground py-8">
                        No task attempts found for this execution
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground">
                  Select a sync execution to view task details
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};