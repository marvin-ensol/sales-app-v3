import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { taskId } = await req.json();
    
    if (!taskId) {
      return new Response(
        JSON.stringify({ error: 'taskId is required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    const hubspotToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN');
    if (!hubspotToken) {
      console.error('HUBSPOT_ACCESS_TOKEN is not configured');
      return new Response(
        JSON.stringify({ error: 'HubSpot access token not configured' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

    console.log(`Attempting to delete task ${taskId} from HubSpot`);

    // Try to delete the task from HubSpot
    const deleteUrl = `https://api.hubapi.com/crm/v3/objects/tasks/${taskId}`;
    const deleteResponse = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${hubspotToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (deleteResponse.status === 404) {
      // Task already deleted in HubSpot, mark as deleted in our database
      console.log(`Task ${taskId} already deleted in HubSpot, updating local database`);
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const { error: updateError } = await supabase
        .from('hs_tasks')
        .update({ hs_task_status: 'DELETED' })
        .eq('hs_object_id', taskId);
      
      if (updateError) {
        console.error('Error updating task status:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update task status' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        );
      }
      
      return new Response(
        JSON.stringify({ success: true, message: 'Task marked as deleted' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      console.error(`HubSpot delete failed with status ${deleteResponse.status}:`, errorText);
      
      return new Response(
        JSON.stringify({ error: `HubSpot API error: ${deleteResponse.status}` }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Success - task deleted from HubSpot
    console.log(`Task ${taskId} successfully deleted from HubSpot`);
    
    return new Response(
      JSON.stringify({ success: true, message: 'Task deleted successfully' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in delete-hubspot-task function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});