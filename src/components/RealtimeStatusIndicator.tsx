import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Wifi, WifiOff, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RealtimeStatusIndicatorProps {
  isConnected: boolean;
  isUpdating: boolean;
  lastUpdateTime?: Date | null;
  onForceRefresh?: () => void;
  className?: string;
  showDetails?: boolean;
}

export const RealtimeStatusIndicator: React.FC<RealtimeStatusIndicatorProps> = ({
  isConnected,
  isUpdating,
  lastUpdateTime,
  onForceRefresh,
  className,
  showDetails = true
}) => {
  const formatLastUpdate = () => {
    if (!lastUpdateTime) return 'Never';
    
    const now = new Date();
    const diff = now.getTime() - lastUpdateTime.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return lastUpdateTime.toLocaleDateString();
  };

  const getStatusColor = () => {
    if (isUpdating) return 'bg-blue-500';
    if (isConnected) return 'bg-green-500';
    return 'bg-red-500';
  };

  const getStatusText = () => {
    if (isUpdating) return 'Updating...';
    if (isConnected) return 'Live';
    return 'Disconnected';
  };

  const getStatusIcon = () => {
    if (isUpdating) return <RefreshCw className="w-3 h-3 animate-spin" />;
    if (isConnected) return <Wifi className="w-3 h-3" />;
    return <WifiOff className="w-3 h-3" />;
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Status Badge */}
      <Badge 
        variant="outline" 
        className={cn(
          "flex items-center gap-1 text-white border-0",
          getStatusColor()
        )}
      >
        {getStatusIcon()}
        {showDetails && (
          <span className="text-xs">{getStatusText()}</span>
        )}
      </Badge>
      
      {/* Last Update Time */}
      {showDetails && lastUpdateTime && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>{formatLastUpdate()}</span>
        </div>
      )}
      
      {/* Force Refresh Button */}
      {onForceRefresh && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onForceRefresh}
          disabled={isUpdating}
          className="h-6 w-6 p-0"
        >
          <RefreshCw className={cn(
            "w-3 h-3",
            isUpdating && "animate-spin"
          )} />
        </Button>
      )}
    </div>
  );
};