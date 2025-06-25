import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getTasksFromDatabase(supabase: any, ownerId?: string) {
  console.log(`Fetching tasks from database${ownerId ? ` for owner ${ownerId}` : ''}...`);

  // First, let's get more debugging info about what's in the database
  const { data: allTasks, error: allError } = await supabase
    .from('tasks')
    .select('*');

  if (allError) {
    console.error('Error fetching all tasks for debugging:', allError);
  } else {
    console.log(`DEBUG: Total tasks in database: ${allTasks?.length || 0}`);
    
    // Check owner distribution
    const ownerBreakdown = allTasks?.reduce((acc, task) => {
      const owner = task.owner || 'unassigned';
      acc[owner] = (acc[owner] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};
    
    console.log('DEBUG: Owner breakdown:', ownerBreakdown);
    
    // Check status distribution
    const statusBreakdown = allTasks?.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};
    
    console.log('DEBUG: Status breakdown:', statusBreakdown);
  }

  let query = supabase.from('tasks').select('*');
  
  if (ownerId) {
    // More permissive filtering - let's see what we get
    // Get tasks for this owner OR unassigned new tasks OR tasks from key queues
    query = query.or(`owner.eq.${ownerId},and(queue.eq.new,is_unassigned.eq.true),queue.eq.rappels,queue.eq.attempted`);
    console.log(`DEBUG: Applied owner filter for ${ownerId} with permissive queue filtering`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching tasks from database:', error);
    throw error;
  }

  console.log(`Fetched ${data?.length || 0} tasks from database`);
  
  // Debug the filtered results
  if (data && data.length > 0) {
    const filteredOwnerBreakdown = data.reduce((acc, task) => {
      const owner = task.owner || 'unassigned';
      acc[owner] = (acc[owner] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const filteredQueueBreakdown = data.reduce((acc, task) => {
      acc[task.queue] = (acc[task.queue] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('DEBUG: Filtered results - Owner breakdown:', filteredOwnerBreakdown);
    console.log('DEBUG: Filtered results - Queue breakdown:', filteredQueueBreakdown);
    console.log('DEBUG: Filtered results - Status breakdown:', data.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>));
  }
  
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
      console.log(`DEBUG: Request params - ownerId: ${ownerId}, forceFullSync: ${forceFullSync}`);
    } catch (e) {
      // No body or invalid JSON, continue without owner filter
      console.log('DEBUG: No request body or invalid JSON');
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

    console.log(`DEBUG: Returning ${responseTasks.length} tasks to frontend`);

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
