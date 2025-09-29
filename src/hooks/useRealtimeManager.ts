import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RealtimeSubscription {
  id: string;
  callback: () => void;
  tables: string[];
  filters?: Record<string, string>;
}

interface RealtimeManagerOptions {
  debug?: boolean;
}

export const useRealtimeManager = ({ debug = true }: RealtimeManagerOptions = {}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const subscriptionsRef = useRef<Map<string, RealtimeSubscription>>(new Map());
  const channelRef = useRef<any>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const log = useCallback((...args: any[]) => {
    if (debug) {
      console.log('🔄 [REALTIME]', ...args);
    }
  }, [debug]);

  // Debounced update function to prevent rapid-fire updates
  const debouncedUpdate = useCallback((subscriptionId: string, delay = 500) => {
    const subscription = subscriptionsRef.current.get(subscriptionId);
    if (!subscription) return;

    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    setIsUpdating(true);
    log(`Debounced update triggered for ${subscriptionId}`);

    updateTimeoutRef.current = setTimeout(() => {
      try {
        subscription.callback();
        setLastUpdateTime(new Date());
      } catch (error) {
        console.error('Error executing real-time callback:', error);
      } finally {
        setIsUpdating(false);
      }
    }, delay);
  }, [log]);

  // Handle real-time changes
  const handleRealtimeChange = useCallback((payload: any) => {
    const { eventType, table, new: newRecord, old: oldRecord } = payload;
    
    log('Change detected:', { eventType, table, recordId: newRecord?.id || oldRecord?.id });

    // Trigger updates for relevant subscriptions
    subscriptionsRef.current.forEach((subscription, id) => {
      if (subscription.tables.includes(table)) {
        // Check filters if any
        if (subscription.filters) {
          let shouldUpdate = true;
          
          for (const [field, value] of Object.entries(subscription.filters)) {
            const recordValue = newRecord?.[field] || oldRecord?.[field];
            if (recordValue !== value) {
              shouldUpdate = false;
              break;
            }
          }
          
          if (shouldUpdate) {
            debouncedUpdate(id);
          }
        } else {
          // No filters, always update
          debouncedUpdate(id);
        }
      }
    });
  }, [debouncedUpdate, log]);

  // Set up the consolidated channel
  const setupChannel = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    log('Setting up consolidated real-time channel');

    channelRef.current = supabase
      .channel('consolidated_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hs_tasks'
        },
        (payload) => handleRealtimeChange({ ...payload, table: 'hs_tasks' })
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hs_contacts'
        },
        (payload) => handleRealtimeChange({ ...payload, table: 'hs_contacts' })
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hs_users'
        },
        (payload) => handleRealtimeChange({ ...payload, table: 'hs_users' })
      )
      .subscribe((status) => {
        log('Subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
      });
  }, [handleRealtimeChange, log]);

  // Register a subscription
  const subscribe = useCallback((
    id: string,
    callback: () => void,
    tables: string[],
    filters?: Record<string, string>
  ) => {
    log(`Registering subscription: ${id} for tables: ${tables.join(', ')}`);
    
    subscriptionsRef.current.set(id, {
      id,
      callback,
      tables,
      filters
    });

    // Set up channel if it's the first subscription
    if (subscriptionsRef.current.size === 1) {
      setupChannel();
    }

    return () => {
      log(`Unregistering subscription: ${id}`);
      subscriptionsRef.current.delete(id);
      
      // Clean up channel if no more subscriptions
      if (subscriptionsRef.current.size === 0 && channelRef.current) {
        log('No more subscriptions, cleaning up channel');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        setIsConnected(false);
      }
    };
  }, [setupChannel, log]);

  // Force refresh all subscriptions
  const forceRefresh = useCallback(() => {
    log('Force refresh triggered');
    setIsUpdating(true);
    
    subscriptionsRef.current.forEach((subscription) => {
      try {
        subscription.callback();
      } catch (error) {
        console.error('Error executing force refresh callback:', error);
      }
    });
    
    setLastUpdateTime(new Date());
    setTimeout(() => setIsUpdating(false), 1000);
  }, [log]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  return {
    subscribe,
    forceRefresh,
    isConnected,
    isUpdating,
    lastUpdateTime,
    subscriptionCount: subscriptionsRef.current.size
  };
};