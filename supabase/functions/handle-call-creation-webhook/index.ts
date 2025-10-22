import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const HUBSPOT_ACCESS_TOKEN = Deno.env.get('HUBSPOT_ACCESS_TOKEN');
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HubSpotCallEvent {
  appId: number;
  attemptNumber: number;
  changeFlag: string;
  changeSource: string;
  eventId: number;
  objectId: number;
  objectTypeId: string;
  occurredAt: number;
  portalId: number;
  subscriptionId: number;
  subscriptionType: string;
}

interface CallDetails {
  id: string;
  properties: {
    hs_call_duration: string;
    hs_call_direction: string;
    hs_call_disposition: string;
    hs_call_from_number: string;
    hs_call_to_number: string;
    hs_activity_type: string | null;
    hs_call_callee_object_id: string | null;
    hubspot_owner_id: string;
    hs_createdate: string;
    hs_lastmodifieddate: string;
    hs_object_id: string;
  };
  associations?: {
    contacts?: {
      results: Array<{
        id: string;
        type: string;
      }>;
    };
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const runId = `call_${Date.now()}`;
  console.log(`[${runId}] === CALL CREATION WEBHOOK START ===`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const hubspotToken = HUBSPOT_ACCESS_TOKEN!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const webhookPayload: HubSpotCallEvent[] = await req.json();
    console.log(`[${runId}] 📥 Received ${webhookPayload.length} event(s)`);

    const callEvents = webhookPayload.filter(
      event => event.changeFlag === 'NEW' && 
               event.objectTypeId === '0-48' &&
               event.subscriptionType === 'object.creation'
    );

    if (callEvents.length === 0) {
      console.log(`[${runId}] ⏭️ No call creation events to process`);
      return new Response(
        JSON.stringify({ message: 'No call creation events to process' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${runId}] 📞 Processing ${callEvents.length} call creation event(s)`);

    const results = [];
    let totalTasksCompleted = 0;

    for (const event of callEvents) {
      const callId = event.objectId.toString();
      
      try {
        console.log(`[${runId}] 🔍 Fetching details for call ${callId}`);
        
        const callResponse = await fetch(
          `https://api.hubapi.com/crm/v3/objects/calls/${callId}?properties=hs_call_duration,hs_call_direction,hs_call_disposition,hs_call_from_number,hs_call_to_number,hs_activity_type,hs_call_callee_object_id,hubspot_owner_id&associations=contacts`,
          {
            headers: {
              'Authorization': `Bearer ${hubspotToken}`,
              'Content-Type': 'application/json',
            }
          }
        );

        if (!callResponse.ok) {
          const errorText = await callResponse.text();
          throw new Error(`HubSpot API error: ${callResponse.status} - ${errorText}`);
        }

        const callDetails: CallDetails = await callResponse.json();
        
        const duration = parseInt(callDetails.properties.hs_call_duration || '0');
        const direction = callDetails.properties.hs_call_direction;
        const contactAssociations = callDetails.associations?.contacts?.results || [];

        if (direction !== 'OUTBOUND') {
          console.log(`[${runId}] ⏭️ Skipping call ${callId}: not outbound (${direction})`);
          continue;
        }

        if (duration < 2000) {
          console.log(`[${runId}] ⏭️ Skipping call ${callId}: duration ${duration}ms < 2000ms`);
          continue;
        }

        if (contactAssociations.length === 0) {
          console.log(`[${runId}] ⏭️ Skipping call ${callId}: no contact associations`);
          continue;
        }

        const contactId = contactAssociations[0].id;
        console.log(`[${runId}] 🎯 Processing call ${callId} for contact ${contactId}, duration: ${duration}ms`);

        const { data: eligibleTasks, error: queryError } = await supabase
          .from('hs_tasks')
          .select(`
            hs_object_id,
            associated_contact_id,
            hs_queue_membership_ids,
            task_categories!inner(
              id,
              hs_queue_id,
              task_automations!inner(
                id,
                automation_enabled,
                auto_complete_on_engagement
              )
            )
          `)
          .eq('associated_contact_id', contactId)
          .eq('hs_task_completion_count', 0)
          .eq('archived', false);

        if (queryError) {
          throw new Error(`Task query error: ${queryError.message}`);
        }

        console.log(`[${runId}] 📋 Found ${eligibleTasks?.length || 0} incomplete tasks for contact`);

        const tasksByAutomation = new Map();
        
        for (const task of eligibleTasks || []) {
          const categories = Array.isArray(task.task_categories) 
            ? task.task_categories 
            : [task.task_categories];
          
          for (const category of categories) {
            if (category.hs_queue_id === task.hs_queue_membership_ids) {
              const automations = Array.isArray(category.task_automations)
                ? category.task_automations
                : [category.task_automations];
              
              for (const automation of automations) {
                if (automation.automation_enabled && automation.auto_complete_on_engagement) {
                  if (!tasksByAutomation.has(automation.id)) {
                    tasksByAutomation.set(automation.id, {
                      automationId: automation.id,
                      queueId: category.hs_queue_id,
                      tasks: []
                    });
                  }
                  tasksByAutomation.get(automation.id).tasks.push(task.hs_object_id);
                }
              }
            }
          }
        }

        console.log(`[${runId}] 📊 Found ${tasksByAutomation.size} automation(s) with tasks to complete`);

        for (const [automationId, { queueId, tasks }] of tasksByAutomation) {
          if (tasks.length === 0) continue;

          console.log(`[${runId}] 🎯 Completing ${tasks.length} task(s) for automation ${automationId}`);

          try {
            const batchResponse = await fetch(
              'https://api.hubapi.com/crm/v3/objects/tasks/batch/update',
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${hubspotToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  inputs: tasks.map(taskId => ({
                    id: taskId,
                    properties: { hs_task_status: 'COMPLETED' }
                  }))
                })
              }
            );

            if (!batchResponse.ok) {
              const errorText = await batchResponse.text();
              throw new Error(`Batch update failed: ${batchResponse.status} - ${errorText}`);
            }

            const batchResult = await batchResponse.json();
            const successfulTasks = (batchResult.results || []).map((r: any) => r.id);
            const errors = batchResult.errors || [];

            console.log(`[${runId}] ✅ HubSpot: Completed ${successfulTasks.length} tasks, ${errors.length} errors`);

            if (successfulTasks.length > 0) {
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
                  marked_completed_source: 'phone_call',
                  updated_at: completionTimestamp
                })
                .in('hs_object_id', successfulTasks);

              if (updateError) {
                console.error(`[${runId}] ❌ Failed to update hs_tasks:`, updateError);
              } else {
                console.log(`[${runId}] ✅ Local DB: Updated ${successfulTasks.length} tasks`);
                totalTasksCompleted += successfulTasks.length;
              }

              const { error: runError } = await supabase
                .from('task_automation_runs')
                .insert({
                  automation_id: automationId,
                  type: 'complete_on_engagement',
                  hs_trigger_object: 'engagement',
                  hs_trigger_object_id: callId,
                  hs_contact_id: contactId,
                  hs_queue_id: queueId,
                  hs_actioned_task_ids: successfulTasks,
                  hs_action_successful: true,
                  failure_description: errors.length > 0 ? errors : null
                });

              if (runError) {
                console.error(`[${runId}] ⚠️ Failed to create automation run record:`, runError);
              } else {
                console.log(`[${runId}] ✅ Created automation run record`);
              }
            }

            results.push({
              callId,
              contactId,
              automationId,
              tasksCompleted: successfulTasks.length,
              status: 'success'
            });

          } catch (error) {
            console.error(`[${runId}] ❌ Error processing automation ${automationId}:`, error);
            
            await supabase
              .from('task_automation_runs')
              .insert({
                automation_id: automationId,
                type: 'complete_on_engagement',
                hs_trigger_object: 'engagement',
                hs_trigger_object_id: callId,
                hs_contact_id: contactId,
                hs_queue_id: queueId,
                hs_actioned_task_ids: [],
                hs_action_successful: false,
                failure_description: [{ message: (error as Error).message }]
              });

            results.push({
              callId,
              contactId,
              automationId,
              status: 'error',
              error: (error as Error).message
            });
          }
        }

      } catch (error) {
        console.error(`[${runId}] ❌ Error processing call ${callId}:`, error);
        results.push({
          callId,
          status: 'error',
          error: (error as Error).message
        });
      }
    }

    console.log(`[${runId}] 🎉 Webhook complete: ${totalTasksCompleted} total tasks completed`);

    return new Response(
      JSON.stringify({
        message: 'Call creation webhook processed',
        processed: callEvents.length,
        totalTasksCompleted,
        results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[${runId}] ❌ Webhook error:`, error);
    return new Response(
      JSON.stringify({
        error: 'Webhook processing failed',
        message: (error as Error).message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
