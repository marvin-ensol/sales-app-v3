import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ConflictResolutionOptions {
  strategy: 'hubspot-wins' | 'database-wins' | 'merge' | 'prompt-user';
  autoResolve?: boolean;
}

interface SyncConflict {
  id: string;
  type: 'assignment' | 'status' | 'content';
  hubspotValue: any;
  databaseValue: any;
  timestamp: Date;
}

export const useConflictResolution = (options: ConflictResolutionOptions = { strategy: 'hubspot-wins', autoResolve: true }) => {
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [isResolving, setIsResolving] = useState(false);
  const conflictCheckRef = useRef<NodeJS.Timeout | null>(null);

  // Detect conflicts by comparing local and remote data
  const detectConflicts = async (taskId: string) => {
    try {
      console.log('🔍 [CONFLICT] Checking for conflicts for task:', taskId);

      // Get local task data
      const { data: localTask } = await supabase
        .from('hs_tasks')
        .select('*')
        .eq('hs_object_id', taskId)
        .single();

      if (!localTask) return [];

      // For now, we'll simulate conflict detection
      // In a real implementation, you'd compare with HubSpot API data
      const detectedConflicts: SyncConflict[] = [];

      // Check for assignment conflicts (local vs sync metadata)
      // Note: Since we simplified sync_metadata to a single global row,
      // we'll get the general sync status instead of owner-specific data
      const { data: syncMeta } = await supabase
        .from('sync_metadata')
        .select('*')
        .single();

      if (syncMeta && syncMeta.last_sync_timestamp) {
        const lastSync = new Date(syncMeta.last_sync_timestamp);
        const taskUpdated = new Date(localTask.updated_at);

        if (taskUpdated > lastSync) {
          detectedConflicts.push({
            id: `${taskId}-assignment`,
            type: 'assignment',
            hubspotValue: 'unknown', // Would come from HubSpot API
            databaseValue: localTask.hubspot_owner_id,
            timestamp: new Date()
          });
        }
      }

      return detectedConflicts;
    } catch (error) {
      console.error('❌ [CONFLICT] Error detecting conflicts:', error);
      return [];
    }
  };

  // Resolve conflicts based on strategy
  const resolveConflict = async (conflict: SyncConflict) => {
    setIsResolving(true);
    try {
      console.log('🔧 [CONFLICT] Resolving conflict:', conflict);

      switch (options.strategy) {
        case 'hubspot-wins':
          // Update local database with HubSpot value
          console.log('📥 [CONFLICT] HubSpot wins - updating local database');
          break;

        case 'database-wins':
          // Update HubSpot with database value
          console.log('📤 [CONFLICT] Database wins - updating HubSpot');
          break;

        case 'merge':
          // Attempt to merge both values
          console.log('🔀 [CONFLICT] Merging values');
          break;

        case 'prompt-user':
          // Add to conflicts list for user resolution
          setConflicts(prev => [...prev, conflict]);
          return;
      }

      // Remove resolved conflict
      setConflicts(prev => prev.filter(c => c.id !== conflict.id));

    } catch (error) {
      console.error('❌ [CONFLICT] Error resolving conflict:', error);
    } finally {
      setIsResolving(false);
    }
  };

  // Auto-resolve conflicts if enabled
  useEffect(() => {
    if (options.autoResolve && conflicts.length > 0) {
      console.log('🤖 [CONFLICT] Auto-resolving conflicts:', conflicts.length);
      conflicts.forEach(conflict => {
        if (options.strategy !== 'prompt-user') {
          resolveConflict(conflict);
        }
      });
    }
  }, [conflicts, options.autoResolve, options.strategy]);

  // Periodic conflict checking
  useEffect(() => {
    if (options.autoResolve) {
      conflictCheckRef.current = setInterval(() => {
        console.log('⏰ [CONFLICT] Periodic conflict check');
        // This would trigger conflict detection for recently updated tasks
      }, 60000); // Check every minute

      return () => {
        if (conflictCheckRef.current) {
          clearInterval(conflictCheckRef.current);
        }
      };
    }
  }, [options.autoResolve]);

  const manualResolveConflict = (conflictId: string, resolution: 'hubspot' | 'database' | 'custom', customValue?: any) => {
    const conflict = conflicts.find(c => c.id === conflictId);
    if (!conflict) return;

    console.log('👤 [CONFLICT] Manual resolution:', { conflictId, resolution });

    // Apply the manual resolution
    // Implementation would depend on the specific conflict type
    
    // Remove from conflicts list
    setConflicts(prev => prev.filter(c => c.id !== conflictId));
  };

  return {
    conflicts,
    isResolving,
    detectConflicts,
    resolveConflict,
    manualResolveConflict,
    hasConflicts: conflicts.length > 0
  };
};