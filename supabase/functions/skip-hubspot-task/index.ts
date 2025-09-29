import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SkipRequest {
  hubspot_id: string;
  task_id: string;
  task_title: string;
}

// Background function to refresh team statistics
async function refreshTeamStats(teamId: string) {
  try {
    console.log(`🔄 Triggering background team stats refresh for team: ${teamId}...`);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Call team-task-summary function with proper team_id
    const { error } = await supabase.functions.invoke('team-task-summary', {
      body: {
        team_id: teamId
      }
    });
    
    if (error) {
      console.error('Error refreshing team stats:', error);
    } else {
      console.log('✅ Team stats refresh triggered successfully');
    }
  } catch (error) {
    console.error('Background team stats refresh failed:', error);
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { hubspot_id, task_id, task_title }: SkipRequest = await req.json();

    if (!hubspot_id || !task_id || !task_title) {
      throw new Error('Missing required parameters: hubspot_id, task_id, and task_title');
    }

    console.log(`🦘 Skipping task: ${task_id} (HubSpot ID: ${hubspot_id})`);

    // Get HubSpot API token from secrets
    const hubspotToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN');
    if (!hubspotToken) {
      throw new Error('HubSpot access token not configured');
    }

    // Create the new task title with [Sautée] suffix
    const skippedTitle = `${task_title} [Sautée]`;

    // Update task in HubSpot - mark as completed with modified title
    const hubspotUrl = `https://api.hubapi.com/crm/v3/objects/tasks/${hubspot_id}`;
    
    const hubspotResponse = await fetch(hubspotUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${hubspotToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          hs_task_status: 'COMPLETED',
          hs_task_subject: skippedTitle
        }
      })
    });

    if (!hubspotResponse.ok) {
      const errorText = await hubspotResponse.text();
      console.error('HubSpot API error:', errorText);
      throw new Error(`HubSpot API error: ${hubspotResponse.status} - ${errorText}`);
    }

    const hubspotData = await hubspotResponse.json();
    console.log('✅ Task skipped in HubSpot:', hubspotData);

    // Update local database to trigger real-time updates
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // First fetch the task to get the team ID
    const { data: taskData, error: fetchError } = await supabase
      .from('hs_tasks')
      .select('hubspot_team_id')
      .eq('hs_object_id', hubspot_id)
      .single();

    if (fetchError) {
      console.error('Error fetching task for team ID:', fetchError);
    }

    const { error: dbError } = await supabase
      .from('hs_tasks')
      .update({
        hs_task_status: 'COMPLETED',
        hs_task_subject: skippedTitle,
        hs_task_completion_date: new Date().toISOString(),
        is_skipped: true,
        updated_at: new Date().toISOString()
      })
      .eq('hs_object_id', hubspot_id);

    if (dbError) {
      console.error('Database update error:', dbError);
      // Don't throw here as HubSpot update was successful
    } else {
      console.log('✅ Task status updated in database with skip flag');
    }

    // Trigger background refresh of team statistics with proper team ID (fire and forget)
    if (taskData?.hubspot_team_id) {
      refreshTeamStats(taskData.hubspot_team_id).catch(error => 
        console.error('Background team stats refresh failed:', error)
      );
    } else {
      console.log('⚠️ No team ID found for task, skipping team stats refresh');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        hubspot_id,
        task_id,
        message: 'Task skipped successfully'
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json'
        } 
      }
    );

  } catch (error) {
    console.error('Error skipping task:', error);
    
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