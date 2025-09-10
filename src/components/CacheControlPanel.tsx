import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Database, RefreshCw } from "lucide-react";
import { useCacheMonitoring, SyncMetadata } from '@/hooks/useCacheMonitoring';
import { useToast } from "@/hooks/use-toast";

interface CacheControlPanelProps {
  onFullSyncTrigger?: () => void;
}

export const CacheControlPanel: React.FC<CacheControlPanelProps> = ({ onFullSyncTrigger }) => {
  const [syncMetadata, setSyncMetadata] = React.useState<SyncMetadata | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [lastRefresh, setLastRefresh] = React.useState<Date>(new Date());
  const { fetchSyncMetadata, triggerIncrementalSync } = useCacheMonitoring();
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
        description: "Global incremental sync triggered successfully",
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

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Cache Control Panel</h2>
        <div className="flex gap-2">
          <Button 
            onClick={handleIncrementalSync}
            disabled={isLoading}
            variant="outline"
          >
            {isLoading ? 'Syncing...' : 'Trigger Incremental Sync'}
          </Button>
          
          <Button 
            onClick={() => onFullSyncTrigger?.()}
            disabled={isLoading}
            variant="default"
          >
            Trigger Full Sync
          </Button>
          
          <Button 
            onClick={loadSyncMetadata}
            disabled={isLoading}
            variant="secondary"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Global Sync Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Sync Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {syncMetadata ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-medium">Last Sync:</span>
                <Badge variant={syncMetadata.last_sync_success ? "default" : "destructive"}>
                  {syncMetadata.last_sync_success ? "Success" : "Failed"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {formatTimestamp(syncMetadata.last_sync_timestamp)}
                </span>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium">Type:</span>
                  <p className="capitalize">{syncMetadata.sync_type}</p>
                </div>
                <div>
                  <span className="font-medium">Duration:</span>
                  <p>{formatDuration(syncMetadata.sync_duration)}</p>
                </div>
                <div>
                  <span className="font-medium">Tasks Added:</span>
                  <p>{syncMetadata.tasks_added}</p>
                </div>
                <div>
                  <span className="font-medium">Tasks Updated:</span>
                  <p>{syncMetadata.tasks_updated}</p>
                </div>
              </div>
              
              {syncMetadata.tasks_deleted > 0 && (
                <div className="text-sm">
                  <span className="font-medium">Tasks Deleted:</span>
                  <span className="ml-2">{syncMetadata.tasks_deleted}</span>
                </div>
              )}
              
              {syncMetadata.error_message && (
                <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-sm text-destructive font-medium">Error:</p>
                  <p className="text-sm text-destructive">{syncMetadata.error_message}</p>
                </div>
              )}
              
              <div className="text-xs text-muted-foreground">
                Last refreshed: {lastRefresh.toLocaleTimeString()}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No sync data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};