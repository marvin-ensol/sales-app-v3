
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getTasksFromDatabase(supabase: any, ownerId?: string) {
  console.log(`Fetching tasks from database${ownerId ? ` for owner ${ownerId}` : ''}...`);

  let query = supabase.from('tasks').select('*');
  
  if (ownerId) {
    // Get tasks that are either assigned to this owner or unassigned new tasks
    query = query.or(`owner.eq.${ownerId},and(queue.eq.new,is_unassigned.eq.true)`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching tasks from database:', error);
    throw error;
  }

  console.log(`Fetched ${data?.length || 0} tasks from database`);
  return data || [];
}

async function forceRefreshSync(supabase: any) {
  console.log('Triggering force refresh via background sync...');
  
  try {
    // Call the background sync function to force a refresh
    const { data, error } = await supabase.functions.invoke('background-task-sync', {
      body: { forceRefresh: true }
    });
    
    if (error) {
      console.error('Error calling background sync for force refresh:', error);
      throw error;
    }
    
    console.log('Force refresh completed via background sync');
    return data;
  } catch (error) {
    console.error('Force refresh failed:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Starting HubSpot tasks fetch from cache...')
    
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let ownerId = null
    let forceFullSync = false
    try {
      const body = await req.json()
      ownerId = body?.ownerId
      forceFullSync = body?.forceFullSync || false
    } catch (e) {
      // No body or invalid JSON, continue without owner filter
    }

    // If force refresh is requested, trigger background sync first
    if (forceFullSync) {
      try {
        await forceRefreshSync(supabase);
        // Add a small delay to allow the background sync to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('Force refresh failed, continuing with cached data:', error);
      }
    }

    // Always get data from database cache
    const cachedTasks = await getTasksFromDatabase(supabase, ownerId);

    // Convert cached data to API response format
    const responseTasks = cachedTasks.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      contact: task.contact,
      contactId: task.contact_id,
      contactPhone: task.contact_phone,
      status: task.status,
      dueDate: task.due_date,
      priority: task.priority,
      owner: task.owner,
      hubspotId: task.hubspot_id,
      queue: task.queue,
      queueIds: task.queue_ids,
      isUnassigned: task.is_unassigned,
      completionDate: task.completion_date ? new Date(task.completion_date) : null
    }));

    return new Response(
      JSON.stringify({ 
        tasks: responseTasks,
        total: responseTasks.length,
        success: true,
        source: 'cache',
        sync_type: forceFullSync ? 'force_refresh' : 'cache'
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error in fetch-hubspot-tasks function:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error occurred',
        tasks: [],
        total: 0,
        success: false
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})
