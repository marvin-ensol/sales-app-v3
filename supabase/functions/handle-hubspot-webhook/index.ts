import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HubSpotWebhookEvent {
  objectId: number;
  subscriptionType: string;
  objectTypeId: string;
  changeFlag: string;
  occurredAt: number;
  subscriptionId: number;
  portalId: number;
  appId: number;
  eventId: number;
  attemptNumber: number;
  changeSource: string;
}

interface CallDetails {
  id: string;
  properties: {
    hs_call_direction?: string;
    hs_call_duration?: string;
    hubspot_owner_id?: string;
  };
  associations?: {
    contacts?: {
      results: Array<{ id: string }>;
    };
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const events: HubSpotWebhookEvent[] = await req.json();
    console.log(`[HubSpot Webhook] Received ${events.length} event(s)`);
    console.log('[HubSpot Webhook] Raw payload:', JSON.stringify(events, null, 2));

    // Group events by type
    const taskDeletions = events.filter(e => 
      e.objectTypeId === '0-27' && e.changeFlag === 'DELETED'
    );
    const callCreations = events.filter(e => 
      e.objectTypeId === '0-48' && 
      (e.changeFlag === 'NEW' || e.changeFlag === 'CREATED' || e.subscriptionType?.toLowerCase() === 'object.creation')
    );
    const unknownEvents = events.filter(e => 
      !((e.objectTypeId === '0-27' && e.changeFlag === 'DELETED') || 
        (e.objectTypeId === '0-48' && (e.changeFlag === 'NEW' || e.changeFlag === 'CREATED' || e.subscriptionType?.toLowerCase() === 'object.creation')))
    );

    console.log(`[HubSpot Webhook] Task deletions: ${taskDeletions.length}, Call creations: ${callCreations.length}, Unknown: ${unknownEvents.length}`);
    
    // Log detailed event information for debugging
    if (taskDeletions.length > 0) {
      console.log('[HubSpot Webhook] Task deletion events details:', JSON.stringify(taskDeletions, null, 2));
    }
    
    if (callCreations.length > 0) {
      console.log('[HubSpot Webhook] Call creation events details:', JSON.stringify(callCreations, null, 2));
    }
    
    // Log full payload details for unknown events to help troubleshooting
    if (unknownEvents.length > 0) {
      console.log('[HubSpot Webhook] ⚠️ Unknown events detected - full payload details:');
      unknownEvents.forEach((event, index) => {
        console.log(`[Unknown Event ${index + 1}/${unknownEvents.length}]`, JSON.stringify({
          objectTypeId: event.objectTypeId,
          objectId: event.objectId,
          changeFlag: event.changeFlag,
          eventId: event.eventId,
          subscriptionId: event.subscriptionId,
          portalId: event.portalId,
          occurredAt: event.occurredAt,
          attemptNumber: event.attemptNumber,
          fullEvent: event
        }, null, 2));
      });
    }

    const results = {
      taskDeletions: { processed: 0, successful: 0, errors: 0 },
      callCreations: { processed: 0, successful: 0, errors: 0 },
      unknownEvents: unknownEvents.length
    };

    // Process task deletions
    if (taskDeletions.length > 0) {
      const deletionResult = await processTaskDeletions(taskDeletions, supabase);
      results.taskDeletions = deletionResult;
    }

    // Process call creations
    if (callCreations.length > 0) {
      const hubspotToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN');
      if (!hubspotToken) {
        console.error('[HubSpot Webhook] HUBSPOT_ACCESS_TOKEN not configured');
        results.callCreations.errors = callCreations.length;
      } else {
        const callResult = await processCallCreations(callCreations, supabase, hubspotToken);
        results.callCreations = callResult;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        message: `Processed ${events.length} webhook event(s)`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[HubSpot Webhook] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function processTaskDeletions(events: HubSpotWebhookEvent[], supabase: any) {
  console.log(`[Task Deletions] Processing ${events.length} task deletion(s)`);
  
  let successful = 0;
  let errors = 0;

  for (const event of events) {
    const taskId = event.objectId.toString();
    
    try {
      // Log the deletion attempt
      const { error: logError } = await supabase
        .from('task_sync_attempts')
        .insert({
          task_hubspot_id: taskId,
          action_type: 'webhook_deletion',
          status: 'completed',
          started_at: new Date(event.occurredAt).toISOString(),
          completed_at: new Date().toISOString(),
          hubspot_response: event
        });

      if (logError) {
        console.error(`[Task Deletions] Error logging deletion for task ${taskId}:`, logError);
      }

      // Update task status to DELETED
      const { error: updateError } = await supabase
        .from('hs_tasks')
        .update({ 
          hs_task_status: 'DELETED',
          updated_at: new Date().toISOString()
        })
        .eq('hs_object_id', taskId);

      if (updateError) {
        console.error(`[Task Deletions] Error updating task ${taskId}:`, updateError);
        errors++;
      } else {
        console.log(`[Task Deletions] Successfully marked task ${taskId} as DELETED`);
        successful++;
      }

    } catch (error) {
      console.error(`[Task Deletions] Error processing task ${taskId}:`, error);
      errors++;
    }
  }

  return { processed: events.length, successful, errors };
}

async function processCallCreations(events: HubSpotWebhookEvent[], supabase: any, hubspotToken: string) {
  console.log(`[Call Creations] Processing ${events.length} call creation(s)`);
  
  let successful = 0;
  let errors = 0;
  const MIN_DURATION_MS = 2000;

  for (const event of events) {
    const callId = event.objectId.toString();
    
    try {
      // Create initial event record
      const { data: insertedEvent, error: eventInsertError } = await supabase
        .from('events')
        .insert({
          type: 'webhook',
          event: 'call_created',
          hs_engagement_id: callId,
          created_at: new Date(event.occurredAt).toISOString()
        })
        .select()
        .single();

      if (eventInsertError) {
        console.error(`[Call Creations] Failed to create event record for call ${callId}:`, eventInsertError);
        errors++;
        continue;
      }

      const eventId = insertedEvent.id;

      // Fetch call details from HubSpot
      const callResponse = await fetch(
        `https://api.hubapi.com/crm/v3/objects/calls/${callId}?properties=hs_call_direction,hs_call_duration,hubspot_owner_id&associations=contacts`,
        {
          headers: {
            'Authorization': `Bearer ${hubspotToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!callResponse.ok) {
        console.error(`[Call Creations] Failed to fetch call ${callId}: ${callResponse.status}`);
        
        // Parse error response
        let errorBody;
        try {
          errorBody = await callResponse.json();
        } catch {
          errorBody = await callResponse.text();
        }

        // Create error_logs entry
        await supabase
          .from('error_logs')
          .insert({
            event_id: eventId,
            context: 'call_created',
            error_type: 'api',
            endpoint: `https://api.hubapi.com/crm/v3/objects/calls/${callId}`,
            status_code: callResponse.status,
            response_error: callResponse.statusText,
            response_message: typeof errorBody === 'object' 
              ? JSON.stringify(errorBody) 
              : errorBody
          });

        // Update event record with error
        await supabase
          .from('events')
          .update({
            error_details: {
              error_type: 'api_fetch_failed',
              status_code: callResponse.status,
              message: callResponse.statusText
            }
          })
          .eq('id', eventId);

        errors++;
        continue;
      }

      const callDetails: CallDetails = await callResponse.json();
      const direction = callDetails.properties?.hs_call_direction;
      const durationMs = parseInt(callDetails.properties?.hs_call_duration || '0');
      const contactId = callDetails.associations?.contacts?.results?.[0]?.id;
      const hubspotOwnerId = callDetails.properties?.hubspot_owner_id || null;

      // Update event record with successful call details
      const callDetailsLog = {
        call_id: callId,
        hs_call_direction: direction || null,
        hs_call_duration: durationMs,
        hubspot_owner_id: hubspotOwnerId,
        contact_id: contactId || null
      };

      // Construct HubSpot URL if we have a contact ID
      const hubspotUrl = contactId 
        ? `https://app-eu1.hubspot.com/contacts/142467012/contact/${contactId}/?engagement=${callId}`
        : null;

      await supabase
        .from('events')
        .update({
          hs_contact_id: contactId || null,
          hs_owner_id: hubspotOwnerId || null,
          hubspot_url: hubspotUrl,
          logs: {
            call_details: callDetailsLog
          }
        })
        .eq('id', eventId);

      console.log(`[Call Creations] Call ${callId}: direction=${direction}, duration=${durationMs}ms, contact=${contactId}`);

      // Validate call criteria
      if (direction !== 'OUTBOUND') {
        console.log(`[Call Creations] Skipping call ${callId}: not outbound (${direction})`);
        continue;
      }

      // TEMPORARILY DISABLED: Duration check - uncomment to re-enable
      // if (durationMs < MIN_DURATION_MS) {
      //   console.log(`[Call Creations] Skipping call ${callId}: duration too short (${durationMs}ms < ${MIN_DURATION_MS}ms)`);
      //   continue;
      // }

      if (!contactId) {
        console.log(`[Call Creations] Skipping call ${callId}: no associated contact`);
        continue;
      }

      console.log(`[Call Creations] Criteria met for call ${callId}, fetching all eligible tasks for contact ${contactId}`);

      // Step 1: Fetch ALL incomplete tasks for this contact (not filtered by queue yet)
      const { data: allTasks, error: allTasksError } = await supabase
        .from('hs_tasks')
        .select(`
          hs_object_id,
          hs_task_subject,
          hubspot_owner_id,
          hs_queue_membership_ids,
          hs_timestamp,
          hs_task_status
        `)
        .eq('associated_contact_id', contactId)
        .neq('hs_task_status', 'COMPLETED');

      if (allTasksError) {
        console.error(`[Call Creations] Error fetching tasks:`, allTasksError);
        
        await supabase
          .from('error_logs')
          .insert({
            event_id: eventId,
            context: 'call_created',
            error_type: 'database',
            endpoint: 'hs_tasks',
            response_error: 'Failed to fetch tasks',
            response_message: JSON.stringify(allTasksError)
          });

        await supabase
          .from('events')
          .update({
            error_details: {
              error_type: 'database_fetch_failed',
              message: 'Failed to fetch eligible tasks',
              details: allTasksError
            }
          })
          .eq('id', eventId);

        errors++;
        continue;
      }

      if (!allTasks || allTasks.length === 0) {
        console.log(`[Call Creations] No eligible tasks found for contact ${contactId}`);
        
        // Update event logs with empty eligible_tasks
        await supabase
          .from('events')
          .update({
            logs: {
              call_details: callDetailsLog,
              task_updates: {
                summary: {
                  total_incomplete: 0,
                  total_automation_eligible: 0,
                  total_update_successful: 0,
                  total_update_unsuccessful: 0
                },
                eligible_tasks: []
              }
            }
          })
          .eq('id', eventId);
        
        continue;
      }

      // Step 2: Fetch automations with auto_complete_on_engagement enabled
      const { data: automations, error: automationsError } = await supabase
        .from('task_automations')
        .select(`
          id,
          task_category_id,
          task_categories!inner (
            hs_queue_id
          )
        `)
        .eq('automation_enabled', true)
        .eq('auto_complete_on_engagement', true);

      if (automationsError) {
        console.error(`[Call Creations] Error fetching automations:`, automationsError);
      }

      // Build mapping: queue_id -> automation details
      const queueHasAutomation = new Map<string, boolean>();
      const queueToAutomationId = new Map<string, string>();

      if (automations && automations.length > 0) {
        automations.forEach(a => {
          const queueId = a.task_categories?.hs_queue_id;
          if (queueId) {
            queueHasAutomation.set(queueId, true);
            queueToAutomationId.set(queueId, a.id);
          }
        });
        console.log(`[Call Creations] Found ${automations.length} automation(s) with auto_complete_on_engagement enabled`);
      } else {
        console.log(`[Call Creations] No automations with auto_complete_on_engagement found`);
      }

      // Step 3: Classify and enrich tasks
      const currentTime = new Date();
      const currentTimeMs = currentTime.getTime();

      const eligibleTasks = allTasks.map(task => {
        const queueId = task.hs_queue_membership_ids;
        const hasAutomation = queueHasAutomation.get(queueId) || false;
        
        // Determine if task is overdue or future
        let taskStatus: 'overdue' | 'future';
        if (!task.hs_timestamp) {
          taskStatus = 'overdue'; // No due date = treat as overdue/current
        } else {
          const dueTimeMs = new Date(task.hs_timestamp).getTime();
          taskStatus = dueTimeMs <= currentTimeMs ? 'overdue' : 'future';
        }
        
        return {
          id: task.hs_object_id,
          status: taskStatus,
          hs_timestamp: task.hs_timestamp,
          hs_queue_membership_ids: queueId,
          automation_enabled: hasAutomation,
          automation_id: hasAutomation ? queueToAutomationId.get(queueId) : null,
          hs_task_subject: task.hs_task_subject,
          hubspot_owner_id: task.hubspot_owner_id
        };
      });

      const totalIncomplete = eligibleTasks.length;
      const tasksWithAutomation = eligibleTasks.filter(t => t.automation_enabled);
      const totalAutomationEligible = tasksWithAutomation.length;
      const overdueCount = eligibleTasks.filter(t => t.status === 'overdue').length;
      const futureCount = eligibleTasks.filter(t => t.status === 'future').length;

      console.log(`[Call Creations] Found ${totalIncomplete} incomplete tasks, ${totalAutomationEligible} automation-eligible (${overdueCount} overdue, ${futureCount} future)`);

      // Step 4: Update event with task identification results (before processing)
      await supabase
        .from('events')
        .update({
          logs: {
            call_details: callDetailsLog,
            task_updates: {
              summary: {
                total_incomplete: totalIncomplete,
                total_automation_eligible: totalAutomationEligible,
                total_update_successful: 0,
                total_update_unsuccessful: 0
              },
              eligible_tasks: eligibleTasks.map(t => ({
                id: t.id,
                hs_task_subject: t.hs_task_subject,
                hubspot_owner_id: t.hubspot_owner_id,
                status: t.status,
                hs_timestamp: t.hs_timestamp,
                hs_queue_membership_ids: t.hs_queue_membership_ids,
                automation_enabled: t.automation_enabled
              }))
            }
          }
        })
        .eq('id', eventId);

      // Step 5: Process only tasks with automation enabled
      const tasksToProcess = eligibleTasks.filter(t => t.automation_enabled);

      if (tasksToProcess.length === 0) {
        console.log(`[Call Creations] No tasks with automation enabled, skipping batch update`);
        
        await supabase
          .from('events')
          .update({
            logs: {
              call_details: callDetailsLog,
              task_updates: {
                summary: {
                  total_incomplete: totalIncomplete,
                  total_automation_eligible: totalAutomationEligible,
                  total_update_successful: 0,
                  total_update_unsuccessful: 0
                },
                eligible_tasks: eligibleTasks.map(t => ({
                  id: t.id,
                  hs_task_subject: t.hs_task_subject,
                  hubspot_owner_id: t.hubspot_owner_id,
                  status: t.status,
                  hs_timestamp: t.hs_timestamp,
                  hs_queue_membership_ids: t.hs_queue_membership_ids,
                  automation_enabled: t.automation_enabled,
                  hs_update_successful: null
                }))
              }
            }
          })
          .eq('id', eventId);
        
        continue;
      }

      // Separate automation-enabled tasks into overdue vs future
      const tasksToComplete = tasksToProcess.filter(t => t.status === 'overdue');
      const tasksToSkip = tasksToProcess.filter(t => t.status === 'future');

      console.log(`[Call Creations] Processing ${tasksToProcess.length} automation-enabled tasks: ${tasksToComplete.length} overdue, ${tasksToSkip.length} future`);

      // Prepare batch update for HubSpot (all automation-enabled tasks)
      const taskUpdates = tasksToProcess.map(task => ({
        id: task.id,
        properties: {
          hs_task_status: 'COMPLETED'
        }
      }));

      const batchResponse = await fetch(
        'https://api.hubapi.com/crm/v3/objects/tasks/batch/update',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${hubspotToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ inputs: taskUpdates })
        }
      );

      if (!batchResponse.ok) {
        console.error(`[Call Creations] Failed to complete tasks in HubSpot: ${batchResponse.status}`);
        const updateUnsuccessful = tasksToProcess.length;
        
        
        let errorBody;
        try {
          errorBody = await batchResponse.json();
        } catch {
          errorBody = await batchResponse.text();
        }
        
        await supabase
          .from('error_logs')
          .insert({
            event_id: eventId,
            context: 'call_created',
            error_type: 'api',
            endpoint: 'https://api.hubapi.com/crm/v3/objects/tasks/batch/update',
            status_code: batchResponse.status,
            response_error: batchResponse.statusText,
            response_message: typeof errorBody === 'object' ? JSON.stringify(errorBody) : errorBody
          });

        await supabase
          .from('events')
          .update({
            logs: {
              call_details: callDetailsLog,
              task_updates: {
                summary: {
                  total_incomplete: totalIncomplete,
                  total_automation_eligible: totalAutomationEligible,
                  total_update_successful: 0,
                  total_update_unsuccessful: tasksToProcess.length
                },
                eligible_tasks: eligibleTasks.map(t => {
                  const wasProcessed = tasksToProcess.some(tp => tp.id === t.id);
                  return {
                    id: t.id,
                    hs_task_subject: t.hs_task_subject,
                    hubspot_owner_id: t.hubspot_owner_id,
                    status: t.status,
                    hs_timestamp: t.hs_timestamp,
                    hs_queue_membership_ids: t.hs_queue_membership_ids,
                    automation_enabled: t.automation_enabled,
                    hs_update_successful: wasProcessed ? false : null
                  };
                })
              }
            },
            error_details: {
              error_type: 'batch_update_failed',
              status_code: batchResponse.status,
              message: batchResponse.statusText
            }
          })
          .eq('id', eventId);
        
        errors++;
        continue;
      }

      // Parse batch response
      const batchResult = await batchResponse.json();
      console.log(`[Call Creations] Batch update successful for ${tasksToProcess.length} tasks`);

      // Step 1: Parse HubSpot batch response to track individual task success/failure
      const hubspotUpdateStatus = new Map<string, boolean>();

      // Mark successful tasks
      if (batchResult.results && Array.isArray(batchResult.results)) {
        batchResult.results.forEach((result: any) => {
          hubspotUpdateStatus.set(result.id, true);
        });
      }

      // Mark failed tasks and log errors
      if (batchResult.errors && Array.isArray(batchResult.errors)) {
        for (const error of batchResult.errors) {
          const failedTaskIds = error.context?.id || [];
          failedTaskIds.forEach((id: string) => {
            hubspotUpdateStatus.set(id, false);
          });

          // Log individual task failures to error_logs
          await supabase
            .from('error_logs')
            .insert({
              event_id: eventId,
              context: 'call_created',
              error_type: 'batch_task_failed',
              endpoint: 'https://api.hubapi.com/crm/v3/objects/tasks/batch/update',
              status_code: null,
              response_error: error.category || 'UNKNOWN',
              response_message: `Task IDs: ${failedTaskIds.join(', ')} - ${error.message}`
            });
        }
      }

      // For any tasks we sent but didn't get explicit success/failure, mark as failed
      tasksToProcess.forEach(task => {
        if (!hubspotUpdateStatus.has(task.id)) {
          hubspotUpdateStatus.set(task.id, false);
        }
      });

      // Step 2: Initialize local DB update status tracking
      const localUpdateStatus = new Map<string, boolean>();
      tasksToProcess.forEach(task => {
        localUpdateStatus.set(task.id, false);
      });

      const completionTime = new Date().toISOString();

      // Step 3: Update overdue tasks locally (is_skipped = null)
      for (const task of tasksToComplete) {
        const { error: updateError } = await supabase
          .from('hs_tasks')
          .update({
            hs_task_status: 'COMPLETED',
            hs_task_completion_count: 1,
            hs_task_completion_date: completionTime,
            marked_completed_by_automation: true,
            marked_completed_by_automation_id: task.automation_id,
            marked_completed_by_automation_source: 'phone_call',
            is_skipped: null,
            updated_at: completionTime
          })
          .eq('hs_object_id', task.id);

        if (updateError) {
          console.error(`[Call Creations] Error updating task ${task.id} locally:`, updateError);
          
          // Log local DB update failure
          await supabase
            .from('error_logs')
            .insert({
              event_id: eventId,
              context: 'call_created',
              error_type: 'database',
              endpoint: null,
              status_code: null,
              response_error: 'supabase_update_failed',
              response_message: `Failed to update task ${task.id} locally: ${updateError.message}`
            });
          
          continue;
        }

        // Mark as successful in local DB
        localUpdateStatus.set(task.id, true);
      }

      // Step 4: Update future tasks locally (is_skipped = true)
      for (const task of tasksToSkip) {
        const { error: updateError } = await supabase
          .from('hs_tasks')
          .update({
            hs_task_status: 'COMPLETED',
            hs_task_completion_count: 1,
            hs_task_completion_date: completionTime,
            marked_completed_by_automation: true,
            marked_completed_by_automation_id: task.automation_id,
            marked_completed_by_automation_source: 'phone_call',
            is_skipped: true,
            updated_at: completionTime
          })
          .eq('hs_object_id', task.id);

        if (updateError) {
          console.error(`[Call Creations] Error updating task ${task.id} locally:`, updateError);
          
          // Log local DB update failure
          await supabase
            .from('error_logs')
            .insert({
              event_id: eventId,
              context: 'call_created',
              error_type: 'database',
              endpoint: null,
              status_code: null,
              response_error: 'supabase_update_failed',
              response_message: `Failed to update task ${task.id} locally: ${updateError.message}`
            });
          
          continue;
        }

        // Mark as successful in local DB
        localUpdateStatus.set(task.id, true);
      }

      // Step 5: Calculate final success counts (both HubSpot AND local DB must succeed)
      let updateSuccessful = 0;
      let updateUnsuccessful = 0;

      tasksToProcess.forEach(task => {
        const hubspotSuccess = hubspotUpdateStatus.get(task.id) || false;
        const localSuccess = localUpdateStatus.get(task.id) || false;
        
        if (hubspotSuccess && localSuccess) {
          updateSuccessful++;
        } else {
          updateUnsuccessful++;
        }
      });

      // Step 6: Update event with final summary including per-task status
      await supabase
        .from('events')
        .update({
          logs: {
            call_details: callDetailsLog,
            task_updates: {
              summary: {
                total_incomplete: totalIncomplete,
                total_automation_eligible: totalAutomationEligible,
                total_update_successful: updateSuccessful,
                total_update_unsuccessful: updateUnsuccessful
              },
              eligible_tasks: eligibleTasks.map(t => {
                const wasProcessed = tasksToProcess.some(tp => tp.id === t.id);
                const hubspotSuccess = hubspotUpdateStatus.get(t.id);
                const localSuccess = localUpdateStatus.get(t.id);
                
                return {
                  id: t.id,
                  hs_task_subject: t.hs_task_subject,
                  hubspot_owner_id: t.hubspot_owner_id,
                  status: t.status,
                  hs_timestamp: t.hs_timestamp,
                  hs_queue_membership_ids: t.hs_queue_membership_ids,
                  automation_enabled: t.automation_enabled,
                  hs_update_successful: wasProcessed ? (hubspotSuccess && localSuccess) : null
                };
              })
            }
          }
        })
        .eq('id', eventId);

      console.log(`[Call Creations] Updated event ${eventId} with final counts: ${updateSuccessful} successful, ${updateUnsuccessful} unsuccessful out of ${totalIncomplete} incomplete (${totalAutomationEligible} automation-eligible)`);
      console.log(`[Call Creations] Completed ${tasksToComplete.length} overdue tasks (is_skipped=null) and ${tasksToSkip.length} future tasks (is_skipped=true)`);
      successful++;

    } catch (error) {
      console.error(`[Call Creations] Error processing call ${callId}:`, error);
      errors++;
    }
  }

  return { processed: events.length, successful, errors };
}
