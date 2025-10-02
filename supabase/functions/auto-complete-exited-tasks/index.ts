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

    // Step 3: Check membership status and create automation runs
    const automationRunsToCreate = [];
    let tasksChecked = 0;
    let contactsExited = 0;

    for (const task of tasksToProcess) {
      tasksChecked++;
      
      // Check if contact is still a member of the list
      const { data: membership, error: membershipError } = await supabase
        .from('hs_list_memberships')
        .select('list_exit_date')
        .eq('hs_list_id', task.automation_hs_list_id)
        .eq('hs_object_id', task.associated_contact_id)
        .maybeSingle();

      if (membershipError) {
        console.warn(`[${runId}] ⚠️ Error checking membership for task ${task.task_id}:`, membershipError.message);
        continue;
      }

      // Determine if contact has exited
      const hasExited = !membership || membership.list_exit_date !== null;

      if (!hasExited) {
        // Contact is still a member, do nothing
        continue;
      }

      contactsExited++;
      console.log(`[${runId}] 🚪 Contact ${task.associated_contact_id} has exited list ${task.automation_hs_list_id}`);

      // Create automation run if auto_complete_on_exit_enabled is true
      if (task.auto_complete_on_exit_enabled) {
        const plannedTimestamp = new Date(Date.now() + 30000); // 30 seconds from now
        
        automationRunsToCreate.push({
          automation_id: task.automation_id,
          type: 'complete_on_exit',
          hs_trigger_object: 'task',
          hs_trigger_object_id: task.task_id,
          hs_queue_id: task.task_queue_id,
          planned_execution_timestamp: plannedTimestamp.toISOString(),
          planned_execution_timestamp_display: plannedTimestamp.toLocaleString('fr-FR', { 
            timeZone: 'Europe/Paris',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })
        });
      }
    }

    console.log(`[${runId}] 📝 Creating ${automationRunsToCreate.length} automation runs`);

    // Step 4: Batch insert automation runs
    if (automationRunsToCreate.length > 0) {
      const { error: insertError } = await supabase
        .from('task_automation_runs')
        .insert(automationRunsToCreate);

      if (insertError) {
        throw new Error(`Failed to insert automation runs: ${insertError.message}`);
      }

      console.log(`[${runId}] ✅ Successfully created ${automationRunsToCreate.length} automation runs`);
    }

    // Final summary
    console.log(`[${runId}] === AUTO-COMPLETE EXITED TASKS COMPLETE ===`);
    console.log(`[${runId}] 📊 Tasks checked: ${tasksChecked}`);
    console.log(`[${runId}] 🚪 Contacts exited: ${contactsExited}`);
    console.log(`[${runId}] 📝 Automation runs created: ${automationRunsToCreate.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Auto-complete exited tasks completed',
        tasksChecked,
        contactsExited,
        actionsCreated: automationRunsToCreate.length
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
