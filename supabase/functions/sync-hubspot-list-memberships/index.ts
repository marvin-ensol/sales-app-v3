import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HubSpotMember {
  membershipTimestamp: string;
  recordId: string;
}

interface HubSpotMembershipsResponse {
  results: HubSpotMember[];
  paging?: {
    next?: {
      after: string;
    };
  };
  total: number;
}

interface TaskAutomation {
  id: string;
  hs_list_id: string;
  hs_list_object: string;
  task_category_id: number;
  auto_complete_on_exit_enabled: boolean;
  sequence_exit_enabled: boolean;
  automation_enabled: boolean;
  first_task_creation: boolean;
  tasks_configuration: any;
  schedule_configuration: any;
  schedule_enabled: boolean;
  timezone: string;
}

interface StoredListMember {
  hs_object_id: string;
  entry_event_id: number;
}

interface TaskCreationDetail {
  automation_enabled: boolean;
  hs_task_subject: string;
  hs_timestamp: string;
  hs_queue_membership_ids: string;
  hubspot_owner_id: string | null;
  id?: string;
  hs_update_successful?: boolean;
}

interface TaskCreationLogs {
  task_creation: {
    task_details: TaskCreationDetail[];
  };
}

/**
 * Calculate task due timestamp based on schedule configuration
 * Returns ISO timestamp string
 */
function calculateTaskDueTimestamp(
  scheduleConfig: any,
  scheduleEnabled: boolean,
  timezone: string
): string {
  if (!scheduleEnabled || !scheduleConfig) {
    return new Date().toISOString();
  }

  const workingHours = scheduleConfig.working_hours;
  const nonWorkingDates = scheduleConfig.non_working_dates || [];
  
  const now = new Date();
  let candidateDate = new Date(now);
  
  let attempts = 0;
  const maxAttempts = 14;
  
  while (attempts < maxAttempts) {
    const dayOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][candidateDate.getDay()];
    const dayConfig = workingHours[dayOfWeek];
    
    if (dayConfig?.enabled) {
      const dateStr = candidateDate.toISOString().split('T')[0];
      if (!nonWorkingDates.includes(dateStr)) {
        const [hours, minutes] = dayConfig.start_time.split(':');
        candidateDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        
        if (candidateDate > now) {
          return candidateDate.toISOString();
        }
      }
    }
    
    candidateDate.setDate(candidateDate.getDate() + 1);
    candidateDate.setHours(0, 0, 0, 0);
    attempts++;
  }
  
  return new Date().toISOString();
}

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
 * Batch sync contacts from HubSpot to hs_contacts
 */
async function syncContactsFromHubSpot(
  contactIds: string[],
  hubspotToken: string,
  supabase: any,
  executionId: string
): Promise<{ synced: number; failed: number }> {
  if (contactIds.length === 0) {
    return { synced: 0, failed: 0 };
  }

  console.log(`[${executionId}] 📞 Syncing ${contactIds.length} contact(s) from HubSpot...`);

  const batchSize = 100;
  let syncedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < contactIds.length; i += batchSize) {
    const batch = contactIds.slice(i, i + batchSize);
    
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
        console.error(`[${executionId}] ❌ Contact batch fetch failed: ${response.status}`);
        failedCount += batch.length;
        continue;
      }

      const data = await response.json();
      const contacts = data.results || [];
      
      const contactsToUpsert = contacts.map((contact: any) => ({
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
        console.error(`[${executionId}] ❌ Contact upsert failed:`, upsertError);
        failedCount += contacts.length;
      } else {
        syncedCount += contacts.length;
      }
      
      if (i + batchSize < contactIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`[${executionId}] ❌ Error in contact batch sync:`, error);
      failedCount += batch.length;
    }
  }

  console.log(`[${executionId}] ✅ Contact sync complete: ${syncedCount} synced, ${failedCount} failed`);
  return { synced: syncedCount, failed: failedCount };
}

/**
 * Analyze tasks for a contact in a specific queue
 */
