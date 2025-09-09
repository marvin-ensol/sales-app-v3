import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Clock, Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';

interface RealTimeStatusProps {
  isConnected: boolean;
  lastSyncTime: Date | null;
  isStale: boolean;
  conflictCount?: number;
  onForceRefresh: () => void;
  onResolveConflicts?: () => void;
}

export const RealTimeStatus = ({ 
  isConnected, 
  lastSyncTime, 
  isStale, 
  conflictCount = 0,
  onForceRefresh,
  onResolveConflicts 
}: RealTimeStatusProps) => {
  const [showDetails, setShowDetails] = useState(false);
  
  const getConnectionStatus = () => {
    if (!isConnected) return { color: 'destructive', icon: WifiOff, label: 'Disconnected' };
    if (isStale) return { color: 'secondary', icon: Clock, label: 'Stale Data' };
    return { color: 'default', icon: Wifi, label: 'Live' };
  };

  const formatLastSync = () => {
    if (!lastSyncTime) return 'Never';
    
    const now = new Date();
    const diff = now.getTime() - lastSyncTime.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes === 0) return 'Just now';
    if (minutes === 1) return '1 minute ago';
    if (minutes < 60) return `${minutes} minutes ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    return `${hours} hours ago`;
  };

  const status = getConnectionStatus();
  const StatusIcon = status.icon;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge 
          variant={status.color as any}
          className="flex items-center gap-1"
        >
          <StatusIcon className="h-3 w-3" />
          {status.label}
        </Badge>
        
        {conflictCount > 0 && (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {conflictCount} conflicts
          </Badge>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs"
        >
          {showDetails ? 'Hide' : 'Details'}
        </Button>
      </div>

      {showDetails && (
        <Card className="w-80">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <StatusIcon className="h-4 w-4" />
              Real-time Status
            </CardTitle>
            <CardDescription className="text-xs">
              Database synchronization status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="font-medium">Connection</div>
                <div className="text-muted-foreground">
                  {isConnected ? 'Active' : 'Disconnected'}
                </div>
              </div>
              <div>
                <div className="font-medium">Last Sync</div>
                <div className="text-muted-foreground">
                  {formatLastSync()}
                </div>
              </div>
            </div>

            {isStale && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Data may be outdated. Consider refreshing.
                </AlertDescription>
              </Alert>
            )}

            {conflictCount > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {conflictCount} sync conflicts detected that need resolution.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onForceRefresh}
                className="flex-1 text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Force Refresh
              </Button>
              
              {conflictCount > 0 && onResolveConflicts && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={onResolveConflicts}
                  className="flex-1 text-xs"
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Resolve Conflicts
                </Button>
              )}
            </div>

            <div className="text-xs text-muted-foreground">
              <div className="flex items-center gap-1 mb-1">
                <CheckCircle className="h-3 w-3" />
                Database-first architecture active
              </div>
              <div>Real-time updates enabled via Supabase subscriptions</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};