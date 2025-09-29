import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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
      console.error('Missing taskId in request body');
      return new Response(
        JSON.stringify({ error: 'Missing taskId' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`Completing task with ID: ${taskId}`);

    const hubspotToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN');
    if (!hubspotToken) {
      console.error('HUBSPOT_ACCESS_TOKEN environment variable not set');
      return new Response(
        JSON.stringify({ error: 'HubSpot token not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Update task status in HubSpot
    const hubspotResponse = await fetch(
      `https://api.hubapi.com/crm/v3/objects/tasks/${taskId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${hubspotToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: {
            hs_task_status: 'COMPLETED'
          }
        })
      }
    );

    if (!hubspotResponse.ok) {
      const errorData = await hubspotResponse.text();
      console.error('HubSpot API error:', errorData);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to complete task in HubSpot',
          details: errorData 
        }),
        { 
          status: hubspotResponse.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const completedTask = await hubspotResponse.json();
    console.log('Task completed successfully in HubSpot:', completedTask.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        taskId: completedTask.id,
        message: 'Task completed successfully' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in complete-hubspot-task function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});