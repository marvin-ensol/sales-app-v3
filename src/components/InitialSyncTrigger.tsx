
import { useEffect, useState } from 'react';
import { useTriggerBackgroundSync } from '@/hooks/useTriggerBackgroundSync';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';

export const InitialSyncTrigger = () => {
  const { triggerSync, syncing, lastSyncResult } = useTriggerBackgroundSync();
  const [autoSyncTriggered, setAutoSyncTriggered] = useState(false);

  // Auto-trigger sync on component mount
  useEffect(() => {
    if (!autoSyncTriggered) {
      console.log('Auto-triggering initial background sync...');
      triggerSync().catch(console.error);
      setAutoSyncTriggered(true);
    }
  }, [triggerSync, autoSyncTriggered]);

  const handleManualSync = () => {
    triggerSync().catch(console.error);
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
      <Button
        onClick={handleManualSync}
        disabled={syncing}
        variant="outline"
        size="sm"
      >
        {syncing ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <RefreshCw className="h-4 w-4 mr-2" />
        )}
        {syncing ? 'Syncing...' : 'Manual Sync'}
      </Button>
      
      {lastSyncResult && (
        <div className="text-sm text-gray-600">
          Last sync: {lastSyncResult.tasksProcessed || 0} tasks
          {lastSyncResult.breakdown && (
            <span className="ml-2">
              ({lastSyncResult.breakdown.notStarted} not_started, 
               {lastSyncResult.breakdown.unassigned} unassigned, 
               {lastSyncResult.breakdown.completedToday} completed today)
            </span>
          )}
        </div>
      )}
    </div>
  );
};
