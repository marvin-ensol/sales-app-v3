import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Database, Download, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SyncProgress {
  phase: 'idle' | 'clearing' | 'fetching' | 'processing' | 'complete' | 'error';
  progress: number;
  message: string;
  totalRecords?: number;
  processedRecords?: number;
  error?: string;
}

const Data = () => {
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    phase: 'idle',
    progress: 0,
    message: 'Ready to sync data'
  });
  const [isRunning, setIsRunning] = useState(false);
  const { toast } = useToast();

  const handleSyncData = async () => {
    setIsRunning(true);
    setSyncProgress({
      phase: 'clearing',
      progress: 10,
      message: 'Clearing existing data...'
    });

    try {
      // Call the sync edge function
      const { data, error } = await supabase.functions.invoke('sync-hubspot-tasks', {
        body: {}
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        setSyncProgress({
          phase: 'complete',
          progress: 100,
          message: `Successfully synced ${data.totalRecords} records`,
          totalRecords: data.totalRecords
        });
        
        toast({
          title: "Sync Complete",
          description: `Successfully synced ${data.totalRecords} HubSpot tasks`,
        });
      } else {
        throw new Error(data.error || 'Unknown error occurred');
      }
    } catch (error: any) {
      console.error('Sync error:', error);
      setSyncProgress({
        phase: 'error',
        progress: 0,
        message: 'Sync failed',
        error: error.message || 'Unknown error occurred'
      });
      
      toast({
        title: "Sync Failed",
        description: error.message || 'Unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getProgressColor = () => {
    switch (syncProgress.phase) {
      case 'error':
        return 'bg-red-500';
      case 'complete':
        return 'bg-green-500';
      default:
        return 'bg-blue-500';
    }
  };

  const getPhaseIcon = () => {
    switch (syncProgress.phase) {
      case 'clearing':
        return <Trash2 className="h-4 w-4 animate-spin" />;
      case 'fetching':
      case 'processing':
        return <Download className="h-4 w-4 animate-pulse" />;
      case 'complete':
        return <Database className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Database className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Data Management</h1>
          <p className="text-gray-600">
            Manage HubSpot task data synchronization
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              HubSpot Tasks Sync
            </CardTitle>
            <CardDescription>
              Clear existing data and fetch fresh task records from HubSpot. 
              This process handles pagination and respects API rate limits.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getPhaseIcon()}
                  <span className="font-medium">{syncProgress.message}</span>
                </div>
                {syncProgress.totalRecords && (
                  <span className="text-sm text-gray-500">
                    {syncProgress.totalRecords} records
                  </span>
                )}
              </div>
              
              <div className="space-y-2">
                <Progress 
                  value={syncProgress.progress} 
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-gray-500">
                  <span>{syncProgress.progress}% complete</span>
                  {syncProgress.processedRecords && syncProgress.totalRecords && (
                    <span>
                      {syncProgress.processedRecords} / {syncProgress.totalRecords}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {syncProgress.phase === 'error' && syncProgress.error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {syncProgress.error}
                </AlertDescription>
              </Alert>
            )}

            <Button 
              onClick={handleSyncData}
              disabled={isRunning}
              className="w-full"
              size="lg"
            >
              {isRunning ? (
                <>
                  <Download className="mr-2 h-4 w-4 animate-pulse" />
                  Syncing Data...
                </>
              ) : (
                <>
                  <Database className="mr-2 h-4 w-4" />
                  Clear & Sync HubSpot Tasks
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-700">
              Sync Process Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-600 space-y-2">
              <p>• Deletes all existing records from hs_tasks table</p>
              <p>• Fetches non-completed tasks from HubSpot API</p>
              <p>• Processes 100 records per API call with rate limiting</p>
              <p>• Handles pagination automatically</p>
              <p>• Inserts fresh data into the database</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Data;