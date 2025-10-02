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
    
    // Calculate the current minute range (e.g., 06:38:00 to 06:38:59.999)
    const now = new Date();
    const startOfMinute = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      now.getMinutes(),
      0,
      0
    );
    const endOfMinute = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      now.getMinutes(),
      59,
      999
    );
    
    console.log(`[${executionId}] Checking for automation runs due within current minute: ${startOfMinute.toISOString()} to ${endOfMinute.toISOString()}`);

    // Query for automation runs that are due within the current minute
    let { data: dueRuns, error: queryError } = await supabase
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
        hs_contact_id,
        created_task,
        exit_contact_list_block
      `)
      .eq('created_task', false)
      .or('exit_contact_list_block.is.null,exit_contact_list_block.eq.false')
      .gte('planned_execution_timestamp', startOfMinute.toISOString())
      .lte('planned_execution_timestamp', endOfMinute.toISOString())
      .order('planned_execution_timestamp', { ascending: true });

    if (queryError) {
      console.error(`[${executionId}] Error querying automation runs:`, queryError);
      throw queryError;
    }

    console.log(`[${executionId}] Primary query found ${dueRuns?.length || 0} automation runs due for execution`);

    // If no runs found in current minute, check for missed runs in the last 2 minutes (catch-up fallback)
    if (!dueRuns || dueRuns.length === 0) {
      const fallbackStart = new Date(startOfMinute.getTime() - 2 * 60 * 1000); // 2 minutes before current minute
      console.log(`[${executionId}] No runs found in current minute - checking fallback window: ${fallbackStart.toISOString()} to ${endOfMinute.toISOString()}`);
      
      const { data: fallbackRuns, error: fallbackError } = await supabase
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
          hs_contact_id,
          created_task,
          exit_contact_list_block
        `)
        .eq('created_task', false)
        .or('exit_contact_list_block.is.null,exit_contact_list_block.eq.false')
        .gte('planned_execution_timestamp', fallbackStart.toISOString())
        .lte('planned_execution_timestamp', endOfMinute.toISOString())
        .order('planned_execution_timestamp', { ascending: true });

      if (fallbackError) {
        console.error(`[${executionId}] Error in fallback query:`, fallbackError);
      } else {
        dueRuns = fallbackRuns;
        console.log(`[${executionId}] Fallback query found ${dueRuns?.length || 0} automation runs`);
      }
    }

    if (dueRuns && dueRuns.length > 0) {
      console.log(`[${executionId}] Found ${dueRuns.length} due runs - processing...`);
      
      const hubspotToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN');
      if (!hubspotToken) {
        console.error(`[${executionId}] ❌ HUBSPOT_ACCESS_TOKEN not configured`);
        throw new Error('HUBSPOT_ACCESS_TOKEN not configured');
      }

      let successCount = 0;
      let failureCount = 0;

      for (const run of dueRuns) {
        console.log(`[${executionId}] 📝 Processing run ${run.id}:`, {
          automation_id: run.automation_id,
          task_name: run.task_name,
          contact_id: run.hs_contact_id,
          position: run.position_in_sequence,
        });

        try {
          // Determine owner ID based on task_owner_setting
          let hubspotOwnerId = null;
          if (run.task_owner_setting === 'contact_owner') {
            hubspotOwnerId = run.hs_owner_id_contact;
            console.log(`[${executionId}] Owner setting: contact_owner (${hubspotOwnerId})`);
          } else if (run.task_owner_setting === 'previous_task_owner') {
            hubspotOwnerId = run.hs_owner_id_previous_task;
            console.log(`[${executionId}] Owner setting: previous_task_owner (${hubspotOwnerId})`);
          } else {
            console.log(`[${executionId}] Owner setting: no_owner`);
          }

          // Build HubSpot task payload
          const taskPayload: any = {
            properties: {
              hs_task_subject: run.task_name,
              hs_queue_membership_ids: run.hs_queue_id,
              hs_task_type: 'TODO',
              hs_task_status: 'NOT_STARTED',
              hs_timestamp: run.planned_execution_timestamp,
            },
            associations: [
              {
                to: { id: run.hs_contact_id },
                types: [
                  {
                    associationCategory: 'HUBSPOT_DEFINED',
                    associationTypeId: 204, // task-to-contact association
                  },
                ],
              },
            ],
          };

          // Add owner ID if present
          if (hubspotOwnerId) {
            taskPayload.properties.hubspot_owner_id = hubspotOwnerId;
          }

          console.log(`[${executionId}] 🚀 Creating HubSpot task...`);

          // Create task in HubSpot
          const hubspotResponse = await fetch('https://api.hubapi.com/crm/v3/objects/tasks', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${hubspotToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(taskPayload),
          });

          if (!hubspotResponse.ok) {
            const errorText = await hubspotResponse.text();
            throw new Error(`HubSpot API error (${hubspotResponse.status}): ${errorText}`);
          }

          const hubspotData = await hubspotResponse.json();
          const newTaskId = hubspotData.id;

          console.log(`[${executionId}] ✅ HubSpot task created: ${newTaskId}`);

          // Insert into local hs_tasks table
          const { error: insertError } = await supabase
            .from('hs_tasks')
            .insert({
              hs_object_id: newTaskId,
              hs_task_subject: run.task_name,
              hs_task_type: 'TODO',
              hs_queue_membership_ids: run.hs_queue_id,
              hs_timestamp: run.planned_execution_timestamp,
              hs_task_status: 'NOT_STARTED',
              number_in_sequence: run.position_in_sequence,
              hubspot_owner_id: hubspotOwnerId,
              associated_contact_id: run.hs_contact_id,
              created_by_automation: true,
              created_by_automation_id: run.automation_id,
              archived: false,
            });

          if (insertError) {
            console.error(`[${executionId}] ❌ Failed to insert into hs_tasks:`, insertError);
            throw insertError;
          }

          console.log(`[${executionId}] ✅ Local hs_tasks record created`);

          // Mark automation run as completed and add task ID to actioned tasks
          const { error: updateError } = await supabase
            .from('task_automation_runs')
            .update({ 
              created_task: true,
              hs_actioned_task_ids: [newTaskId],
            })
            .eq('id', run.id);

          if (updateError) {
            console.error(`[${executionId}] ⚠️ Failed to update automation run status:`, updateError);
          }

          successCount++;
          console.log(`[${executionId}] ✅ Run ${run.id} completed successfully`);

        } catch (error) {
          failureCount++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[${executionId}] ❌ Failed to process run ${run.id}:`, errorMessage);

          // Update failure description
          await supabase
            .from('task_automation_runs')
            .update({ 
              failure_description: errorMessage,
            })
            .eq('id', run.id);
        }
      }

      console.log(`[${executionId}] 🎉 Batch complete: ${successCount} succeeded, ${failureCount} failed`);
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
