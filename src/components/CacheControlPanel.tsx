import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, RefreshCw, Database, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useCacheMonitoring, SyncMetadata } from '@/hooks/useCacheMonitoring';
import { useToast } from '@/hooks/use-toast';

interface CacheControlPanelProps {
  onFullSyncTrigger?: () => void;
}

export const CacheControlPanel: React.FC<CacheControlPanelProps> = ({ onFullSyncTrigger }) => {
  const [syncMetadata, setSyncMetadata] = React.useState<SyncMetadata[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [lastRefresh, setLastRefresh] = React.useState<Date>(new Date());
  const { fetchSyncMetadata, triggerIncrementalSync, getSyncStatus } = useCacheMonitoring();
  const { toast } = useToast();

  const loadSyncMetadata = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await fetchSyncMetadata();
      setSyncMetadata(data);
      setLastRefresh(new Date());
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load sync metadata",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [fetchSyncMetadata, toast]);

  const handleIncrementalSync = async () => {
    try {
      setIsLoading(true);
      await triggerIncrementalSync();
      toast({
        title: "Success",
        description: "Incremental sync triggered successfully",
      });
      // Refresh metadata after a short delay
      setTimeout(loadSyncMetadata, 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to trigger incremental sync",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadSyncMetadata();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadSyncMetadata, 30000);
    return () => clearInterval(interval);
  }, [loadSyncMetadata]);

  const globalMetadata = syncMetadata.find(m => m.owner_id === 'global');
  const ownerMetadata = syncMetadata.filter(m => m.owner_id !== 'global');

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Cache Control Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Cache Management
              </CardTitle>
              <CardDescription>
                Monitor and control the HubSpot cache synchronization
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                Last refresh: {lastRefresh.toLocaleTimeString()}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={loadSyncMetadata}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={handleIncrementalSync}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Trigger Incremental Sync
            </Button>
            <Button
              onClick={onFullSyncTrigger}
              disabled={isLoading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Database className="h-4 w-4" />
              Trigger Full Sync
            </Button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Enhanced Auto-sync: Every 45 seconds
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Global Sync Status */}
      {globalMetadata && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Global Sync Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Last Sync</div>
                <div className="flex items-center gap-2">
                  {globalMetadata.last_sync_success ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm">
                    {formatTimestamp(globalMetadata.last_sync_timestamp)}
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="text-sm font-medium">Sync Type</div>
                <Badge variant={globalMetadata.sync_type === 'full' ? 'default' : 'secondary'}>
                  {globalMetadata.sync_type}
                </Badge>
              </div>
              
              <div className="space-y-2">
                <div className="text-sm font-medium">Duration</div>
                <div className="text-sm">{formatDuration(globalMetadata.sync_duration)}</div>
              </div>
              
              <div className="space-y-2">
                <div className="text-sm font-medium">Tasks Processed</div>
                <div className="text-sm">
                  +{globalMetadata.tasks_added} ~{globalMetadata.tasks_updated} -{globalMetadata.tasks_deleted}
                </div>
              </div>
            </div>
            
            {globalMetadata.error_message && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Last Error:</span>
                </div>
                <div className="text-red-600 text-sm mt-1">{globalMetadata.error_message}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Owner Sync Status */}
      {ownerMetadata.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Owner Sync Status</CardTitle>
            <CardDescription>
              Individual sync status for each owner ({ownerMetadata.length} owners)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {ownerMetadata.slice(0, 10).map((metadata) => (
                <div key={metadata.owner_id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="font-medium text-sm">Owner {metadata.owner_id}</div>
                    {metadata.last_sync_success ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <Badge variant="outline">
                      {metadata.sync_type}
                    </Badge>
                    <span>{formatTimestamp(metadata.last_sync_timestamp)}</span>
                    <span>+{metadata.tasks_added} ~{metadata.tasks_updated}</span>
                  </div>
                </div>
              ))}
              
              {ownerMetadata.length > 10 && (
                <div className="text-center text-sm text-muted-foreground">
                  And {ownerMetadata.length - 10} more owners...
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};