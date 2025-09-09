import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Database, Download, Users, CheckCircle, Clock, XCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";


interface SyncOperation {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  message?: string;
  count?: number;
}

interface SyncProgress {
  phase: 'idle' | 'clearing' | 'fetching' | 'processing' | 'complete' | 'error';
  operations: SyncOperation[];
  currentOperation?: string;
  message: string;
  error?: string;
}

const Data = () => {
  const initialOperations: SyncOperation[] = [
    { id: 'tasks', name: 'Fetching Tasks', status: 'pending' },
    { id: 'associations', name: 'Task Associations', status: 'pending' },
    { id: 'contacts', name: 'Fetching Contacts', status: 'pending' },
    { id: 'database', name: 'Writing to Database', status: 'pending' }
  ];

  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    phase: 'idle',
    operations: initialOperations,
    message: 'Ready to sync data'
  });
  const [isRunning, setIsRunning] = useState(false);
  const [isOwnersSyncing, setIsOwnersSyncing] = useState(false);
  const { toast } = useToast();

  const handleSyncData = async () => {
    setIsRunning(true);
    setSyncProgress({
      phase: 'clearing',
      operations: initialOperations,
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
              
              // Convert legacy progress format to new operation format
              if (data.progress !== undefined) {
                const updatedOperations = [...initialOperations];
                
                if (data.phase === 'clearing') {
                  // Do nothing, keep all pending
                } else if (data.phase === 'fetching') {
                  updatedOperations[0].status = 'running';
                  updatedOperations[0].message = data.message;
                } else if (data.phase === 'processing') {
                  updatedOperations[0].status = 'complete';
                  updatedOperations[0].count = data.totalRecords;
                  updatedOperations[1].status = 'running';
                  updatedOperations[1].message = 'Processing associations...';
                  updatedOperations[2].status = 'running';
                  updatedOperations[2].message = 'Processing contacts...';
                } else if (data.phase === 'complete') {
                  updatedOperations.forEach(op => {
                    if (op.status !== 'complete') {
                      op.status = 'complete';
                    }
                  });
                  updatedOperations[3].status = 'complete';
                  updatedOperations[3].message = 'Database updated successfully';
                }

                setSyncProgress({
                  phase: data.phase,
                  operations: updatedOperations,
                  message: data.message,
                  currentOperation: data.phase
                });
              } else {
                setSyncProgress(data);
              }
              
              if (data.phase === 'complete') {
                toast({
                  title: "Sync Complete",
                  description: `Successfully synced HubSpot data`,
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
      const errorOperations = syncProgress.operations.map(op => ({
        ...op,
        status: op.status === 'running' ? ('error' as const) : op.status
      }));
      
      setSyncProgress({
        phase: 'error',
        operations: errorOperations,
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
        title: "Users Sync Complete",
        description: `Successfully synced ${response.data.stats?.users_processed || 0} users and ${response.data.stats?.teams_fetched || 0} teams`,
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

  const getStatusIcon = (status: SyncOperation['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-400" />;
      case 'running':
        return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'complete':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: SyncOperation['status']) => {
    switch (status) {
      case 'pending':
        return 'text-gray-500';
      case 'running':
        return 'text-blue-600 font-medium';
      case 'complete':
        return 'text-green-600 font-medium';
      case 'error':
        return 'text-red-600 font-medium';
      default:
        return 'text-gray-500';
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
                <div className="flex items-center gap-2 mb-4">
                  <span className="font-medium">{syncProgress.message}</span>
                </div>
                
                {/* Operations Status List */}
                <div className="space-y-3">
                  {syncProgress.operations.map((operation) => (
                    <div key={operation.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(operation.status)}
                        <div>
                          <div className={`font-medium ${getStatusColor(operation.status)}`}>
                            {operation.name}
                          </div>
                          {operation.message && (
                            <div className="text-sm text-gray-500">
                              {operation.message}
                            </div>
                          )}
                        </div>
                      </div>
                      {operation.count && (
                        <div className="text-sm text-gray-500">
                          {operation.count} records
                        </div>
                      )}
                    </div>
                  ))}
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
                HubSpot Users & Teams Sync
              </CardTitle>
              <CardDescription>
                Update user and team information from HubSpot. This runs automatically every 6 hours but can be triggered manually.
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
                    Syncing Users & Teams...
                  </>
                ) : (
                  <>
                    <Users className="mr-2 h-4 w-4" />
                    Sync HubSpot Users & Teams
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
                  <h4 className="font-medium mb-1">Tasks Sync Operations:</h4>
                  <ul className="space-y-1 ml-2">
                    <li>• <strong>Tasks:</strong> Fetches non-completed tasks from HubSpot API</li>
                    <li>• <strong>Associations:</strong> Links tasks to contacts and companies</li>
                    <li>• <strong>Contacts:</strong> Fetches associated contact information</li>
                    <li>• <strong>Database:</strong> Clears old data and inserts fresh records</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Users & Teams Sync:</h4>
                  <ul className="space-y-1 ml-2">
                    <li>• Fetches all users and teams from HubSpot</li>
                    <li>• Updates user information with team details</li>
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
