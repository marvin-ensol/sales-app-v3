import { useState, useEffect, useCallback, useRef } from 'react';
import { realtimeManager, SubscriptionConfig, HealthMetrics } from '@/lib/realtimeManager';

interface UseRealtimeQueryOptions<T> {
  queryKey: string[];
  queryFn: () => Promise<T>;
  subscriptions: SubscriptionConfig[];
  enabled?: boolean;
  debounceMs?: number;
  refetchOnReconnect?: boolean;
  selectiveUpdates?: boolean;
  onError?: (error: Error) => void;
}

interface UseRealtimeQueryResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  forceRefresh: () => void;
  health: HealthMetrics;
  isStale: boolean;
  lastSyncTime: Date | null;
}

export function useRealtimeQuery<T>({
  queryKey,
  queryFn,
  subscriptions,
  enabled = true,
  debounceMs = 300,
  refetchOnReconnect = true,
  selectiveUpdates = false,
  onError,
}: UseRealtimeQueryOptions<T>): UseRealtimeQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [health, setHealth] = useState<HealthMetrics>({
    isHealthy: false,
    lastSuccessfulConnection: null,
    reconnectAttempts: 0,
    lastError: null,
    status: 'disconnected',
  });

  const debounceTimeoutRef = useRef<NodeJS.Timeout>();
  const subscriptionHandleRef = useRef<any>(null);
  const channelId = queryKey.join('_');

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log(`[useRealtimeQuery] Fetching data for ${channelId}`);
      const result = await queryFn();
      
      setData(result);
      setLastSyncTime(new Date());
      console.log(`[useRealtimeQuery] Data fetched successfully for ${channelId}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[useRealtimeQuery] Error fetching data for ${channelId}:`, err);
      setError(errorMessage);
      if (onError) {
        onError(err instanceof Error ? err : new Error(errorMessage));
      }
    } finally {
      setIsLoading(false);
    }
  }, [queryFn, channelId, onError]);

  const debouncedRefetch = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      console.log(`[useRealtimeQuery] Debounced refetch triggered for ${channelId}`);
      fetchData();
    }, debounceMs);
  }, [fetchData, debounceMs, channelId]);

  const handleRealtimeChange = useCallback((payload: any) => {
    console.log(`[useRealtimeQuery] Realtime change detected for ${channelId}:`, payload);
    
    if (selectiveUpdates) {
      // TODO: Implement selective update logic based on payload
      // For now, always refetch
      debouncedRefetch();
    } else {
      debouncedRefetch();
    }
  }, [debouncedRefetch, selectiveUpdates, channelId]);

  useEffect(() => {
    if (!enabled) {
      console.log(`[useRealtimeQuery] Query disabled for ${channelId}`);
      return;
    }

    console.log(`[useRealtimeQuery] Setting up subscription for ${channelId}`);
    
    // Initial fetch
    fetchData();

    // Subscribe to realtime updates
    const handle = realtimeManager.subscribe(
      channelId,
      subscriptions,
      handleRealtimeChange
    );

    subscriptionHandleRef.current = handle;

    // Update health status periodically
    const healthInterval = setInterval(() => {
      const currentHealth = handle.getHealth();
      setHealth(currentHealth);

      // Refetch on reconnect if enabled
      if (refetchOnReconnect && 
          currentHealth.status === 'connected' && 
          currentHealth.lastSuccessfulConnection) {
        const timeSinceReconnect = Date.now() - currentHealth.lastSuccessfulConnection.getTime();
        if (timeSinceReconnect < 1000) {
          console.log(`[useRealtimeQuery] Reconnected - refetching data for ${channelId}`);
          fetchData();
        }
      }
    }, 1000);

    return () => {
      console.log(`[useRealtimeQuery] Cleaning up subscription for ${channelId}`);
      
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      
      clearInterval(healthInterval);
      handle.unsubscribe();
    };
  }, [enabled, channelId, subscriptions, fetchData, handleRealtimeChange, refetchOnReconnect]);

  const refetch = useCallback(() => {
    debouncedRefetch();
  }, [debouncedRefetch]);

  const forceRefresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  const isStale = useCallback(() => {
    if (!lastSyncTime) return false;
    const fiveMinutes = 5 * 60 * 1000;
    return Date.now() - lastSyncTime.getTime() > fiveMinutes;
  }, [lastSyncTime]);

  return {
    data,
    isLoading,
    error,
    refetch,
    forceRefresh,
    health,
    isStale: isStale(),
    lastSyncTime,
  };
}
