import { useState, useEffect, useMemo } from 'react';
import { realtimeManager, HealthMetrics } from '@/lib/realtimeManager';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const RealtimeStatusIndicator = () => {
  const [allHealth, setAllHealth] = useState<Map<string, HealthMetrics>>(new Map());
  const [isOnline, setIsOnline] = useState(true);
  const [connectionCount, setConnectionCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const health = realtimeManager.getAllHealth();
        const online = realtimeManager.isNetworkOnline();
        const count = realtimeManager.getConnectionCount();
        
        // Validate before setting state
        if (health instanceof Map) {
          setAllHealth(health);
        }
        if (typeof online === 'boolean') {
          setIsOnline(online);
        }
        if (typeof count === 'number') {
          setConnectionCount(count);
        }
      } catch (error) {
        console.error('[RealtimeStatusIndicator] Polling error:', error);
      }
    }, 3000); // Reduced from 1000ms to 3000ms

    return () => clearInterval(interval);
  }, []);

  const getOverallStatus = () => {
    if (!isOnline) return 'offline';
    if (allHealth.size === 0) return 'no-subscriptions';
    
    let hasError = false;
    let hasConnecting = false;
    let allConnected = true;

    allHealth.forEach((health) => {
      if (health.status === 'error' || health.status === 'disconnected') {
        hasError = true;
        allConnected = false;
      }
      if (health.status === 'connecting') {
        hasConnecting = true;
        allConnected = false;
      }
    });

    if (hasError) return 'error';
    if (hasConnecting) return 'connecting';
    if (allConnected) return 'connected';
    return 'unknown';
  };

  const status = useMemo(() => getOverallStatus(), [allHealth, isOnline]);

  // Early return if no subscriptions
  if (connectionCount === 0) {
    return null;
  }

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      case 'offline':
        return 'bg-gray-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'connected':
        return <Wifi className="h-4 w-4" />;
      case 'offline':
        return <WifiOff className="h-4 w-4" />;
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <RefreshCw className="h-4 w-4 animate-spin" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return `Connected (${connectionCount})`;
      case 'connecting':
        return 'Connecting...';
      case 'error':
        return 'Connection issues';
      case 'offline':
        return 'Offline';
      case 'no-subscriptions':
        return 'No subscriptions';
      default:
        return 'Unknown';
    }
  };

  const handleReconnectAll = () => {
    console.log('[RealtimeStatusIndicator] Reconnecting all subscriptions');
    allHealth.forEach((_, channelId) => {
      const health = realtimeManager.getHealth(channelId);
      if (!health.isHealthy) {
        realtimeManager.forceReconnect(channelId);
      }
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 h-8 px-2"
        >
          <div className={`h-2 w-2 rounded-full ${getStatusColor()}`} />
          {getStatusIcon()}
          <span className="text-xs hidden sm:inline">{getStatusText()}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="end">
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Real-time Connection Status</span>
              <Badge variant={status === 'connected' ? 'default' : 'secondary'}>
                {status}
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              {connectionCount} active subscription{connectionCount !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!isOnline && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <WifiOff className="h-4 w-4" />
                <span>Network offline</span>
              </div>
            )}

            {allHealth.size > 0 && (
              <div className="space-y-2">
                {Array.from(allHealth.entries()).map(([channelId, health]) => (
                  <div
                    key={channelId}
                    className="flex items-start justify-between text-xs border-t pt-2"
                  >
                    <div className="flex-1">
                      <div className="font-medium truncate">{channelId}</div>
                      <div className="text-muted-foreground">
                        {health.status} • {health.reconnectAttempts} retries
                      </div>
                      {health.lastError && (
                        <div className="text-destructive text-[10px] mt-1">
                          {health.lastError}
                        </div>
                      )}
                    </div>
                    <Badge
                      variant={health.isHealthy ? 'default' : 'destructive'}
                      className="text-[10px] h-5"
                    >
                      {health.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {allHealth.size === 0 && (
              <div className="text-center text-sm text-muted-foreground py-4">
                No active subscriptions
              </div>
            )}

            {status !== 'connected' && connectionCount > 0 && (
              <Button
                onClick={handleReconnectAll}
                size="sm"
                variant="outline"
                className="w-full"
              >
                <RefreshCw className="h-3 w-3 mr-2" />
                Reconnect All
              </Button>
            )}
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
};
