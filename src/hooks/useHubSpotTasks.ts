
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Task } from '@/types/task';

export const useHubSpotTasks = (selectedOwnerId: string) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isVisibleRef = useRef(true);

  // Track page visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;
      console.log('Page visibility changed:', isVisibleRef.current ? 'visible' : 'hidden');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const fetchTasks = async (ownerId: string, retryCount = 0) => {
    // Don't make API calls if the app isn't visible
    if (!isVisibleRef.current) {
      console.log('Skipping API call - app not visible');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching tasks from HubSpot for owner:', ownerId);
      
      // Add a small delay to avoid burst calling if this is part of multiple calls
      if (retryCount > 0) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff, max 10s
        console.log(`Retrying after ${delay}ms delay (attempt ${retryCount + 1})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      const { data, error: functionError } = await supabase.functions.invoke('fetch-hubspot-tasks', {
        body: { ownerId }
      });
      
      console.log('Raw response:', { data, functionError });
      
      if (functionError) {
        console.error('Supabase function error:', functionError);
        throw new Error(`Function call failed: ${functionError.message}`);
      }
      
      if (data?.error) {
        console.error('HubSpot API error:', data.error);
        
        // Handle rate limiting with exponential backoff
        if (data.error.includes('429') || data.error.includes('rate limit')) {
          if (retryCount < 3) {
            console.log(`Rate limited, retrying in ${Math.pow(2, retryCount + 1)} seconds...`);
            return fetchTasks(ownerId, retryCount + 1);
          }
        }
        
        throw new Error(`HubSpot API error: ${data.error}`);
      }
      
      if (!data?.success) {
        console.error('Function returned unsuccessful response:', data);
        throw new Error('Failed to fetch tasks from HubSpot');
      }
      
      console.log('Tasks received successfully:', data?.tasks?.length || 0);
      setTasks(data?.tasks || []);
      
    } catch (err) {
      console.error('Error fetching HubSpot tasks:', err);
      let errorMessage = 'Failed to fetch tasks';
      
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedOwnerId) {
      console.log('Owner ID changed, fetching tasks for:', selectedOwnerId);
      fetchTasks(selectedOwnerId);
      
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      // Set up polling every 20 seconds (reduced from 30)
      intervalRef.current = setInterval(() => {
        if (isVisibleRef.current) {
          fetchTasks(selectedOwnerId);
        } else {
          console.log('Skipping scheduled fetch - app not visible');
        }
      }, 20000);
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    } else {
      console.log('No owner selected, clearing tasks');
      setTasks([]);
      setLoading(false);
      setError(null);
      
      // Clear interval when no owner is selected
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
  }, [selectedOwnerId]);

  const refetch = () => {
    if (selectedOwnerId && isVisibleRef.current) {
      fetchTasks(selectedOwnerId);
    }
  };

  return {
    tasks,
    loading,
    error,
    refetch
  };
};
