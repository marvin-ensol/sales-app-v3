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
    // Only process creation types (create_on_entry, create_from_sequence)
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
        exit_contact_list_block
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
          exit_contact_list_block
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
      // Filter out any non-creation types as a safety check
      dueRuns = dueRuns.filter(run => 
        run.type === 'create_on_entry' || run.type === 'create_from_sequence'
      );

      if (dueRuns.length === 0) {
        console.log(`[${executionId}] No creation-type runs to process after filtering`);
      } else {
        // Separate batch runs (list-level) from individual runs (per-contact)
        const batchRuns = dueRuns.filter(run => 
          run.type === 'create_on_entry' && run.hs_trigger_object === 'list' && run.actioned_run_ids
        );
        const individualRuns = dueRuns.filter(run => 
          !(run.type === 'create_on_entry' && run.hs_trigger_object === 'list' && run.actioned_run_ids)
        );

        console.log(`[${executionId}] Processing ${dueRuns.length} runs: ${batchRuns.length} batch (list-level), ${individualRuns.length} individual`);
        
        const hubspotToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN');
        if (!hubspotToken) {
          console.error(`[${executionId}] ❌ HUBSPOT_ACCESS_TOKEN not configured`);
          throw new Error('HUBSPOT_ACCESS_TOKEN not configured');
        }

        // ===== PROCESS BATCH RUNS FIRST =====
        for (const batchRun of batchRuns) {
          console.log(`[${executionId}] 📦 Processing batch run for list ${batchRun.hs_trigger_object_id}...`);
          
          try {
            // Extract contact IDs from actioned_run_ids
            const contactIds = (batchRun.actioned_run_ids as any[]).map(item => item.contact_id).filter(Boolean);
            
            if (contactIds.length === 0) {
              console.error(`[${executionId}] ❌ Batch run has no contact IDs`);
              await supabase
                .from('task_automation_runs')
                .update({ 
                  hs_action_successful: false,
                  failure_description: 'No contact IDs found in batch run'
                })
                .eq('id', batchRun.id);
              continue;
            }

            console.log(`[${executionId}] 📞 Batch creating tasks for ${contactIds.length} contacts...`);

            // Fetch automation config to get task_owner_setting
            const { data: automationData, error: automationError } = await supabase
              .from('task_automations')
              .select('tasks_configuration')
              .eq('id', batchRun.automation_id)
              .single();

            if (automationError || !automationData) {
              console.error(`[${executionId}] ❌ Failed to fetch automation config:`, automationError);
              await supabase
                .from('task_automation_runs')
                .update({ 
                  hs_action_successful: false,
                  failure_description: 'Failed to fetch automation configuration'
                })
                .eq('id', batchRun.id);
              continue;
            }

            const tasksConfig = automationData.tasks_configuration as any;
            const firstTaskConfig = tasksConfig?.tasks?.[0];
            const taskOwnerSetting = firstTaskConfig?.task_owner_setting || 'no_owner';

            // Fetch contacts and build batch task payload
            const { data: contacts, error: contactsError } = await supabase
              .from('hs_contacts')
              .select('hs_object_id, hubspot_owner_id')
              .in('hs_object_id', contactIds);

            if (contactsError) {
              console.error(`[${executionId}] ❌ Failed to fetch contacts:`, contactsError);
              await supabase
                .from('task_automation_runs')
                .update({ 
                  hs_action_successful: false,
                  failure_description: 'Failed to fetch contacts from database'
                })
                .eq('id', batchRun.id);
              continue;
            }

            // VALIDATE: Check if all contact IDs were found
            const foundContactIds = new Set(contacts.map(c => c.hs_object_id));
            const missingContactIds = contactIds.filter(id => !foundContactIds.has(id));

            if (missingContactIds.length > 0) {
              console.warn(`[Batch Run ${batchRun.id}] ⚠️ Warning: ${missingContactIds.length} contact(s) not found in hs_contacts:`, missingContactIds.slice(0, 5));
            }

            if (contacts.length === 0) {
              console.error(`[Batch Run ${batchRun.id}] ❌ No valid contacts found - skipping batch`);
              await supabase
                .from('task_automation_runs')
                .update({
                  hs_action_successful: false,
                  failure_description: `No valid contacts found in hs_contacts. Contact IDs: ${contactIds.slice(0, 10).join(', ')}...`
                })
                .eq('id', batchRun.id);
              continue;
            }

            console.log(`[Batch Run ${batchRun.id}] ✅ Found ${contacts.length}/${contactIds.length} valid contacts in database`);

            // Build batch task inputs
            const batchInputs = contacts.map(contact => {
              const taskInput: any = {
                properties: {
                  hs_task_subject: firstTaskConfig?.task_name || 'Task',
                  hs_queue_membership_ids: batchRun.hs_queue_id,
                  hs_task_type: 'TODO',
                  hs_task_status: 'NOT_STARTED',
                  hs_timestamp: batchRun.planned_execution_timestamp,
                },
                associations: [{
                  to: { id: contact.hs_object_id },
                  types: [{
                    associationCategory: 'HUBSPOT_DEFINED',
                    associationTypeId: 204, // task-to-contact
                  }],
                }],
              };

              if (taskOwnerSetting === 'contact_owner' && contact.hubspot_owner_id) {
                taskInput.properties.hubspot_owner_id = contact.hubspot_owner_id;
              }

              return taskInput;
            });

            // Send batch request to HubSpot
            const batchResponse = await fetch('https://api.hubapi.com/crm/v3/objects/tasks/batch/create', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${hubspotToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ inputs: batchInputs }),
            });

            if (!batchResponse.ok) {
              const errorText = await batchResponse.text();
              console.error(`[${executionId}] ❌ HubSpot batch create failed (${batchResponse.status}):`, errorText);
              await supabase
                .from('task_automation_runs')
                .update({ 
                  hs_action_successful: false,
                  failure_description: `HubSpot API error: ${batchResponse.status}`
                })
                .eq('id', batchRun.id);
              continue;
            }

            const batchResult = await batchResponse.json();
            const successfulTasks = batchResult.results || [];
            const failedTasks = batchResult.errors || [];
            const successfulTaskIds = successfulTasks.map((task: any) => task.id);

            console.log(`[Batch Run ${batchRun.id}] ✅ Successfully created ${successfulTaskIds.length}/${contactIds.length} tasks in HubSpot`);
            console.log(`[Batch Run ${batchRun.id}] Task IDs: ${successfulTaskIds.slice(0, 10).join(', ')}${successfulTaskIds.length > 10 ? '...' : ''}`);

            if (failedTasks.length > 0) {
              console.warn(`[Batch Run ${batchRun.id}] ⚠️ ${failedTasks.length} task(s) failed:`, JSON.stringify(failedTasks.slice(0, 3)));
            }

            if (successfulTasks.length === 0) {
              console.error(`[${executionId}] ❌ No tasks created in HubSpot`);
              await supabase
                .from('task_automation_runs')
                .update({ 
                  hs_action_successful: false,
                  failure_description: failedTasks.length > 0 ? JSON.stringify(failedTasks) : 'No tasks created'
                })
                .eq('id', batchRun.id);
              continue;
            }

            // Insert tasks into hs_tasks
            const tasksToInsert = successfulTasks.map((task: any) => ({
              hs_object_id: task.id,
              hs_task_subject: task.properties?.hs_task_subject || null,
              hs_task_body: task.properties?.hs_task_body || null,
              hs_body_preview: task.properties?.hs_body_preview || null,
              hs_task_status: task.properties?.hs_task_status || 'NOT_STARTED',
              hs_task_priority: task.properties?.hs_task_priority || null,
              hs_task_type: task.properties?.hs_task_type || 'TODO',
              hs_timestamp: task.properties?.hs_timestamp || null,
              hs_queue_membership_ids: task.properties?.hs_queue_membership_ids || null,
              hubspot_owner_id: task.properties?.hubspot_owner_id || null,
              hs_createdate: task.createdAt || null,
              hs_lastmodifieddate: task.updatedAt || null,
              created_by_automation: true,
              created_by_automation_id: batchRun.automation_id,
              number_in_sequence: 1,
              archived: false,
              updated_at: new Date().toISOString()
            }));

            const { error: insertError } = await supabase
              .from('hs_tasks')
              .upsert(tasksToInsert, { onConflict: 'hs_object_id', ignoreDuplicates: false });

            if (insertError) {
              console.error(`[${executionId}] ❌ Failed to insert tasks:`, insertError);
            } else {
              console.log(`[${executionId}] ✅ Inserted ${tasksToInsert.length} tasks into hs_tasks`);
            }

            // Update automation run with results
            await supabase
              .from('task_automation_runs')
              .update({
                hs_action_successful: true,
                hs_actioned_task_ids: successfulTaskIds,
                failure_description: failedTasks.length > 0 ? JSON.stringify(failedTasks) : null
              })
              .eq('id', batchRun.id);

            console.log(`[${executionId}] ✅ Batch run completed: ${successfulTaskIds.length} tasks created`);

          } catch (error) {
            console.error(`[${executionId}] ❌ Error processing batch run:`, error);
            await supabase
              .from('task_automation_runs')
              .update({ 
                hs_action_successful: false,
                failure_description: error instanceof Error ? error.message : 'Unknown error'
              })
              .eq('id', batchRun.id);
          }
        }

        // ===== BATCH CONTACT REFRESH FOR INDIVIDUAL RUNS =====
        // Extract unique contact IDs from individual runs and force refresh from HubSpot
        const contactIdsToRefresh = [...new Set(
          individualRuns
            .map(run => run.hs_contact_id)
            .filter(Boolean)
        )];

        // Continue with individual runs processing...
        dueRuns = individualRuns;

        console.log(`[${executionId}] 📞 Refreshing ${contactIdsToRefresh.length} contact(s) from HubSpot...`);

        if (contactIdsToRefresh.length > 0) {
          try {
            const contactResponse = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/batch/read', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${hubspotToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                inputs: contactIdsToRefresh.map(id => ({ id })),
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
              
              console.log(`[${executionId}] ✅ Fetched ${contacts.length} contact(s) from HubSpot`);
              
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
                console.error(`[${executionId}] ❌ Failed to refresh contacts:`, upsertError);
              } else {
                console.log(`[${executionId}] ✅ Refreshed ${contactsToUpsert.length} contact(s) in hs_contacts`);
                const contactsWithOwners = contacts.filter(c => c.properties?.hubspot_owner_id).length;
                console.log(`[${executionId}] 📋 Contacts with owners: ${contactsWithOwners}, without owners: ${contacts.length - contactsWithOwners}`);
              }
            } else {
              console.warn(`[${executionId}] ⚠️ Failed to fetch contacts from HubSpot (${contactResponse.status})`);
            }
          } catch (error) {
            console.error(`[${executionId}] ❌ Error refreshing contacts:`, error);
          }
        }

        // Phase 1: Build batch payload
        const batchInputs = [];
        const runMetadata = []; // Track run details for later processing

      for (const run of dueRuns) {
        // ==== PHASE 3: CONTACT RESOLUTION ====
        // If hs_contact_id is NULL, try to resolve via hs_membership_id
        let contactId = run.hs_contact_id;
        
        if (!contactId && run.hs_membership_id) {
          console.log(`[${executionId}] ⚠️ Run ${run.id} has NULL contact, resolving via membership ${run.hs_membership_id}...`);
          
          try {
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
              
              // Try one more contact sync attempt
              console.log(`[${executionId}] 🔄 Attempting to sync contact ${contactId}...`);
              
              const hubspotToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN');
              if (hubspotToken) {
                try {
                  const contactResponse = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/batch/read', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${hubspotToken}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      inputs: [{ id: contactId }],
                      properties: ['firstname', 'lastname', 'createdate', 'lastmodifieddate', 'mobilephone', 'ensol_source_group', 'hs_lead_status', 'lifecyclestage', 'hubspot_owner_id']
                    }),
                  });

                  if (contactResponse.ok) {
                    const contactData = await contactResponse.json();
                    const contacts = contactData.results || [];
                    
                    if (contacts.length > 0) {
                      const contact = contacts[0];
                      
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
                      
                      const contactToUpsert = {
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
                      
                      await supabase
                        .from('hs_contacts')
                        .upsert(contactToUpsert, { 
                          onConflict: 'hs_object_id',
                          ignoreDuplicates: false 
                        });
                      
                      console.log(`[${executionId}] ✅ Synced contact ${contactId} to hs_contacts`);
                    }
                  }
                } catch (error) {
                  console.error(`[${executionId}] ⚠️ Failed to sync contact:`, error);
                }
              }
            } else {
              console.error(`[${executionId}] ❌ Membership ${run.hs_membership_id} not found or has no hs_object_id`);
            }
          } catch (error) {
            console.error(`[${executionId}] ❌ Error resolving contact via membership:`, error);
          }
        }
        
        // If still no contact, skip this run and mark as failed
        if (!contactId) {
          console.error(`[${executionId}] ❌ Cannot process run ${run.id}: no contact ID available`);
          
          await supabase
            .from('task_automation_runs')
            .update({ 
              failure_description: 'Failed to resolve contact ID. Contact not found in hs_contacts and could not be synced from HubSpot.',
            })
            .eq('id', run.id);
          
          continue; // Skip this run
        }
        
    // If task_owner_setting is 'contact_owner' and hs_owner_id_contact is NULL,
    // try to fetch it from the contact we just resolved/synced
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
        console.warn(`[${executionId}] ⚠️ Contact ${contactId} has no owner in hs_contacts`);
      }
    }

    // Determine owner ID based on task_owner_setting
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

        const taskInput: any = {
          properties: {
            hs_task_subject: run.task_name,
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
                  associationTypeId: 204, // task-to-contact
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
          task_name: run.task_name,
          hs_queue_id: run.hs_queue_id,
          planned_execution_timestamp: run.planned_execution_timestamp,
          position_in_sequence: run.position_in_sequence,
          hubspot_owner_id: hubspotOwnerId,
          hs_contact_id: contactId,
        });
      }

      console.log(`[${executionId}] 🚀 Creating ${batchInputs.length} tasks via batch API...`);

      // Phase 2: Single batch API call to HubSpot
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
        console.error(`[${executionId}] ❌ Batch create failed (${hubspotResponse.status}):`, errorText);
        throw new Error(`HubSpot batch API error (${hubspotResponse.status}): ${errorText}`);
      }

      const batchResult = await hubspotResponse.json();
      const createdTasks = batchResult.results || [];
      
      console.log(`[${executionId}] ✅ Batch create successful: ${createdTasks.length} tasks created`);

      // Phase 3: Batch insert to hs_tasks
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
        console.error(`[${executionId}] ❌ Batch insert to hs_tasks failed:`, batchInsertError);
        throw batchInsertError;
      }

      console.log(`[${executionId}] ✅ Batch inserted ${hsTasksRecords.length} records to hs_tasks`);

      // Phase 4: Batch update task_automation_runs (parallel updates)
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
        console.warn(`[${executionId}] ⚠️ ${failureCount} automation run updates failed`);
      }

      console.log(`[${executionId}] 🎉 Batch complete: ${successCount} succeeded, ${failureCount} failed`);
      }
    } else {
      console.log(`[${executionId}] No automation runs due at this time`);
    }

    // Note: complete_on_exit type is now handled immediately in auto-complete-exited-tasks
    // No scheduled execution needed for this type

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
