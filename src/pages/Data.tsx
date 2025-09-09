import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Database, Download, Trash2, Users } from "lucide-react";
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
  const [isOwnersSyncing, setIsOwnersSyncing] = useState(false);
  const { toast } = useToast();

  const handleSyncData = async () => {
    setIsRunning(true);
    setSyncProgress({
      phase: 'clearing',
      progress: 5,
      message: 'Starting sync process...'
    });

    try {
      // Call the sync edge function with streaming response
      const response = await fetch(`https://zenlavaixlvabzsnvzro.supabase.co/functions/v1/sync-hubspot-tasks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplbmxhdmFpeGx2YWJ6c252enJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4MjcwMDMsImV4cCI6MjA2NTQwMzAwM30.oCiIkxWRGGV1TTndh6gQV5X4zENe36E11iIPDbzqmh0`,
          'apikey': `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplbmxhdmFpeGx2YWJ6c252enJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4MjcwMDMsImV4cCI6MjA2NTQwMzAwM30.oCiIkxWRGGV1TTndh6gQV5X4zENe36E11iIPDbzqmh0`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              setSyncProgress(data);
              
              if (data.phase === 'complete') {
                toast({
                  title: "Sync Complete",
                  description: `Successfully synced ${data.totalRecords} HubSpot tasks`,
                });
              }
            } catch (e) {
              // Ignore parsing errors for incomplete chunks
            }
          }
        }
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

  const handleSyncOwners = async () => {
    setIsOwnersSyncing(true);
    
    try {
      const response = await supabase.functions.invoke('sync-hubspot-owners', {
        body: { manual_sync: true }
      });

      if (response.error) {
        throw new Error(`Function error: ${response.error.message}`);
      }

      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Unknown error occurred');
      }

      toast({
        title: "Owners Sync Complete",
        description: `Successfully synced ${response.data.stats?.owners_processed || 0} owners and ${response.data.stats?.teams_fetched || 0} teams`,
      });
    } catch (error: any) {
      console.error('Owners sync error:', error);
      toast({
        title: "Owners Sync Failed",
        description: error.message || 'Unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setIsOwnersSyncing(false);
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
            Manage HubSpot data synchronization
          </p>
        </div>

        <div className="space-y-6">
          <Card>
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
                    Syncing Tasks...
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
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                HubSpot Owners & Teams Sync
              </CardTitle>
              <CardDescription>
                Update owner and team information from HubSpot. This runs automatically every 6 hours but can be triggered manually.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleSyncOwners}
                disabled={isOwnersSyncing}
                className="w-full"
                size="lg"
                variant="outline"
              >
                {isOwnersSyncing ? (
                  <>
                    <Download className="mr-2 h-4 w-4 animate-pulse" />
                    Syncing Owners & Teams...
                  </>
                ) : (
                  <>
                    <Users className="mr-2 h-4 w-4" />
                    Sync HubSpot Owners & Teams
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
              <div className="text-sm text-gray-600 space-y-3">
                <div>
                  <h4 className="font-medium mb-1">Tasks Sync:</h4>
                  <ul className="space-y-1 ml-2">
                    <li>• Deletes all existing records from hs_tasks table</li>
                    <li>• Fetches non-completed tasks from HubSpot API</li>
                    <li>• Processes 100 records per API call with rate limiting</li>
                    <li>• Handles pagination automatically</li>
                    <li>• Inserts fresh data into the database</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Owners & Teams Sync:</h4>
                  <ul className="space-y-1 ml-2">
                    <li>• Fetches all owners and teams from HubSpot</li>
                    <li>• Updates owner information with team details</li>
                    <li>• Runs automatically every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)</li>
                    <li>• Can be triggered manually using the button above</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Data;