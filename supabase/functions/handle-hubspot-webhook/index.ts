import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
  };
  associations?: {
    contacts?: {
      results: Array<{ id: string }>;
    };
  };
}

serve(async (req) => {
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
      // Fetch call details from HubSpot
      const callResponse = await fetch(
        `https://api.hubapi.com/crm/v3/objects/calls/${callId}?properties=hs_call_direction,hs_call_duration&associations=contacts`,
        {
          headers: {
            'Authorization': `Bearer ${hubspotToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!callResponse.ok) {
        console.error(`[Call Creations] Failed to fetch call ${callId}: ${callResponse.status}`);
        errors++;
        continue;
      }

      const callDetails: CallDetails = await callResponse.json();
      const direction = callDetails.properties?.hs_call_direction;
      const durationMs = parseInt(callDetails.properties?.hs_call_duration || '0');
      const contactId = callDetails.associations?.contacts?.results?.[0]?.id;

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

      // Step 1: Fetch all enabled automation IDs with auto_complete_on_engagement
      const { data: automations, error: automationsError } = await supabase
        .from('task_automations')
        .select('id')
        .eq('automation_enabled', true)
        .eq('auto_complete_on_engagement', true);

      if (automationsError) {
        console.error(`[Call Creations] Error fetching automations:`, automationsError);
        errors++;
        continue;
      }

      if (!automations || automations.length === 0) {
        console.log(`[Call Creations] No enabled automations with auto_complete_on_engagement found`);
        continue;
      }

      const automationIds = automations.map(a => a.id);
      console.log(`[Call Creations] Found ${automationIds.length} automation(s) with auto_complete_on_engagement enabled`);

      // Step 2: Find incomplete tasks for this contact created by these automations
      const { data: tasks, error: tasksError } = await supabase
        .from('hs_tasks')
        .select(`
          hs_object_id,
          hs_task_subject,
          hubspot_owner_id,
          number_in_sequence,
          created_by_automation_id,
          hs_queue_membership_ids,
          hs_timestamp
        `)
        .eq('associated_contact_id', contactId)
        .neq('hs_task_status', 'COMPLETED')
        .not('created_by_automation_id', 'is', null)
        .in('created_by_automation_id', automationIds);

      if (tasksError) {
        console.error(`[Call Creations] Error fetching tasks for contact ${contactId}:`, tasksError);
        errors++;
        continue;
      }

      if (!tasks || tasks.length === 0) {
        console.log(`[Call Creations] No eligible tasks found for contact ${contactId}`);
        continue;
      }

      // Separate tasks into due/overdue (complete) vs future (skip) based on timestamp
      const currentTime = new Date();
      const currentTimeMs = currentTime.getTime();
      
      const tasksToComplete = tasks.filter(task => {
        if (!task.hs_timestamp) return true; // No due date = treat as due now
        const dueTimeMs = new Date(task.hs_timestamp).getTime();
        return dueTimeMs <= currentTimeMs; // Due or overdue
      });

      const tasksToSkip = tasks.filter(task => {
        if (!task.hs_timestamp) return false; // No due date = not skipped
        const dueTimeMs = new Date(task.hs_timestamp).getTime();
        return dueTimeMs > currentTimeMs; // Future task
      });

      console.log(`[Call Creations] Found ${tasksToComplete.length} due/overdue task(s) to complete and ${tasksToSkip.length} future task(s) to skip for contact ${contactId}`);

      // Complete ALL tasks in HubSpot (both groups)
      const taskUpdates = tasks.map(task => ({
        id: task.hs_object_id,
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
        errors++;
        continue;
      }

      const completionTime = new Date().toISOString();

      // Update due/overdue tasks locally (is_skipped = null)
      for (const task of tasksToComplete) {
        const { error: updateError } = await supabase
          .from('hs_tasks')
          .update({
            hs_task_status: 'COMPLETED',
            hs_task_completion_count: 1,
            hs_task_completion_date: completionTime,
            marked_completed_by_automation: true,
            marked_completed_by_automation_id: task.created_by_automation_id,
            marked_completed_by_automation_source: 'phone_call',
            is_skipped: null,
            updated_at: completionTime
          })
          .eq('hs_object_id', task.hs_object_id);

        if (updateError) {
          console.error(`[Call Creations] Error updating task ${task.hs_object_id} locally:`, updateError);
          continue;
        }

        // Create automation run record
        const { error: runError } = await supabase
          .from('task_automation_runs')
          .insert({
            automation_id: task.created_by_automation_id,
            type: 'complete_on_engagement',
            hs_trigger_object: 'engagement',
            hs_trigger_object_id: callId,
            hs_contact_id: contactId,
            hs_action_successful: true,
            hs_actioned_task_ids: [task.hs_object_id],
            task_name: task.hs_task_subject,
            hs_queue_id: task.hs_queue_membership_ids,
            position_in_sequence: task.number_in_sequence,
            hs_owner_id_previous_task: task.hubspot_owner_id
          });

        if (runError) {
          console.error(`[Call Creations] Error creating automation run for task ${task.hs_object_id}:`, runError);
        }
      }

      // Update future tasks locally (is_skipped = true)
      for (const task of tasksToSkip) {
        const { error: updateError } = await supabase
          .from('hs_tasks')
          .update({
            hs_task_status: 'COMPLETED',
            hs_task_completion_count: 1,
            hs_task_completion_date: completionTime,
            marked_completed_by_automation: true,
            marked_completed_by_automation_id: task.created_by_automation_id,
            marked_completed_by_automation_source: 'phone_call',
            is_skipped: true,
            updated_at: completionTime
          })
          .eq('hs_object_id', task.hs_object_id);

        if (updateError) {
          console.error(`[Call Creations] Error updating task ${task.hs_object_id} locally:`, updateError);
          continue;
        }

        // Create automation run record
        const { error: runError } = await supabase
          .from('task_automation_runs')
          .insert({
            automation_id: task.created_by_automation_id,
            type: 'complete_on_engagement',
            hs_trigger_object: 'engagement',
            hs_trigger_object_id: callId,
            hs_contact_id: contactId,
            hs_action_successful: true,
            hs_actioned_task_ids: [task.hs_object_id],
            task_name: task.hs_task_subject,
            hs_queue_id: task.hs_queue_membership_ids,
            position_in_sequence: task.number_in_sequence,
            hs_owner_id_previous_task: task.hubspot_owner_id
          });

        if (runError) {
          console.error(`[Call Creations] Error creating automation run for task ${task.hs_object_id}:`, runError);
        }
      }

      console.log(`[Call Creations] Completed ${tasksToComplete.length} due/overdue task(s) (is_skipped=null) and ${tasksToSkip.length} future task(s) (is_skipped=true)`);
      console.log(`[Call Creations] Successfully processed ${tasks.length} total task(s) for call ${callId}`);
      successful++;

    } catch (error) {
      console.error(`[Call Creations] Error processing call ${callId}:`, error);
      errors++;
    }
  }

  return { processed: events.length, successful, errors };
}
