import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const executionId = `exec_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    console.log(`[${executionId}] === SCHEDULED AUTOMATION RUNS EXECUTION START ===`);
    console.log(`[${executionId}] Checking for automation runs due between now and +1 minute`);

    // Query for automation runs that are due within the next minute
    const { data: dueRuns, error: queryError } = await supabase
      .from('task_automation_runs')
      .select(`
        id,
        automation_id,
        planned_execution_timestamp,
        planned_execution_timestamp_display,
        hs_trigger_object_id,
        hs_trigger_object,
        type,
        position_in_sequence,
        task_name,
        task_owner_setting,
        hs_owner_id_contact,
        hs_owner_id_previous_task,
        hs_queue_id,
        created_task,
        exit_contact_list_block
      `)
      .eq('created_task', false)
      .neq('exit_contact_list_block', true)
      .gte('planned_execution_timestamp', new Date().toISOString())
      .lte('planned_execution_timestamp', new Date(Date.now() + 60000).toISOString())
      .order('planned_execution_timestamp', { ascending: true });

    if (queryError) {
      console.error(`[${executionId}] Error querying automation runs:`, queryError);
      throw queryError;
    }

    console.log(`[${executionId}] Found ${dueRuns?.length || 0} automation runs due for execution`);

    if (dueRuns && dueRuns.length > 0) {
      console.log(`[${executionId}] Due runs details:`);
      dueRuns.forEach((run, index) => {
        console.log(`[${executionId}] Run ${index + 1}:`, {
          id: run.id,
          automation_id: run.automation_id,
          type: run.type,
          planned_execution: run.planned_execution_timestamp,
          planned_display: run.planned_execution_timestamp_display,
          trigger_object: run.hs_trigger_object,
          trigger_id: run.hs_trigger_object_id,
          position: run.position_in_sequence,
          task_name: run.task_name,
          exit_contact_list_block: run.exit_contact_list_block,
        });
      });

      // TODO: Implement task creation logic here
      console.log(`[${executionId}] Task creation logic not yet implemented - runs logged only`);
    } else {
      console.log(`[${executionId}] No automation runs due at this time`);
    }

    console.log(`[${executionId}] === SCHEDULED AUTOMATION RUNS EXECUTION COMPLETE ===`);

    return new Response(
      JSON.stringify({
        success: true,
        execution_id: executionId,
        due_runs_count: dueRuns?.length || 0,
        message: 'Scheduled automation runs check completed',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in execute-scheduled-automation-runs:', error);
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
