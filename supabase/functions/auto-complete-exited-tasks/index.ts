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

    // Parse request body to get membership_ids
    const { membership_ids } = await req.json();
    
    if (!membership_ids || !Array.isArray(membership_ids) || membership_ids.length === 0) {
      console.log(`[${runId}] ℹ️ No membership_ids provided - nothing to process`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No membership IDs provided',
          tasksProcessed: 0,
          actionsCreated: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`[${runId}] 📋 Processing ${membership_ids.length} newly exited memberships`);

    // Get details of the memberships to process
    const { data: memberships, error: membershipsError } = await supabase
      .from('hs_list_memberships')
      .select('id, hs_object_id, hs_queue_id, automation_id, hs_list_id')
      .in('id', membership_ids);

    if (membershipsError) {
      throw new Error(`Failed to fetch memberships: ${membershipsError.message}`);
    }

    if (!memberships || memberships.length === 0) {
      console.log(`[${runId}] ⚠️ No valid memberships found for provided IDs`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No valid memberships found',
          tasksProcessed: 0,
          actionsCreated: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Extract contact IDs and queue IDs from memberships
    const contactIds = [...new Set(memberships.map(m => m.hs_object_id))];
    const queueIds = [...new Set(memberships.map(m => m.hs_queue_id).filter(Boolean))];

    console.log(`[${runId}] 🎯 Processing ${contactIds.length} contacts across ${queueIds.length} queues`);

    // ===== BATCH CONTACT REFRESH =====
    // Force refresh all contacts from HubSpot before processing
    console.log(`[${runId}] 📞 Refreshing ${contactIds.length} contact(s) from HubSpot...`);

    const hubspotToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN');
    if (hubspotToken && contactIds.length > 0) {
      try {
        const contactResponse = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/batch/read', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${hubspotToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: contactIds.map(id => ({ id })),
            properties: [
              'firstname',
              'lastname',
              'mobilephone',
              'ensol_source_group',
              'hs_lead_status',
              'lifecyclestage',
              'createdate',
              'lastmodifieddate',
              'hubspot_owner_id'
            ]
          }),
        });

        if (contactResponse.ok) {
          const contactData = await contactResponse.json();
          const contacts = contactData.results || [];
          
          console.log(`[${runId}] ✅ Fetched ${contacts.length} contact(s) from HubSpot`);
          
          const parseContactTimestamp = (value: any): string | null => {
            if (!value || value === '' || value === 'null' || value === '0') return null;
            if (typeof value === 'string' && value.includes('T') && value.includes('Z')) {
              const date = new Date(value);
              return !isNaN(date.getTime()) && date.getFullYear() > 1970 ? date.toISOString() : null;
            }
            const timestamp = parseInt(String(value));
            if (isNaN(timestamp) || timestamp === 0) return null;
            const date = new Date(timestamp);
            return date.getFullYear() > 1970 ? date.toISOString() : null;
          };
          
          const contactsToUpsert = contacts.map(contact => ({
            hs_object_id: contact.id,
            firstname: contact.properties?.firstname || null,
            lastname: contact.properties?.lastname || null,
            mobilephone: contact.properties?.mobilephone || null,
            ensol_source_group: contact.properties?.ensol_source_group || null,
            hs_lead_status: contact.properties?.hs_lead_status || null,
            lifecyclestage: contact.properties?.lifecyclestage || null,
            createdate: parseContactTimestamp(contact.properties?.createdate),
            lastmodifieddate: parseContactTimestamp(contact.properties?.lastmodifieddate),
            hubspot_owner_id: contact.properties?.hubspot_owner_id || null,
            updated_at: new Date().toISOString()
          }));
          
          const { error: upsertError } = await supabase
            .from('hs_contacts')
            .upsert(contactsToUpsert, { 
              onConflict: 'hs_object_id',
              ignoreDuplicates: false 
            });
          
          if (upsertError) {
            console.error(`[${runId}] ❌ Failed to refresh contacts:`, upsertError);
          } else {
            console.log(`[${runId}] ✅ Refreshed ${contactsToUpsert.length} contact(s) in hs_contacts`);
            const contactsWithOwners = contacts.filter(c => c.properties?.hubspot_owner_id).length;
            console.log(`[${runId}] 📋 Contacts with owners: ${contactsWithOwners}, without owners: ${contacts.length - contactsWithOwners}`);
          }
        } else {
          console.warn(`[${runId}] ⚠️ Failed to fetch contacts from HubSpot (${contactResponse.status})`);
        }
      } catch (error) {
        console.error(`[${runId}] ❌ Error refreshing contacts:`, error);
      }
    } else {
      console.log(`[${runId}] ℹ️ Skipping contact refresh (no token or no contacts)`);
    }

    // Step 1: Query eligible tasks for these specific contact-queue combinations
    console.log(`[${runId}] 🔍 Querying eligible tasks for specific contact-queue combinations...`);
    
    const { data: eligibleTasks, error: tasksError } = await supabase
      .from('hs_tasks')
      .select(`
        hs_object_id,
        hs_queue_membership_ids,
        associated_contact_id,
        task_categories!hs_tasks_hs_queue_membership_ids_fkey!inner(
          id,
          hs_queue_id,
          task_automations!fk_task_automations_category!inner(
            id,
            automation_enabled,
            auto_complete_on_exit_enabled,
            sequence_exit_enabled,
            hs_list_id
          )
        )
      `)
      .eq('hs_task_completion_count', 0)
      .in('associated_contact_id', contactIds)
      .in('hs_queue_membership_ids', queueIds);

    if (tasksError) {
      throw new Error(`Failed to query eligible tasks: ${tasksError.message}`);
    }

    console.log(`[${runId}] 📊 Found ${eligibleTasks?.length || 0} potentially eligible tasks`);
    
    // Debug: Log category/automation counts per task for troubleshooting
    if (eligibleTasks && eligibleTasks.length > 0) {
      const sample = eligibleTasks[0];
      const categories = Array.isArray(sample.task_categories) ? sample.task_categories : [sample.task_categories];
      console.log(`[${runId}] 🔍 Sample task has ${categories.length} category relationship(s)`);
      if (categories.length > 0) {
        const automations = Array.isArray(categories[0].task_automations) ? categories[0].task_automations : [categories[0].task_automations];
        console.log(`[${runId}] 🔍 Sample category has ${automations.length} automation relationship(s)`);
      }
    }

    if (!eligibleTasks || eligibleTasks.length === 0) {
      console.log(`[${runId}] ✅ No eligible tasks to process`);
      
      // Mark memberships as processed even if no tasks found
      console.log(`[${runId}] ✅ Marking ${membership_ids.length} memberships as processed (no tasks case)`);
      const { error: markProcessedError } = await supabase
        .from('hs_list_memberships')
        .update({ exit_processed_at: new Date().toISOString() })
        .in('id', membership_ids);

      if (markProcessedError) {
        console.error(`[${runId}] ⚠️ Failed to mark memberships as processed:`, markProcessedError.message);
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No eligible tasks to process',
          tasksProcessed: 0,
          actionsCreated: 0,
          membershipsProcessed: membership_ids.length
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

    for (const [automationId, { automation, tasks }] of tasksByAutomation) {
      console.log(`[${runId}] 🔄 Processing automation ${automationId} with ${tasks.length} tasks`);

      // Get unique contact IDs for this automation's tasks
      const uniqueContactIds = [...new Set(tasks.map(t => t.associated_contact_id))];
      
      // Filter tasks to only those belonging to the contacts in our membership list
      // (since we're only processing specific newly exited memberships)
      const relevantContactIds = memberships
        .filter(m => m.automation_id === automationId)
        .map(m => m.hs_object_id);
      
      const exitedTasks = tasks.filter(task => relevantContactIds.includes(task.associated_contact_id));
      
      if (exitedTasks.length === 0) {
        console.log(`[${runId}] ℹ️ No exited contacts for automation ${automationId}`);
        continue;
      }

      const exitedContactIds = [...new Set(exitedTasks.map(t => t.associated_contact_id))];
      totalContactsExited += exitedContactIds.length;
      console.log(`[${runId}] 🚪 ${exitedContactIds.length} contact(s) exited from list ${automation.hs_list_id} (with fresh contact data)`);

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
                hs_task_status: 'COMPLETED'
                // hs_task_completion_date is auto-set by HubSpot (read-only property)
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
                marked_completed_by_automation_source: 'list_exit',
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
          
          // Only create failed automation run record if there were tasks to complete
          if (taskIdsToComplete.length > 0) {
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
      }

      // Sub-process 2.b: Block future sequence tasks if enabled
      if (automation.sequence_exit_enabled) {
        let blockedRunIds: string[] = [];
        let cancelFailureDescription = null;

        try {
          // Query ALL pending runs (both initial and sequence) for ALL exited contacts
          const { data: pendingRuns, error: queryError } = await supabase
            .from('task_automation_runs')
            .select('id')
            .in('type', ['create_on_entry', 'create_from_sequence'])
            .eq('hs_action_successful', false)
            .in('hs_contact_id', exitedContactIds)
            .eq('hs_queue_id', automation.hs_queue_id)
            .gt('planned_execution_timestamp', new Date().toISOString());

          if (queryError) {
            console.warn(`[${runId}] ⚠️ Error querying pending sequence tasks:`, queryError.message);
            cancelFailureDescription = [{ message: `Query error: ${queryError.message}` }];
          } else if (pendingRuns && pendingRuns.length > 0) {
            const runIds = pendingRuns.map(r => r.id);
            
            // Batch update ALL identified runs
            const { error: updateError } = await supabase
              .from('task_automation_runs')
              .update({ exit_contact_list_block: true })
              .in('id', runIds);
              
            if (updateError) {
              console.warn(`[${runId}] ⚠️ Failed to block ${runIds.length} pending sequence tasks:`, updateError.message);
              cancelFailureDescription = [{ message: `Update error: ${updateError.message}` }];
            } else {
              console.log(`[${runId}] 🚫 Blocked ${runIds.length} pending automation runs (initial + sequence tasks)`);
              blockedRunIds = runIds;
              totalSequenceTasksBlocked += runIds.length;
            }
          } else {
            console.log(`[${runId}] ℹ️ No pending automation runs found to block`);
          }
        } catch (error: any) {
          console.error(`[${runId}] ❌ Error in sequence blocking:`, error.message);
          cancelFailureDescription = [{ message: error.message }];
        }

        // Only create cancel_on_exit record if runs were blocked or an error occurred
        if (blockedRunIds.length > 0 || cancelFailureDescription !== null) {
          automationRunsToCreate.push({
            automation_id: automation.id,
            type: 'cancel_on_exit',
            hs_trigger_object: 'list',
            hs_trigger_object_id: automation.hs_list_id,
            hs_queue_id: automation.hs_queue_id,
            actioned_run_ids: blockedRunIds,
            failure_description: cancelFailureDescription
          });
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

    // Mark these memberships as processed
    console.log(`[${runId}] ✅ Marking ${membership_ids.length} memberships as processed`);
    const { error: markProcessedError } = await supabase
      .from('hs_list_memberships')
      .update({ exit_processed_at: new Date().toISOString() })
      .in('id', membership_ids);

    if (markProcessedError) {
      console.error(`[${runId}] ⚠️ Failed to mark memberships as processed:`, markProcessedError.message);
    } else {
      console.log(`[${runId}] ✅ Successfully marked memberships as processed`);
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
        sequenceTasksBlocked: totalSequenceTasksBlocked,
        membershipsProcessed: membership_ids.length
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
