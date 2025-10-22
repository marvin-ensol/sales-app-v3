import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const HUBSPOT_API_TOKEN = Deno.env.get('HUBSPOT_API_TOKEN');
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { taskId, ownerId } = await req.json();
    
    if (!taskId || !ownerId) {
      console.error('Task ID and Owner ID are required');
      return new Response(
        JSON.stringify({ error: 'Task ID and Owner ID are required', success: false }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`🎯 [ASSIGNMENT] Assigning task ${taskId} to owner ${ownerId}`);

    // Step 1: Update task in HubSpot
    const hubspotResponse = await fetch(`https://api.hubapi.com/crm/v3/objects/tasks/${taskId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          hubspot_owner_id: ownerId,
          hubspot_owner_assigneddate: new Date().toISOString()
        }
      }),
    });

    if (!hubspotResponse.ok) {
      const errorText = await hubspotResponse.text();
      console.error('❌ [ASSIGNMENT] HubSpot API error:', errorText);
      throw new Error(`HubSpot API error: ${hubspotResponse.status} ${errorText}`);
    }

    console.log('✅ [ASSIGNMENT] Task successfully assigned in HubSpot');

    // Step 2: Update local database for immediate UI feedback
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get owner details for local update
    const { data: ownerData } = await supabase
      .from('hs_users')
      .select('full_name')
      .eq('owner_id', ownerId)
      .single();

    // Update local database
    const { error: updateError } = await supabase
      .from('hs_tasks')
      .update({ 
        hubspot_owner_id: ownerId,
        hubspot_owner_assigneddate: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('hs_object_id', taskId);

    if (updateError) {
      console.warn('⚠️ [ASSIGNMENT] Failed to update local database:', updateError);
      // Don't fail the request since HubSpot update succeeded
    } else {
      console.log('✅ [ASSIGNMENT] Local database updated successfully');
    }

    // Step 3: Record assignment metadata
    const { error: metadataError } = await supabase
      .from('sync_metadata')
      .upsert({
        owner_id: ownerId,
        last_sync_timestamp: new Date().toISOString(),
        last_sync_success: true
      });

    if (metadataError) {
      console.warn('⚠️ [ASSIGNMENT] Failed to update sync metadata:', metadataError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Task assigned successfully',
        taskId,
        ownerId,
        ownerName: ownerData?.full_name || 'Unknown',
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ [ASSIGNMENT] Assignment error:', error);
    return new Response(
      JSON.stringify({ 
        error: `Assignment failed: ${(error as Error)?.message || 'Unknown error'}`, 
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});