import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SyncMonitor } from './SyncMonitor';
import { SyncStatusWidget } from './SyncStatusWidget';
import { SyncControlPanel } from './SyncControlPanel';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw } from 'lucide-react';
import { useCacheMonitoring } from '@/hooks/useCacheMonitoring';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const SyncDashboard = () => {
  const { triggerFullSync, triggerIncrementalSync } = useCacheMonitoring();
  const { toast } = useToast();

  const handleExportLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('sync_executions')
        .select(`
          *,
          task_sync_attempts (*)
        `)
        .order('started_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const csvContent = [
        'execution_id,sync_type,status,started_at,completed_at,duration_ms,tasks_fetched,tasks_created,tasks_updated,tasks_failed,error_message',
        ...data.map(exec => [
          exec.execution_id,
          exec.sync_type,
          exec.status,
          exec.started_at,
          exec.completed_at || '',
          exec.duration_ms || '',
          exec.tasks_fetched || '',
          exec.tasks_created || '',
          exec.tasks_updated || '',
          exec.tasks_failed,
          exec.error_message || ''
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `sync-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Complete",
        description: "Sync logs exported successfully",
      });
    } catch (error) {
      console.error('Error exporting logs:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export sync logs",
        variant: "destructive"
      });
    }
  };

  const handleQuickActions = async (action: string) => {
    try {
      switch (action) {
        case 'incremental':
          await triggerIncrementalSync();
          toast({
            title: "Sync Started",
            description: "Incremental sync triggered",
          });
          break;
        case 'full':
          await triggerFullSync();
          toast({
            title: "Sync Started", 
            description: "Full sync triggered",
          });
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Error triggering sync:', error);
      toast({
        title: "Error",
        description: "Failed to trigger sync",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sync Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor and manage HubSpot synchronization operations
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <SyncStatusWidget />
          <Button
            onClick={handleExportLogs}
            variant="outline"
            size="sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Logs
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              onClick={() => handleQuickActions('incremental')}
              variant="outline"
              className="w-full justify-start"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Incremental Sync
            </Button>
            <Button
              onClick={() => handleQuickActions('full')}
              variant="outline"
              className="w-full justify-start"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Full Sync
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Debug Tools</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              onClick={() => window.open('/sync-monitor', '_blank')}
              variant="outline"
              className="w-full justify-start"
            >
              Real-time Monitor
            </Button>
            <Button
              onClick={handleExportLogs}
              variant="outline"
              className="w-full justify-start"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Debug Data
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cron Jobs:</span>
                <span className="text-green-600">Active</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">API Health:</span>
                <span className="text-green-600">Healthy</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Database:</span>
                <span className="text-green-600">Connected</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <SyncControlPanel />
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Real-time Monitor</CardTitle>
          </CardHeader>
          <CardContent>
            <SyncMonitor />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};