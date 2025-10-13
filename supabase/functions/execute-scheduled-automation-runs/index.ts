import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

/**
 * Helper to parse HubSpot contact timestamps
 */
function parseContactTimestamp(value: any): string | null {
  if (!value || value === '' || value === 'null' || value === '0') return null;
  
  if (typeof value === 'string' && value.includes('T') && value.includes('Z')) {
    const date = new Date(value);
    return !isNaN(date.getTime()) && date.getFullYear() > 1970 ? date.toISOString() : null;
  }
  
  const timestamp = parseInt(String(value));
  if (isNaN(timestamp) || timestamp === 0) return null;
  const date = new Date(timestamp);
  return date.getFullYear() > 1970 ? date.toISOString() : null;
}

/**
 * Unified contact sync utility
 */
async function syncContactsFromHubSpot(options: {
  contactIds: string[];
  hubspotToken: string;
  supabase: any;
  forceRefresh?: boolean;
  maxAge?: number;
}): Promise<{
  synced: number;
  failed: number;
  contactsWithOwners: number;
  contactsWithoutOwners: number;
}> {
  const { contactIds, hubspotToken, supabase, forceRefresh = false, maxAge } = options;
  
  if (contactIds.length === 0) {
    return { synced: 0, failed: 0, contactsWithOwners: 0, contactsWithoutOwners: 0 };
  }

  // If not forcing refresh and maxAge specified, check which contacts need refresh
  let contactsToFetch = contactIds;
  
  if (!forceRefresh && maxAge) {
    const cutoffDate = new Date(Date.now() - maxAge).toISOString();
    
    const { data: existingContacts } = await supabase
      .from('hs_contacts')
      .select('hs_object_id, hubspot_owner_id, updated_at')
      .in('hs_object_id', contactIds);
    
    const existingMap = new Map(
      existingContacts?.map((c: any) => [c.hs_object_id, c]) || []
    );
    
    contactsToFetch = contactIds.filter(id => {
      const existing = existingMap.get(id);
      if (!existing) return true;
      if (!existing.hubspot_owner_id) return true;
      if (new Date(existing.updated_at) < new Date(cutoffDate)) return true;
      return false;
    });
    
    console.log(`📊 ${contactsToFetch.length}/${contactIds.length} contacts need refresh`);
  }
  
  if (contactsToFetch.length === 0) {
    return { synced: 0, failed: 0, contactsWithOwners: 0, contactsWithoutOwners: 0 };
  }

  const batchSize = 100;
  let syncedCount = 0;
  let failedCount = 0;
  let withOwners = 0;
  let withoutOwners = 0;

  for (let i = 0; i < contactsToFetch.length; i += batchSize) {
    const batch = contactsToFetch.slice(i, i + batchSize);
    
    try {
      const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/batch/read', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hubspotToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: batch.map(id => ({ id })),
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

      if (!response.ok) {
        console.error(`❌ Batch fetch failed: ${response.status}`);
        failedCount += batch.length;
        continue;
      }

      const data = await response.json();
      const contacts = data.results || [];
      
      const contactsToUpsert = contacts.map((contact: any) => {
        const hasOwner = !!contact.properties?.hubspot_owner_id;
        if (hasOwner) withOwners++;
        else withoutOwners++;
        
        return {
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
        };
      });
      
      const { error: upsertError } = await supabase
        .from('hs_contacts')
        .upsert(contactsToUpsert, { 
          onConflict: 'hs_object_id',
          ignoreDuplicates: false 
        });
      
      if (upsertError) {
        console.error(`❌ Upsert failed:`, upsertError);
        failedCount += contacts.length;
      } else {
        syncedCount += contacts.length;
      }
      
      if (i + batchSize < contactsToFetch.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`❌ Error in batch sync:`, error);
      failedCount += batch.length;
    }
  }

  return {
    synced: syncedCount,
    failed: failedCount,
    contactsWithOwners: withOwners,
    contactsWithoutOwners: withoutOwners
  };
}

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

    const executionId = `exec_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    console.log(`[${executionId}] === SCHEDULED AUTOMATION RUNS EXECUTION START ===`);
    
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

    // CRITICAL FIX: Add hs_membership_id to SELECT
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
        exit_contact_list_block,
        hs_membership_id
      `)
      .eq('hs_action_successful', false)
      .or('exit_contact_list_block.is.null,exit_contact_list_block.eq.false')
      .in('type', ['create_on_entry', 'create_from_sequence'])
      .gte('planned_execution_timestamp', startOfMinute.toISOString())
      .lte('planned_execution_timestamp', endOfMinute.toISOString())
      .order('planned_execution_timestamp', { ascending: true });

    if (queryError) {
      console.error(`[${executionId}] Error querying automation runs:`, queryError);
      throw queryError;
    }

    console.log(`[${executionId}] Primary query found ${dueRuns?.length || 0} automation runs due for execution`);

    // Fallback for missed runs
    if (!dueRuns || dueRuns.length === 0) {
      const fallbackStart = new Date(startOfMinute.getTime() - 10 * 60 * 1000);
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
          exit_contact_list_block,
          hs_membership_id
        `)
        .eq('hs_action_successful', false)
        .or('exit_contact_list_block.is.null,exit_contact_list_block.eq.false')
        .in('type', ['create_on_entry', 'create_from_sequence'])
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
      dueRuns = dueRuns.filter(run => 
        run.type === 'create_on_entry' || run.type === 'create_from_sequence'
      );

      if (dueRuns.length === 0) {
        console.log(`[${executionId}] No creation-type runs to process after filtering`);
      } else {
        console.log(`[${executionId}] Processing ${dueRuns.length} runs (types: create_on_entry, create_from_sequence)`);
        
        const hubspotToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN');
        if (!hubspotToken) {
          console.error(`[${executionId}] ❌ HUBSPOT_ACCESS_TOKEN not configured`);
          throw new Error('HUBSPOT_ACCESS_TOKEN not configured');
        }

        // Batch contact refresh
        const uniqueContactIds = [...new Set(
          dueRuns
            .map(run => run.hs_contact_id)
            .filter(Boolean)
        )];

        console.log(`[${executionId}] 📞 Checking freshness of ${uniqueContactIds.length} contact(s)...`);

        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const { data: staleContacts } = await supabase
          .from('hs_contacts')
          .select('hs_object_id, updated_at')
          .in('hs_object_id', uniqueContactIds)
          .or(`hubspot_owner_id.is.null,updated_at.lt.${tenMinutesAgo}`);

        const staleContactIds = staleContacts?.map(c => c.hs_object_id) || [];

        if (staleContactIds.length > 0) {
          console.log(`[${executionId}] 🔄 Refreshing ${staleContactIds.length} stale contact(s)...`);
          
          const result = await syncContactsFromHubSpot({
            contactIds: staleContactIds,
            hubspotToken,
            supabase,
            forceRefresh: true
          });
          
          console.log(`[${executionId}] ✅ Batch refresh complete:`, result);
        } else {
          console.log(`[${executionId}] ✅ All contacts are fresh (< 10 minutes old)`);
        }

        // === BATCH-SPLITTING: Process runs in chunks of ≤100 ===
        const CHUNK_SIZE = 100;
        const chunks = [];
        for (let i = 0; i < dueRuns.length; i += CHUNK_SIZE) {
          chunks.push(dueRuns.slice(i, i + CHUNK_SIZE));
        }

        console.log(`[${executionId}] 📦 Split ${dueRuns.length} runs into ${chunks.length} chunk(s) of max ${CHUNK_SIZE}`);

        let totalProcessed = 0;
        let totalCreated = 0;
        let totalFailed = 0;

        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
          const chunk = chunks[chunkIndex];
          console.log(`[${executionId}] 🔄 Processing chunk ${chunkIndex + 1}/${chunks.length} (${chunk.length} runs)...`);

          const batchInputs = [];
          const runMetadata = [];

          for (const run of chunk) {
            let contactId = run.hs_contact_id;
            
            if (!contactId && run.hs_membership_id) {
              console.log(`[${executionId}] ⚠️ Run ${run.id} has NULL contact, resolving via membership ${run.hs_membership_id}...`);
              
              const { data: membership, error: membershipError } = await supabase
                .from('hs_list_memberships')
                .select('hs_object_id')
                .eq('id', run.hs_membership_id)
                .maybeSingle();
              
              if (membershipError) {
                console.error(`[${executionId}] ❌ Error fetching membership:`, membershipError);
              } else if (membership?.hs_object_id) {
                contactId = membership.hs_object_id;
                console.log(`[${executionId}] ✅ Resolved contact ${contactId} from membership`);
                
                const result = await syncContactsFromHubSpot({
                  contactIds: [contactId],
                  hubspotToken,
                  supabase,
                  forceRefresh: true
                });
                console.log(`[${executionId}] 🔄 Synced contact:`, result);
              } else {
                console.error(`[${executionId}] ❌ Membership ${run.hs_membership_id} not found or has no hs_object_id`);
              }
            }
            
            if (!contactId) {
              console.error(`[${executionId}] ❌ Cannot process run ${run.id}: no contact ID available`);
              
              await supabase
                .from('task_automation_runs')
                .update({ 
                  failure_description: 'Failed to resolve contact ID',
                })
                .eq('id', run.id);
              
              totalFailed++;
              continue;
            }
            
            if (run.task_owner_setting === 'contact_owner' && !run.hs_owner_id_contact && contactId) {
              const { data: contactData, error: contactFetchError } = await supabase
                .from('hs_contacts')
                .select('hubspot_owner_id')
                .eq('hs_object_id', contactId)
                .maybeSingle();
              
              if (!contactFetchError && contactData?.hubspot_owner_id) {
                console.log(`[${executionId}] 📋 Resolved contact owner from hs_contacts: ${contactData.hubspot_owner_id}`);
                run.hs_owner_id_contact = contactData.hubspot_owner_id;
              } else {
                console.warn(`[${executionId}] ⚠️ Contact ${contactId} has no owner (unassigned task)`);
              }
            }

            let hubspotOwnerId = null;
            if (run.task_owner_setting === 'contact_owner') {
              hubspotOwnerId = run.hs_owner_id_contact;
              console.log(`[${executionId}] 👤 Task owner from contact: ${hubspotOwnerId || 'NULL (no owner)'}`);
            } else if (run.task_owner_setting === 'previous_task_owner') {
              hubspotOwnerId = run.hs_owner_id_previous_task;
              console.log(`[${executionId}] 👤 Task owner from previous task: ${hubspotOwnerId || 'NULL (no owner)'}`);
            } else if (run.task_owner_setting === 'no_owner') {
              console.log(`[${executionId}] 👤 Task owner setting: no_owner (unassigned)`);
            }

            // Defensive check: ensure task name is not empty
            const taskSubject = run.task_name || 'Automated Task (No Name)';
            if (!run.task_name) {
              console.warn(`[${executionId}] ⚠️ Run ${run.id} has empty task_name, using default`);
            }

            const taskInput: any = {
              properties: {
                hs_task_subject: taskSubject,
                hs_queue_membership_ids: run.hs_queue_id,
                hs_task_type: 'TODO',
                hs_task_status: 'NOT_STARTED',
                hs_timestamp: run.planned_execution_timestamp,
              },
              associations: [
                {
                  to: { id: contactId },
                  types: [
                    {
                      associationCategory: 'HUBSPOT_DEFINED',
                      associationTypeId: 204,
                    },
                  ],
                },
              ],
            };

            if (hubspotOwnerId) {
              taskInput.properties.hubspot_owner_id = hubspotOwnerId;
            }

            batchInputs.push(taskInput);
            runMetadata.push({
              run_id: run.id,
              automation_id: run.automation_id,
              task_name: taskSubject,
              hs_queue_id: run.hs_queue_id,
              planned_execution_timestamp: run.planned_execution_timestamp,
              position_in_sequence: run.position_in_sequence,
              hubspot_owner_id: hubspotOwnerId,
              hs_contact_id: contactId,
            });
          }

          // Guardrail: Skip HubSpot call if no valid inputs
          if (batchInputs.length === 0) {
            console.log(`[${executionId}] ⚠️ Chunk ${chunkIndex + 1}: No valid tasks to create after filtering`);
            continue;
          }

          // Guardrail: Verify chunk size
          if (batchInputs.length > 100) {
            console.error(`[${executionId}] 🚨 HubSpot batch limit guard: chunk size ${batchInputs.length} exceeds 100!`);
            throw new Error(`Batch size ${batchInputs.length} exceeds HubSpot limit of 100`);
          }

          console.log(`[${executionId}] 🚀 Chunk ${chunkIndex + 1}: Creating ${batchInputs.length} tasks via HubSpot batch API...`);

          // Call HubSpot batch API
          try {
            const batchPayload = { inputs: batchInputs };
            const hubspotResponse = await fetch('https://api.hubapi.com/crm/v3/objects/tasks/batch/create', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${hubspotToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(batchPayload),
            });

            if (!hubspotResponse.ok) {
              const errorText = await hubspotResponse.text();
              console.error(`[${executionId}] ❌ Chunk ${chunkIndex + 1}: Batch create failed (${hubspotResponse.status}):`, errorText.substring(0, 500));
              
              // Don't throw - continue to next chunk
              totalFailed += batchInputs.length;
              continue;
            }

            const batchResult = await hubspotResponse.json();
            const createdTasks = batchResult.results || [];
            
            console.log(`[${executionId}] ✅ Chunk ${chunkIndex + 1}: Batch create successful - ${createdTasks.length} tasks created`);
            totalCreated += createdTasks.length;

            const hsTasksRecords = createdTasks.map((task: any, index: number) => ({
              hs_object_id: task.id,
              hs_task_subject: runMetadata[index].task_name,
              hs_task_type: 'TODO',
              hs_queue_membership_ids: runMetadata[index].hs_queue_id,
              hs_timestamp: runMetadata[index].planned_execution_timestamp,
              hs_task_status: 'NOT_STARTED',
              number_in_sequence: runMetadata[index].position_in_sequence,
              hubspot_owner_id: runMetadata[index].hubspot_owner_id,
              associated_contact_id: runMetadata[index].hs_contact_id,
              created_by_automation: true,
              created_by_automation_id: runMetadata[index].automation_id,
              archived: false,
            }));

            const { error: batchInsertError } = await supabase
              .from('hs_tasks')
              .insert(hsTasksRecords);

            if (batchInsertError) {
              console.error(`[${executionId}] ❌ Chunk ${chunkIndex + 1}: Batch insert to hs_tasks failed:`, batchInsertError);
            } else {
              console.log(`[${executionId}] ✅ Chunk ${chunkIndex + 1}: Inserted ${hsTasksRecords.length} records to hs_tasks`);
            }

            const updatePromises = createdTasks.map((task: any, index: number) => 
              supabase
                .from('task_automation_runs')
                .update({ 
                  hs_action_successful: true,
                  hs_actioned_task_ids: [task.id],
                })
                .eq('id', runMetadata[index].run_id)
            );

            const updateResults = await Promise.allSettled(updatePromises);
            const successCount = updateResults.filter(r => r.status === 'fulfilled').length;
            const failureCount = updateResults.filter(r => r.status === 'rejected').length;

            if (failureCount > 0) {
              console.warn(`[${executionId}] ⚠️ Chunk ${chunkIndex + 1}: ${failureCount} automation run updates failed`);
            }

            console.log(`[${executionId}] 🎉 Chunk ${chunkIndex + 1} complete: ${successCount} succeeded, ${failureCount} failed`);
            totalProcessed += successCount;
          } catch (chunkError) {
            console.error(`[${executionId}] ❌ Chunk ${chunkIndex + 1}: Exception:`, chunkError);
            totalFailed += batchInputs.length;
          }

          // Rate limit between chunks
          if (chunkIndex < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }

        console.log(`[${executionId}] 📊 Final summary: ${totalProcessed} processed, ${totalCreated} created, ${totalFailed} failed out of ${dueRuns.length} total runs`);

        // Post-run check: warn if many runs were not processed
        if (totalProcessed < dueRuns.length) {
          console.warn(`[${executionId}] ⚠️ Warning: Processed ${totalProcessed}/${dueRuns.length} runs (${dueRuns.length - totalProcessed} not processed)`);
        }
      }
    } else {
      console.log(`[${executionId}] No automation runs due at this time`);
    }

    // Monitor for very old stuck runs
    const { count: stuckCount } = await supabase
      .from('task_automation_runs')
      .select('*', { count: 'exact', head: true })
      .eq('hs_action_successful', false)
      .lt('planned_execution_timestamp', new Date(Date.now() - 15 * 60 * 1000).toISOString())
      .not('planned_execution_timestamp', 'is', null)
      .or('exit_contact_list_block.is.null,exit_contact_list_block.eq.false')
      .in('type', ['create_on_entry', 'create_from_sequence']);

    if (stuckCount && stuckCount > 0) {
      console.warn(`[${executionId}] ⚠️ Found ${stuckCount} stuck automation runs older than 15 minutes`);
    }

    console.log(`[${executionId}] === SCHEDULED AUTOMATION RUNS EXECUTION COMPLETE ===`);

    return new Response(
      JSON.stringify({
        success: true,
        execution_id: executionId,
        due_runs_count: dueRuns?.length || 0,
        stuck_runs_count: stuckCount || 0,
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
