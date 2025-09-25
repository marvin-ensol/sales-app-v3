import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';

interface PerformanceIndicatorProps {
  loading: boolean;
  taskCount: number;
  mode: 'database' | 'api' | 'text';
}

export const PerformanceIndicator = ({ loading, taskCount, mode }: PerformanceIndicatorProps) => {
  const [loadTime, setLoadTime] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);

  useEffect(() => {
    if (loading && !startTime) {
      setStartTime(Date.now());
      setLoadTime(null);
    }
    
    if (!loading && startTime) {
      const endTime = Date.now();
      setLoadTime(endTime - startTime);
      setStartTime(null);
    }
  }, [loading, startTime]);

  const getBadgeVariant = () => {
    if (mode === 'database') return 'default';
    return 'secondary';
  };

  const getModeLabel = () => {
    return mode === 'database' ? 'Database Direct' : 'HubSpot API';
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      {mode !== 'text' && (
        <Badge variant={getBadgeVariant()}>
          {getModeLabel()}
        </Badge>
      )}
      
      {loading && (
        <span className="text-muted-foreground">Loading...</span>
      )}
      
      {!loading && loadTime && (
        <span className="text-muted-foreground">
          {taskCount} tasks • {loadTime}ms
        </span>
      )}
      
      {!loading && !loadTime && taskCount > 0 && (
        <span className="text-muted-foreground">
          {taskCount} tasks
        </span>
      )}
    </div>
  );
};