async function analyzeContactTasks(
  contactId: string,
  queueId: string,
  supabase: any,
  executionId: string
): Promise<{
  total_incomplete: number;
  total_automation_eligible: number;
  tasks_identified: Array<{
    id: string;
    hs_task_subject: string | null;
    hubspot_owner_id: string | null;
    status: 'overdue' | 'future';
    hs_timestamp: string;
    hs_queue_membership_ids: string;
    automation_enabled: boolean;
    hs_update_successful: boolean | null;
  }>;
}> {
  const { data: tasks, error: tasksError } = await supabase
    .from('hs_tasks')
    .select('hs_object_id, hs_task_subject, hubspot_owner_id, hs_timestamp, hs_task_status, created_by_automation_id')
    .eq('associated_contact_id', contactId)
    .eq('hs_queue_membership_ids', queueId)
    .in('hs_task_status', ['NOT_STARTED', 'WAITING'])
    .eq('archived', false);

  if (tasksError) {
    console.error(`[${executionId}] ❌ Error fetching tasks for contact ${contactId}:`, tasksError);
    return { total_incomplete: 0, total_automation_eligible: 0, tasks_identified: [] };
  }

  const now = new Date();
  const tasksAnalysis = (tasks || []).map((task: any) => {
    const taskTime = new Date(task.hs_timestamp);
    const isOverdue = taskTime < now;
    const hasAutomation = !!task.created_by_automation_id;

    return {
      id: task.hs_object_id,
      hs_task_subject: task.hs_task_subject,
      hubspot_owner_id: task.hubspot_owner_id,
      status: isOverdue ? 'overdue' : 'future',
      hs_timestamp: task.hs_timestamp,
      hs_queue_membership_ids: queueId,
      automation_enabled: hasAutomation,
      hs_update_successful: null
    };
  });

  return {
    total_incomplete: tasksAnalysis.length,
    total_automation_eligible: tasksAnalysis.filter(t => t.automation_enabled).length,
    tasks_identified: tasksAnalysis
  };
}

/**
 * Process list exit - auto-complete tasks and block sequences
 */
