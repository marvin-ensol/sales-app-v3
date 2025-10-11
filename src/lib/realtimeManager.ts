import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface SubscriptionConfig {
  schema: string;
  table: string;
  event: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  filter?: string;
}

interface HealthMetrics {
  isHealthy: boolean;
  lastSuccessfulConnection: Date | null;
  reconnectAttempts: number;
  lastError: string | null;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
}

interface SubscriptionHandle {
  id: string;
  unsubscribe: () => void;
  getHealth: () => HealthMetrics;
  forceReconnect: () => void;
}

type ChangeCallback = (payload: any) => void;

class RealtimeManager {
  private static instance: RealtimeManager;
  private channels: Map<string, RealtimeChannel> = new Map();
  private subscriptionHealth: Map<string, HealthMetrics> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private reconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private isOnline: boolean = true;
  private callbacks: Map<string, Set<ChangeCallback>> = new Map();

  private constructor() {
    this.setupNetworkListeners();
  }

  static getInstance(): RealtimeManager {
    if (!RealtimeManager.instance) {
      RealtimeManager.instance = new RealtimeManager();
    }
    return RealtimeManager.instance;
  }

  private setupNetworkListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      console.log('[RealtimeManager] Network online - resuming subscriptions');
      this.isOnline = true;
      this.resumeAll();
    });

    window.addEventListener('offline', () => {
      console.log('[RealtimeManager] Network offline - pausing subscriptions');
      this.isOnline = false;
      this.updateAllHealthStatus('disconnected');
    });
  }

  subscribe(
    channelId: string,
    configs: SubscriptionConfig[],
    callback: ChangeCallback
  ): SubscriptionHandle {
    console.log(`[RealtimeManager] Subscribing to channel: ${channelId}`);

    // Add callback to set
    if (!this.callbacks.has(channelId)) {
      this.callbacks.set(channelId, new Set());
    }
    this.callbacks.get(channelId)!.add(callback);

    // Create or reuse channel
    if (!this.channels.has(channelId)) {
      this.createChannel(channelId, configs);
    }

    // Initialize health metrics
    if (!this.subscriptionHealth.has(channelId)) {
      this.subscriptionHealth.set(channelId, {
        isHealthy: false,
        lastSuccessfulConnection: null,
        reconnectAttempts: 0,
        lastError: null,
        status: 'connecting',
      });
    }

    return {
      id: channelId,
      unsubscribe: () => this.unsubscribe(channelId, callback),
      getHealth: () => this.getHealth(channelId),
      forceReconnect: () => this.forceReconnect(channelId),
    };
  }

  private createChannel(channelId: string, configs: SubscriptionConfig[]) {
    const channel = supabase.channel(channelId);

    // Add all subscription configs
    configs.forEach((config) => {
      const pgConfig: any = {
        event: config.event,
        schema: config.schema,
        table: config.table,
      };
      
      if (config.filter) {
        pgConfig.filter = config.filter;
      }

      channel.on(
        'postgres_changes' as any,
        pgConfig,
        (payload: any) => {
          console.log(`[RealtimeManager] Change detected on ${config.table}:`, payload);
          this.handleChange(channelId, payload);
        }
      );
    });

    // Subscribe with status callback
    channel.subscribe((status: string) => {
      console.log(`[RealtimeManager] Subscription status for ${channelId}:`, status);
      this.handleStatusChange(channelId, status);
    });

    this.channels.set(channelId, channel);
  }

  private handleChange(channelId: string, payload: any) {
    const callbacks = this.callbacks.get(channelId);
    if (callbacks) {
      callbacks.forEach((callback) => callback(payload));
    }
  }

  private handleStatusChange(channelId: string, status: string) {
    const health = this.subscriptionHealth.get(channelId);
    if (!health) return;

    switch (status) {
      case 'SUBSCRIBED':
        health.isHealthy = true;
        health.lastSuccessfulConnection = new Date();
        health.reconnectAttempts = 0;
        health.status = 'connected';
        health.lastError = null;
        this.reconnectAttempts.set(channelId, 0);
        break;

      case 'CHANNEL_ERROR':
      case 'TIMED_OUT':
      case 'CLOSED':
        health.isHealthy = false;
        health.status = 'error';
        health.lastError = `Subscription error: ${status}`;
        this.scheduleReconnect(channelId);
        break;

      case 'SUBSCRIPTION_ERROR':
        health.isHealthy = false;
        health.status = 'error';
        health.lastError = 'Failed to subscribe';
        this.scheduleReconnect(channelId);
        break;
    }

    this.subscriptionHealth.set(channelId, health);
  }

  private scheduleReconnect(channelId: string) {
    if (!this.isOnline) return;

    const attempts = this.reconnectAttempts.get(channelId) || 0;
    
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
    const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
    
    console.log(`[RealtimeManager] Scheduling reconnect for ${channelId} in ${delay}ms (attempt ${attempts + 1})`);
    
    // Clear existing timeout
    const existingTimeout = this.reconnectTimeouts.get(channelId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      console.log(`[RealtimeManager] Attempting reconnect for ${channelId}`);
      this.reconnectAttempts.set(channelId, attempts + 1);
      this.forceReconnect(channelId);
    }, delay);

    this.reconnectTimeouts.set(channelId, timeout);
  }

  unsubscribe(channelId: string, callback: ChangeCallback) {
    console.log(`[RealtimeManager] Unsubscribing callback from channel: ${channelId}`);
    
    const callbacks = this.callbacks.get(channelId);
    if (callbacks) {
      callbacks.delete(callback);
      
      // If no more callbacks, remove channel
      if (callbacks.size === 0) {
        this.removeChannel(channelId);
      }
    }
  }

  private removeChannel(channelId: string) {
    console.log(`[RealtimeManager] Removing channel: ${channelId}`);
    
    const channel = this.channels.get(channelId);
    if (channel) {
      supabase.removeChannel(channel);
      this.channels.delete(channelId);
    }

    this.subscriptionHealth.delete(channelId);
    this.reconnectAttempts.delete(channelId);
    this.callbacks.delete(channelId);
    
    const timeout = this.reconnectTimeouts.get(channelId);
    if (timeout) {
      clearTimeout(timeout);
      this.reconnectTimeouts.delete(channelId);
    }
  }

  getHealth(channelId: string): HealthMetrics {
    return this.subscriptionHealth.get(channelId) || {
      isHealthy: false,
      lastSuccessfulConnection: null,
      reconnectAttempts: 0,
      lastError: 'Channel not found',
      status: 'disconnected',
    };
  }

  forceReconnect(channelId: string) {
    console.log(`[RealtimeManager] Force reconnecting channel: ${channelId}`);
    
    const callbacks = this.callbacks.get(channelId);
    if (!callbacks || callbacks.size === 0) return;

    // Store configs before removing
    const channel = this.channels.get(channelId);
    if (!channel) return;

    // Remove old channel
    supabase.removeChannel(channel);
    this.channels.delete(channelId);

    // Recreate with stored callbacks
    const configs: SubscriptionConfig[] = [
      { schema: 'public', table: 'hs_tasks', event: '*' },
      { schema: 'public', table: 'hs_contacts', event: '*' },
    ];

    this.createChannel(channelId, configs);
  }

  pauseAll() {
    console.log('[RealtimeManager] Pausing all subscriptions');
    this.channels.forEach((channel, channelId) => {
      supabase.removeChannel(channel);
    });
    this.updateAllHealthStatus('disconnected');
  }

  resumeAll() {
    console.log('[RealtimeManager] Resuming all subscriptions');
    this.channels.forEach((_, channelId) => {
      this.forceReconnect(channelId);
    });
  }

  private updateAllHealthStatus(status: HealthMetrics['status']) {
    this.subscriptionHealth.forEach((health) => {
      health.status = status;
      health.isHealthy = status === 'connected';
    });
  }

  getAllHealth(): Map<string, HealthMetrics> {
    return new Map(this.subscriptionHealth);
  }

  getConnectionCount(): number {
    return this.channels.size;
  }

  isNetworkOnline(): boolean {
    return this.isOnline;
  }
}

export const realtimeManager = RealtimeManager.getInstance();
export type { SubscriptionConfig, HealthMetrics, SubscriptionHandle };
