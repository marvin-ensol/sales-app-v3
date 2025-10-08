import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { membership_id } = await req.json();
    
    console.log(`🔄 Re-triggering automation for membership: ${membership_id}`);

    // Fetch the membership data
    const { data: membership, error: fetchError } = await supabase
      .from('hs_list_memberships')
      .select('*')
      .eq('id', membership_id)
      .single();

    if (fetchError || !membership) {
      throw new Error(`Failed to fetch membership: ${fetchError?.message || 'Not found'}`);
    }

    // Find matching automation
    const { data: automation, error: autoError } = await supabase
      .from('task_automations')
      .select('*')
      .eq('hs_list_id', membership.hs_list_id)
      .eq('automation_enabled', true)
      .eq('first_task_creation', true)
      .single();

    if (autoError || !automation) {
      throw new Error(`No enabled automation found for list ${membership.hs_list_id}`);
    }

    // Call process-automation-trigger
    const triggerResponse = await fetch(`${supabaseUrl}/functions/v1/process-automation-trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceRoleKey}`,
      },
      body: JSON.stringify({
        trigger_type: 'list_entry',
        membership_id: membership.id,
        automation_id: automation.id,
        hs_list_id: membership.hs_list_id,
        hs_object_id: membership.hs_object_id,
        schedule_enabled: automation.schedule_enabled,
        schedule_configuration: automation.schedule_configuration,
        timezone: automation.timezone,
      }),
    });

    if (!triggerResponse.ok) {
      const errorText = await triggerResponse.text();
      throw new Error(`Trigger failed: ${errorText}`);
    }

    const result = await triggerResponse.json();
    
    console.log(`✅ Re-trigger successful for membership ${membership_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        membership_id,
        result,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in retrigger-membership:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