async function processListExit(
  contactId: string,
  queueId: string,
  automationId: string,
  automation: TaskAutomation,
  hubspotToken: string,
  supabase: any,
  executionId: string
): Promise<{
  tasks_autocompleted: number;
  sequences_blocked: number;
  tasks_updated: Array<{ id: string; success: boolean }>;
}> {
  let tasksAutocompleted = 0;
  let sequencesBlocked = 0;
  const tasksUpdated: Array<{ id: string; success: boolean }> = [];

  // Block sequences if enabled
  if (automation.sequence_exit_enabled) {
    const { data: pendingRuns, error: runsError } = await supabase
      .from('task_automation_runs')
      .select('id')
      .eq('automation_id', automationId)
      .eq('hs_contact_id', contactId)
      .eq('hs_action_successful', false)
      .in('type', ['create_on_entry', 'create_from_sequence']);

    if (!runsError && pendingRuns && pendingRuns.length > 0) {
      const { error: blockError } = await supabase
        .from('task_automation_runs')
        .update({ exit_contact_list_block: true })
        .in('id', pendingRuns.map((r: any) => r.id));

      if (!blockError) {
        sequencesBlocked = pendingRuns.length;
        console.log(`[${executionId}] 🚫 Blocked ${sequencesBlocked} sequence run(s) for contact ${contactId}`);
      }
    }
  }

  // Auto-complete tasks if enabled
  if (automation.auto_complete_on_exit_enabled) {
    const { data: incompleteTasks, error: tasksError } = await supabase
      .from('hs_tasks')
      .select('hs_object_id')
      .eq('associated_contact_id', contactId)
      .eq('hs_queue_membership_ids', queueId)
      .in('hs_task_status', ['NOT_STARTED', 'WAITING'])
      .eq('archived', false);

    if (!tasksError && incompleteTasks && incompleteTasks.length > 0) {
      const taskIds = incompleteTasks.map((t: any) => t.hs_object_id);
      
      // Call HubSpot batch update
      const batchSize = 100;
      for (let i = 0; i < taskIds.length; i += batchSize) {
        const batch = taskIds.slice(i, i + batchSize);
        
        try {
          const response = await fetch('https://api.hubapi.com/crm/v3/objects/tasks/batch/update', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${hubspotToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              inputs: batch.map(id => ({
                id,
                properties: { hs_task_status: 'COMPLETED' }
              }))
            }),
          });

          if (response.ok) {
            const result = await response.json();
            tasksAutocompleted += result.results?.length || 0;
            
            // Mark in database
            await supabase
              .from('hs_tasks')
              .update({
                hs_task_status: 'COMPLETED',
                hs_task_completion_date: new Date().toISOString(),
                hs_task_completion_count: 1,
                marked_completed_by_automation: true,
                marked_completed_by_automation_id: automationId,
                marked_completed_by_automation_source: 'auto_complete_on_exit'
              })
              .in('hs_object_id', batch);

            batch.forEach(id => tasksUpdated.push({ id, success: true }));
          } else {
            batch.forEach(id => tasksUpdated.push({ id, success: false }));
          }
        } catch (error) {
          console.error(`[${executionId}] ❌ Error auto-completing batch:`, error);
          batch.forEach(id => tasksUpdated.push({ id, success: false }));
        }

        if (i + batchSize < taskIds.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
  }

  return { tasks_autocompleted: tasksAutocompleted, sequences_blocked: sequencesBlocked, tasks_updated: tasksUpdated };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const executionId = `list-sync-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  console.log(`=== [${executionId}] HUBSPOT LIST MEMBERSHIPS SYNC START ===`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const hubspotToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN');

    if (!supabaseUrl || !supabaseServiceKey || !hubspotToken) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const syncStartTime = new Date().toISOString();
    
    console.log(`[${executionId}] ⏰ Sync started at: ${syncStartTime}`);
    console.log(`[${executionId}] 🔍 Fetching active task automations...`);

    // Get all active task automations
    const { data: automations, error: automationsError } = await supabase
      .from('task_automations')
      .select(`
        id,
        hs_list_id,
        hs_list_object,
        task_category_id,
        auto_complete_on_exit_enabled,
        sequence_exit_enabled,
        automation_enabled,
        first_task_creation,
        tasks_configuration,
        schedule_configuration,
        schedule_enabled,
        timezone
      `)
      .eq('automation_enabled', true)
      .not('hs_list_id', 'is', null);

    // Get category queue mappings
    const categoryIds = automations?.map(a => a.task_category_id) || [];
    const { data: categories } = await supabase
      .from('task_categories')
      .select('id, hs_queue_id')
      .in('id', categoryIds);
    
    const categoryMap = new Map();
    categories?.forEach(cat => categoryMap.set(cat.id, cat.hs_queue_id));

    if (automationsError) {
      throw new Error(`Failed to fetch automations: ${automationsError.message}`);
    }

    if (!automations || automations.length === 0) {
      console.log(`[${executionId}] ✅ No active automations found - sync complete`);
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No active automations found',
        executionId 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[${executionId}] 📊 Found ${automations.length} active automation(s)`);

    let totalEntriesProcessed = 0;
    let totalExitsProcessed = 0;
    let totalErrors = 0;

    // Process each automation
    for (const automation of automations as TaskAutomation[]) {
      try {
        console.log(`[${executionId}] 📄 Processing automation ${automation.id} with list ${automation.hs_list_id}...`);
        
        const queueId = categoryMap.get(automation.task_category_id);
        
        // Fetch all current members from HubSpot
        const allMembers: HubSpotMember[] = [];
        let after: string | undefined;
        let page = 1;

        do {
          const url = `https://api.hubapi.com/crm/v3/lists/${automation.hs_list_id}/memberships?limit=250${after ? `&after=${after}` : ''}`;
          
          console.log(`[${executionId}] 🌐 Fetching page ${page} for automation ${automation.id}...`);
          
          const response = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${hubspotToken}`,
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            throw new Error(`HubSpot API error: ${response.status} ${response.statusText}`);
          }

          const data: HubSpotMembershipsResponse = await response.json();
          allMembers.push(...data.results);
          
          console.log(`[${executionId}] 📦 Received ${data.results.length} members on page ${page} (total so far: ${allMembers.length})`);
          
          after = data.paging?.next?.after;
          page++;

          if (after) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } while (after);

        console.log(`[${executionId}] 🎯 Total members fetched for automation ${automation.id}: ${allMembers.length}`);

        // Pre-sync all contacts
        const uniqueContactIds = [...new Set(allMembers.map(m => m.recordId))];
        
        if (uniqueContactIds.length > 0) {
          console.log(`[${executionId}] 🔄 Pre-syncing ${uniqueContactIds.length} contact(s)...`);
          await syncContactsFromHubSpot(uniqueContactIds, hubspotToken, supabase, executionId);
        }

        // Get previously stored members for this list
        const { data: storedEvents } = await supabase
          .from('events')
          .select('id, hs_contact_id')
          .eq('event', 'list_entry')
          .eq('hs_list_id', automation.hs_list_id)
          .is('logs->exit_event_id', null);

        const storedMembersMap = new Map<string, StoredListMember>();
        (storedEvents || []).forEach((event: any) => {
          storedMembersMap.set(event.hs_contact_id, {
            hs_object_id: event.hs_contact_id,
            entry_event_id: event.id
          });
        });

        const currentMemberIds = new Set(allMembers.map(m => m.recordId));
        const newEntries: HubSpotMember[] = [];
        const exitedContactIds: string[] = [];

        // Identify new entries
        for (const member of allMembers) {
          if (!storedMembersMap.has(member.recordId)) {
            newEntries.push(member);
          }
        }

        // Identify exits
        for (const [contactId] of storedMembersMap) {
          if (!currentMemberIds.has(contactId)) {
            exitedContactIds.push(contactId);
          }
        }

        console.log(`[${executionId}] 📊 Summary for automation ${automation.id}: ${newEntries.length} new entries, ${exitedContactIds.length} exits`);

        // Process new entries - create list_entry events with immediate task creation
        for (const member of newEntries) {
          try {
            // Calculate due timestamp based on automation schedule
            const dueTimestamp = calculateTaskDueTimestamp(
              automation.schedule_configuration,
              automation.schedule_enabled || false,
              automation.timezone || 'Europe/Paris'
            );

            // Get task configuration
            const initialTask = automation.tasks_configuration?.initial_task || {};
            const taskName = initialTask.name || 'New Lead Task';
            const ownerSetting = initialTask.owner || 'contact_owner';

            // Resolve owner ID
            let hubspotOwnerId: string | null = null;
            if (ownerSetting === 'contact_owner') {
              const { data: contactData } = await supabase
                .from('hs_contacts')
                .select('hubspot_owner_id')
                .eq('hs_object_id', member.recordId)
                .maybeSingle();
              
              hubspotOwnerId = contactData?.hubspot_owner_id || null;
            }

            const automationEnabled = automation.automation_enabled && automation.first_task_creation;

            // Create initial event with task_creation structure
            const { data: eventData, error: eventError } = await supabase
              .from('events')
              .insert({
                event: 'list_entry',
                type: 'api',
                hs_list_id: automation.hs_list_id,
                hs_contact_id: member.recordId,
                hs_queue_id: queueId,
                automation_id: automation.id,
                hubspot_url: `https://app-eu1.hubspot.com/contacts/142467012/objectLists/${automation.hs_list_id}`,
                logs: {
                  task_creation: {
                    task_details: [{
                      automation_enabled: automationEnabled,
                      hs_task_subject: taskName,
                      hs_timestamp: dueTimestamp,
                      hs_queue_membership_ids: queueId,
                      hubspot_owner_id: hubspotOwnerId
                    }]
                  }
                }
              })
              .select()
              .single();

            if (eventError) {
              console.error(`[${executionId}] ❌ Failed to create list_entry event for contact ${member.recordId}:`, eventError);
              totalErrors++;
              continue;
            }

            console.log(`[${executionId}] ✅ Created list_entry event for contact ${member.recordId}`);
            totalEntriesProcessed++;

            // Attempt task creation if automation enabled
            if (automationEnabled && queueId) {
              console.log(`[${executionId}] 🎯 Creating task for list entry ${member.recordId}...`);
              
              try {
                const taskPayload: any = {
                  properties: {
                    hs_task_subject: taskName,
                    hs_queue_membership_ids: queueId,
                    hs_task_type: 'TODO',
                    hs_task_status: 'NOT_STARTED',
                    hs_timestamp: dueTimestamp,
                  },
                  associations: [{
                    to: { id: member.recordId },
                    types: [{
                      associationCategory: 'HUBSPOT_DEFINED',
                      associationTypeId: 204,
                    }],
                  }],
                };

                if (hubspotOwnerId) {
                  taskPayload.properties.hubspot_owner_id = hubspotOwnerId;
                }

                const hubspotResponse = await fetch('https://api.hubapi.com/crm/v3/objects/tasks', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${hubspotToken}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(taskPayload),
                });

                if (hubspotResponse.ok) {
                  const createdTask = await hubspotResponse.json();
                  console.log(`[${executionId}] ✅ Task created: ${createdTask.id}`);

                  // Update event with success
                  const { error: updateError } = await supabase
                    .from('events')
                    .update({
                      logs: {
                        task_creation: {
                          task_details: [{
                            automation_enabled: true,
                            hs_task_subject: taskName,
                            hs_timestamp: dueTimestamp,
                            hs_queue_membership_ids: queueId,
                            hubspot_owner_id: hubspotOwnerId,
                            id: createdTask.id,
                            hs_update_successful: true
                          }]
                        }
                      }
                    })
                    .eq('id', eventData.id);
                  
                  if (updateError) {
                    console.error(`[${executionId}] ❌ Failed to update event:`, updateError);
                  }

                  // Insert into hs_tasks
                  const { error: insertError } = await supabase
                    .from('hs_tasks')
                    .insert({
                      hs_object_id: createdTask.id,
                      hs_task_subject: taskName,
                      hs_task_type: 'TODO',
                      hs_queue_membership_ids: queueId,
                      hs_timestamp: dueTimestamp,
                      hs_task_status: 'NOT_STARTED',
                      number_in_sequence: 1,
                      hubspot_owner_id: hubspotOwnerId,
                      associated_contact_id: member.recordId,
                      created_by_automation: true,
                      created_by_automation_id: automation.id,
                      archived: false
                    });
                  
                  if (insertError) {
                    console.error(`[${executionId}] ❌ Failed to insert task:`, insertError);
                  }

                } else {
                  const errorText = await hubspotResponse.text();
                  console.error(`[${executionId}] ❌ Task creation failed:`, errorText);

                  // Update event with failure
                  const { error: updateError2 } = await supabase
                    .from('events')
                    .update({
                      logs: {
                        task_creation: {
                          task_details: [{
                            automation_enabled: true,
                            hs_task_subject: taskName,
                            hs_timestamp: dueTimestamp,
                            hs_queue_membership_ids: queueId,
                            hubspot_owner_id: hubspotOwnerId,
                            hs_update_successful: false
                          }]
                        }
                      }
                    })
                    .eq('id', eventData.id);
                  
                  if (updateError2) {
                    console.error(`[${executionId}] ❌ Failed to update event:`, updateError2);
                  }
                }
              } catch (taskError) {
                console.error(`[${executionId}] ❌ Task creation error:`, taskError);
                
                // Update event with failure
                const { error: updateError3 } = await supabase
                  .from('events')
                  .update({
                    logs: {
                      task_creation: {
                        task_details: [{
                          automation_enabled: true,
                          hs_task_subject: taskName,
                          hs_timestamp: dueTimestamp,
                          hs_queue_membership_ids: queueId,
                          hubspot_owner_id: hubspotOwnerId,
                          hs_update_successful: false
                        }]
                      }
                    }
                  })
                  .eq('id', eventData.id);
                
                if (updateError3) {
                  console.error(`[${executionId}] ❌ Failed to update event:`, updateError3);
                }
              }
            }
          } catch (entryError) {
            console.error(`[${executionId}] ❌ Error processing entry for contact ${member.recordId}:`, entryError);
            totalErrors++;
          }
        }

        // Process exits - create list_exit events and take action
        for (const contactId of exitedContactIds) {
          const stored = storedMembersMap.get(contactId);
          const tasksAnalysis = await analyzeContactTasks(contactId, queueId, supabase, executionId);
          
          // Process exit actions
          const exitResult = await processListExit(
            contactId,
            queueId,
            automation.id,
            automation,
            hubspotToken,
            supabase,
            executionId
          );

          // Merge task analysis with exit results to populate hs_update_successful
          const eligibleTasksWithResults = tasksAnalysis.tasks_identified.map(task => {
            const updateResult = exitResult.tasks_updated.find(t => t.id === task.id);
            return {
              ...task,
              hs_update_successful: updateResult?.success ?? null
            };
          });

          // Create exit event
          const { data: exitEvent, error: exitEventError } = await supabase
            .from('events')
            .insert({
              event: 'list_exit',
              type: 'api',
              hs_list_id: automation.hs_list_id,
              hs_contact_id: contactId,
              hs_queue_id: queueId,
              automation_id: automation.id,
              hubspot_url: `https://app-eu1.hubspot.com/contacts/142467012/objectLists/${automation.hs_list_id}`,
              logs: {
                task_updates: {
                  summary: {
                    total_incomplete: tasksAnalysis.total_incomplete,
                    total_automation_eligible: tasksAnalysis.total_automation_eligible,
                    total_update_successful: exitResult.tasks_updated.filter(t => t.success).length,
                    total_update_unsuccessful: exitResult.tasks_updated.filter(t => !t.success).length
                  },
                  task_details: eligibleTasksWithResults
                },
                exit_actions: {
                  sequences_blocked: exitResult.sequences_blocked,
                  entry_event_id: stored?.entry_event_id
                }
              }
            })
            .select('id')
            .single();

          if (exitEventError) {
            console.error(`[${executionId}] ❌ Failed to create list_exit event for contact ${contactId}:`, exitEventError);
            totalErrors++;
          } else {
            // Update entry event with exit reference
            if (stored?.entry_event_id && exitEvent) {
              await supabase
                .from('events')
                .update({
                  logs: supabase.raw(`logs || '{"exit_event_id": ${exitEvent.id}}'::jsonb`)
                })
                .eq('id', stored.entry_event_id);
            }
            
            console.log(`[${executionId}] ✅ Created list_exit event for contact ${contactId} (autocompleted: ${exitResult.tasks_autocompleted}, blocked: ${exitResult.sequences_blocked})`);
            totalExitsProcessed++;
          }
        }

        console.log(`[${executionId}] ✅ Completed processing automation ${automation.id}`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[${executionId}] ❌ Error processing automation ${automation.id}:`, errorMessage);
        totalErrors++;
      }
    }

    const duration = Date.now() - new Date(syncStartTime).getTime();
    console.log(`[${executionId}] 🎉 Sync completed: ${totalEntriesProcessed} entries, ${totalExitsProcessed} exits, ${totalErrors} errors, duration: ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        executionId,
        summary: {
          automations_processed: automations.length,
          entries_created: totalEntriesProcessed,
          exits_processed: totalExitsProcessed,
          errors: totalErrors,
          duration_ms: duration
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error(`[${executionId}] ❌ Fatal error:`, error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
