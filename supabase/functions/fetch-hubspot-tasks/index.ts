
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ownerId } = await req.json();
    
    if (!ownerId) {
      console.error('Owner ID is required');
      return new Response(
        JSON.stringify({ error: 'Owner ID is required', success: false }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`🔄 [DATABASE] Fetching tasks for owner ${ownerId} from local database...`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Call the database function to get enriched tasks
    const { data: tasks, error: dbError } = await supabase.rpc('get_owner_tasks', {
      owner_id_param: ownerId
    });

    if (dbError) {
      console.error('Database query error:', dbError);
      return new Response(
        JSON.stringify({ 
          error: `Database query failed: ${dbError.message}`, 
          success: false 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`✅ [DATABASE] Successfully fetched ${tasks?.length || 0} tasks from database`);

    // Transform database result to match expected API format
    const transformedTasks = (tasks || []).map(task => ({
      id: task.id,
      title: task.title || 'Untitled Task',
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
      queueIds: task.queue_ids || [],
      isUnassigned: task.is_unassigned,
      completionDate: task.completion_date
    }));

    // Log performance metrics
    console.log(`📊 [PERFORMANCE] Database query completed - ${tasks?.length || 0} tasks processed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        tasks: transformedTasks,
        source: 'database',
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ [ERROR] Edge function error:', error);
    return new Response(
      JSON.stringify({ 
        error: `Edge function failed: ${error.message}`, 
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
