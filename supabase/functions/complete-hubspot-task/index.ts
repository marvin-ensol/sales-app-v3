import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CompletionRequest {
  hubspot_id: string;
  task_id: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { hubspot_id, task_id }: CompletionRequest = await req.json();

    if (!hubspot_id || !task_id) {
      throw new Error('Missing required parameters: hubspot_id and task_id');
    }

    console.log(`🎯 Completing task: ${task_id} (HubSpot ID: ${hubspot_id})`);

    // Get HubSpot API token from secrets
    const hubspotToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN');
    if (!hubspotToken) {
      throw new Error('HubSpot access token not configured');
    }

    // Update task in HubSpot
    const hubspotUrl = `https://api.hubapi.com/crm/v3/objects/tasks/${hubspot_id}`;
    
    const hubspotResponse = await fetch(hubspotUrl, {
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
    });

    if (!hubspotResponse.ok) {
      const errorText = await hubspotResponse.text();
      console.error('HubSpot API error:', errorText);
      throw new Error(`HubSpot API error: ${hubspotResponse.status} - ${errorText}`);
    }

    const hubspotData = await hubspotResponse.json();
    console.log('✅ Task completed in HubSpot:', hubspotData);

    // Update local database to trigger real-time updates
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: dbError } = await supabase
      .from('hs_tasks')
      .update({
        hs_task_status: 'COMPLETED',
        hs_task_completion_date: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('hs_object_id', hubspot_id);

    if (dbError) {
      console.error('Database update error:', dbError);
      // Don't throw here as HubSpot update was successful
    } else {
      console.log('✅ Task status updated in database');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        hubspot_id,
        task_id,
        message: 'Task completed successfully'
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json'
        } 
      }
    );

  } catch (error) {
    console.error('Error completing task:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        success: false
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json'
        }
      }
    );
  }
});