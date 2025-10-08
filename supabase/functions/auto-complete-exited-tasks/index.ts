import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EligibleTask {
  task_id: string;
  task_queue_id: string;
  associated_contact_id: string;
  automation_id: string;
  automation_hs_list_id: string;
  auto_complete_on_exit_enabled: boolean;
  sequence_exit_enabled: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const runId = `exit_${new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').slice(0, 15)}`;
  console.log(`[${runId}] === AUTO-COMPLETE EXITED TASKS START ===`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Query eligible tasks
    console.log(`[${runId}] 🔍 Querying eligible tasks...`);
    
    const { data: eligibleTasks, error: tasksError } = await supabase
      .from('hs_tasks')
      .select(`
        hs_object_id,
        hs_queue_membership_ids,
        associated_contact_id,
        task_categories!inner(
          id,
          hs_queue_id,
          task_automations!inner(
            id,
            automation_enabled,
            auto_complete_on_exit_enabled,
            sequence_exit_enabled,
            hs_list_id
          )
        )
      `)
      .eq('hs_task_completion_count', 0)
      .not('hs_queue_membership_ids', 'is', null)
      .not('associated_contact_id', 'is', null);

    if (tasksError) {
      throw new Error(`Failed to query eligible tasks: ${tasksError.message}`);
    }

    console.log(`[${runId}] 📊 Found ${eligibleTasks?.length || 0} potentially eligible tasks`);

    if (!eligibleTasks || eligibleTasks.length === 0) {
      console.log(`[${runId}] ✅ No eligible tasks to process`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No eligible tasks to process',
          tasksProcessed: 0,
          actionsCreated: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Step 2: Filter and process eligible tasks
    const tasksToProcess: EligibleTask[] = [];
    
    for (const task of eligibleTasks) {
      const queueId = task.hs_queue_membership_ids;
      const categories = Array.isArray(task.task_categories) ? task.task_categories : [task.task_categories];
      
      for (const category of categories) {
        if (category.hs_queue_id === queueId) {
          const automations = Array.isArray(category.task_automations) ? category.task_automations : [category.task_automations];
          
          for (const automation of automations) {
            if (
              automation.automation_enabled === true &&
              automation.hs_list_id !== null &&
              (automation.auto_complete_on_exit_enabled === true || automation.sequence_exit_enabled === true)
            ) {
              tasksToProcess.push({
                task_id: task.hs_object_id,
                task_queue_id: queueId,
                associated_contact_id: task.associated_contact_id,
                automation_id: automation.id,
                automation_hs_list_id: automation.hs_list_id,
                auto_complete_on_exit_enabled: automation.auto_complete_on_exit_enabled,
                sequence_exit_enabled: automation.sequence_exit_enabled
              });
            }
          }
        }
      }
    }

    console.log(`[${runId}] 🎯 Filtered to ${tasksToProcess.length} tasks with active automations`);

    // Step 3: Group tasks by automation ID
    const tasksByAutomation = new Map<string, {
      automation: {
        id: string;
        hs_list_id: string;
        hs_queue_id: string;
        auto_complete_on_exit_enabled: boolean;
        sequence_exit_enabled: boolean;
      };
      tasks: EligibleTask[];
    }>();

    for (const task of tasksToProcess) {
      const key = task.automation_id;
      if (!tasksByAutomation.has(key)) {
        tasksByAutomation.set(key, {
          automation: {
            id: task.automation_id,
            hs_list_id: task.automation_hs_list_id,
            hs_queue_id: task.task_queue_id,
            auto_complete_on_exit_enabled: task.auto_complete_on_exit_enabled,
            sequence_exit_enabled: task.sequence_exit_enabled
          },
          tasks: []
        });
      }
      tasksByAutomation.get(key)!.tasks.push(task);
    }

    console.log(`[${runId}] 📊 Grouped into ${tasksByAutomation.size} automation(s)`);

    // Step 4: Process each automation group
    const automationRunsToCreate = [];
    let totalTasksCompleted = 0;
    let totalContactsExited = 0;
    let totalSequenceTasksBlocked = 0;
    const hubspotToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN');

    for (const [automationId, { automation, tasks }] of tasksByAutomation) {
      console.log(`[${runId}] 🔄 Processing automation ${automationId} with ${tasks.length} tasks`);

      // Get unique contact IDs for this automation
      const uniqueContactIds = [...new Set(tasks.map(t => t.associated_contact_id))];
      
      // Batch check membership status for all contacts
      const { data: memberships, error: membershipError } = await supabase
        .from('hs_list_memberships')
        .select('hs_object_id, list_exit_date')
        .eq('hs_list_id', automation.hs_list_id)
        .in('hs_object_id', uniqueContactIds);

      if (membershipError) {
        console.warn(`[${runId}] ⚠️ Error checking memberships for automation ${automationId}:`, membershipError.message);
        continue;
      }

      // Build a map of contact exit statuses
      const contactExitMap = new Map<string, boolean>();
      const membershipMap = new Map(memberships?.map(m => [m.hs_object_id, m]) || []);
      
      for (const contactId of uniqueContactIds) {
        const membership = membershipMap.get(contactId);
        const hasExited = !membership || membership.list_exit_date !== null;
        contactExitMap.set(contactId, hasExited);
      }

      // Filter to tasks where contact has exited
      const exitedTasks = tasks.filter(task => contactExitMap.get(task.associated_contact_id));
      
      if (exitedTasks.length === 0) {
        console.log(`[${runId}] ℹ️ No exited contacts for automation ${automationId}`);
        continue;
      }

      const exitedContactIds = [...new Set(exitedTasks.map(t => t.associated_contact_id))];
      totalContactsExited += exitedContactIds.length;
      console.log(`[${runId}] 🚪 ${exitedContactIds.length} contact(s) exited from list ${automation.hs_list_id}`);

      // Sub-process 2.a: Auto-complete tasks if enabled
      if (automation.auto_complete_on_exit_enabled) {
        const taskIdsToComplete = exitedTasks.map(t => t.task_id);
        console.log(`[${runId}] 🎯 Auto-completing ${taskIdsToComplete.length} tasks via HubSpot batch API`);

        try {
          // Make HubSpot batch update API call
          const batchUpdatePayload = {
            inputs: taskIdsToComplete.map(taskId => ({
              id: taskId,
              properties: {
                hs_task_status: 'COMPLETED',
                hs_task_completion_date: new Date().toISOString()
              }
            }))
          };

          const hubspotResponse = await fetch('https://api.hubapi.com/crm/v3/objects/tasks/batch/update', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${hubspotToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(batchUpdatePayload),
          });

          if (!hubspotResponse.ok) {
            const errorText = await hubspotResponse.text();
            console.error(`[${runId}] ❌ HubSpot batch update failed (${hubspotResponse.status}):`, errorText);
            throw new Error(`HubSpot batch API error (${hubspotResponse.status}): ${errorText}`);
          }

          const batchResult = await hubspotResponse.json();
          const successfulTasks = batchResult.results || [];
          const errors = batchResult.errors || [];
          
          console.log(`[${runId}] ✅ HubSpot completed ${successfulTasks.length} tasks, ${errors.length} errors`);

          // Update hs_tasks for successful completions
          if (successfulTasks.length > 0) {
            const successfulTaskIds = successfulTasks.map((t: any) => t.id);
            const completionTimestamp = new Date().toISOString();

            const { error: updateError } = await supabase
              .from('hs_tasks')
              .update({
                hs_task_status: 'COMPLETED',
                hs_task_completion_date: completionTimestamp,
                hs_task_completion_count: 1,
                marked_completed_by_automation: true,
                marked_completed_by_automation_id: automationId,
                is_skipped: true,
                updated_at: completionTimestamp
              })
              .in('hs_object_id', successfulTaskIds);

            if (updateError) {
              console.error(`[${runId}] ❌ Failed to update hs_tasks:`, updateError.message);
            } else {
              console.log(`[${runId}] ✅ Updated ${successfulTaskIds.length} tasks in hs_tasks`);
              totalTasksCompleted += successfulTaskIds.length;
            }

            // Create single automation run record for this batch
            automationRunsToCreate.push({
              automation_id: automationId,
              type: 'complete_on_exit',
              hs_trigger_object: 'list',
              hs_trigger_object_id: automation.hs_list_id,
              hs_queue_id: automation.hs_queue_id,
              hs_actioned_task_ids: successfulTaskIds,
              hs_action_successful: successfulTaskIds.length > 0,
              failure_description: errors.length > 0 ? errors : null
            });
          }
        } catch (error) {
          console.error(`[${runId}] ❌ Error completing tasks for automation ${automationId}:`, error.message);
          
          // Create failed automation run record
          automationRunsToCreate.push({
            automation_id: automationId,
            type: 'complete_on_exit',
            hs_trigger_object: 'list',
            hs_trigger_object_id: automation.hs_list_id,
            hs_queue_id: automation.hs_queue_id,
            hs_actioned_task_ids: [],
            hs_action_successful: false,
            failure_description: [{ message: error.message }]
          });
        }
      }

      // Sub-process 2.b: Block future sequence tasks if enabled
      if (automation.sequence_exit_enabled) {
        for (const contactId of exitedContactIds) {
          const { data: pendingRuns, error: queryError } = await supabase
            .from('task_automation_runs')
            .select('id')
            .eq('type', 'create_from_sequence')
            .eq('hs_action_successful', false)
            .eq('hs_contact_id', contactId)
            .eq('hs_queue_id', automation.hs_queue_id)
            .gt('planned_execution_timestamp', new Date().toISOString());

          if (queryError) {
            console.warn(`[${runId}] ⚠️ Error querying pending sequence tasks for contact ${contactId}:`, queryError.message);
          } else if (pendingRuns && pendingRuns.length > 0) {
            const runIds = pendingRuns.map(r => r.id);
            
            const { error: updateError } = await supabase
              .from('task_automation_runs')
              .update({ exit_contact_list_block: true })
              .in('id', runIds);
              
            if (updateError) {
              console.warn(`[${runId}] ⚠️ Failed to block ${runIds.length} pending sequence tasks for contact ${contactId}:`, updateError.message);
            } else {
              console.log(`[${runId}] 🚫 Blocked ${runIds.length} pending sequence tasks for contact ${contactId}`);
              totalSequenceTasksBlocked += runIds.length;
            }
          }
        }
      }
    }

    console.log(`[${runId}] 📝 Creating ${automationRunsToCreate.length} automation run record(s)`);

    // Step 5: Batch insert automation runs
    if (automationRunsToCreate.length > 0) {
      const { error: insertError } = await supabase
        .from('task_automation_runs')
        .insert(automationRunsToCreate);

      if (insertError) {
        throw new Error(`Failed to insert automation runs: ${insertError.message}`);
      }

      console.log(`[${runId}] ✅ Successfully created ${automationRunsToCreate.length} automation run record(s)`);
    }

    // Final summary
    console.log(`[${runId}] === AUTO-COMPLETE EXITED TASKS COMPLETE ===`);
    console.log(`[${runId}] 🚪 Contacts exited: ${totalContactsExited}`);
    console.log(`[${runId}] ✅ Tasks completed: ${totalTasksCompleted}`);
    console.log(`[${runId}] 📝 Automation runs created: ${automationRunsToCreate.length}`);
    console.log(`[${runId}] 🚫 Sequence tasks blocked: ${totalSequenceTasksBlocked}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Auto-complete exited tasks completed',
        contactsExited: totalContactsExited,
        tasksCompleted: totalTasksCompleted,
        automationRunsCreated: automationRunsToCreate.length,
        sequenceTasksBlocked: totalSequenceTasksBlocked
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error(`[${runId}] ❌ Error:`, error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
