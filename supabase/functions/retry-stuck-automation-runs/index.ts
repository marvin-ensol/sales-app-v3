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
}): Promise<{
  synced: number;
  failed: number;
  contactsWithOwners: number;
  contactsWithoutOwners: number;
}> {
  const { contactIds, hubspotToken, supabase, forceRefresh = false } = options;
  
  if (contactIds.length === 0) {
    return { synced: 0, failed: 0, contactsWithOwners: 0, contactsWithoutOwners: 0 };
  }

  const batchSize = 100;
  let syncedCount = 0;
  let failedCount = 0;
  let withOwners = 0;
  let withoutOwners = 0;

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
      
      if (i + batchSize < contactIds.length) {
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

    const executionId = `retry_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    console.log(`[${executionId}] === RETRY STUCK AUTOMATION RUNS START ===`);
    
    // Find runs that are:
    // - Not executed (hs_action_successful = false)
    // - Older than 10 minutes (missed by regular execution)
    // - Not older than 48 hours (don't retry ancient runs)
    // - Have a valid planned_execution_timestamp (not NULL)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    
    console.log(`[${executionId}] Looking for stuck runs between ${fortyEightHoursAgo} and ${tenMinutesAgo}`);

    const { data: stuckRuns, error: queryError } = await supabase
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
      .not('planned_execution_timestamp', 'is', null)
      .lt('planned_execution_timestamp', tenMinutesAgo)
      .gte('planned_execution_timestamp', fortyEightHoursAgo)
      .order('planned_execution_timestamp', { ascending: true })
      .limit(100); // Process 100 at a time to avoid timeout

    if (queryError) {
      console.error(`[${executionId}] ❌ Error querying stuck runs:`, queryError);
      throw queryError;
    }

    if (!stuckRuns || stuckRuns.length === 0) {
      console.log(`[${executionId}] ✅ No stuck runs found`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No stuck runs to retry',
          executionId 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${executionId}] 🔄 Found ${stuckRuns.length} stuck runs to retry`);

    const hubspotToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN');
    if (!hubspotToken) {
      console.error(`[${executionId}] ❌ HUBSPOT_ACCESS_TOKEN not configured`);
      throw new Error('HUBSPOT_ACCESS_TOKEN not configured');
    }

    // Batch refresh contacts
    const uniqueContactIds = [...new Set(
      stuckRuns
        .map(run => run.hs_contact_id)
        .filter(Boolean)
    )];

    if (uniqueContactIds.length > 0) {
      console.log(`[${executionId}] 📞 Refreshing ${uniqueContactIds.length} contact(s)...`);
      const result = await syncContactsFromHubSpot({
        contactIds: uniqueContactIds,
        hubspotToken,
        supabase,
        forceRefresh: true
      });
      console.log(`[${executionId}] ✅ Contact refresh complete:`, result);
    }

    // Build batch payload
    const batchInputs = [];
    const runMetadata = [];

    for (const run of stuckRuns) {
      // Resolve contact ID if missing
      let contactId = run.hs_contact_id;
      
      if (!contactId && run.hs_membership_id) {
        console.log(`[${executionId}] ⚠️ Run ${run.id} has NULL contact, resolving via membership...`);
        
        const { data: membership } = await supabase
          .from('hs_list_memberships')
          .select('hs_object_id')
          .eq('id', run.hs_membership_id)
          .maybeSingle();
        
        if (membership?.hs_object_id) {
          contactId = membership.hs_object_id;
          console.log(`[${executionId}] ✅ Resolved contact ${contactId}`);
          
          await syncContactsFromHubSpot({
            contactIds: [contactId],
            hubspotToken,
            supabase,
            forceRefresh: true
          });
        }
      }
      
      if (!contactId) {
        console.error(`[${executionId}] ❌ Cannot process run ${run.id}: no contact ID`);
        await supabase
          .from('task_automation_runs')
          .update({ 
            failure_description: 'Retry failed: Could not resolve contact ID',
          })
          .eq('id', run.id);
        continue;
      }

      // Determine owner
      let hubspotOwnerId = null;
      if (run.task_owner_setting === 'contact_owner') {
        if (!run.hs_owner_id_contact && contactId) {
          const { data: contactData } = await supabase
            .from('hs_contacts')
            .select('hubspot_owner_id')
            .eq('hs_object_id', contactId)
            .maybeSingle();
          
          if (contactData?.hubspot_owner_id) {
            run.hs_owner_id_contact = contactData.hubspot_owner_id;
          }
        }
        hubspotOwnerId = run.hs_owner_id_contact;
      } else if (run.task_owner_setting === 'previous_task_owner') {
        hubspotOwnerId = run.hs_owner_id_previous_task;
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
        task_name: run.task_name,
        hs_queue_id: run.hs_queue_id,
        planned_execution_timestamp: run.planned_execution_timestamp,
        position_in_sequence: run.position_in_sequence,
        hubspot_owner_id: hubspotOwnerId,
        hs_contact_id: contactId,
      });
    }

    if (batchInputs.length === 0) {
      console.log(`[${executionId}] ⚠️ No valid tasks to create after filtering`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No valid tasks to retry',
          executionId 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${executionId}] 🚀 Creating ${batchInputs.length} tasks via batch API...`);

    // Call HubSpot batch API
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
      throw new Error(`HubSpot batch API error: ${errorText}`);
    }

    const batchResult = await hubspotResponse.json();
    const createdTasks = batchResult.results || [];

    console.log(`[${executionId}] ✅ Created ${createdTasks.length} tasks`);

    // Insert tasks into hs_tasks
    const tasksToInsert = createdTasks.map((task: any, index: number) => {
      const metadata = runMetadata[index];
      return {
        hs_object_id: task.id,
        hs_task_subject: task.properties.hs_task_subject,
        hs_task_body: null,
        hs_task_status: task.properties.hs_task_status,
        hs_task_priority: task.properties.hs_task_priority || 'MEDIUM',
        hs_timestamp: task.properties.hs_timestamp,
        hs_queue_membership_ids: task.properties.hs_queue_membership_ids,
        hubspot_owner_id: task.properties.hubspot_owner_id,
        associated_contact_id: metadata.hs_contact_id,
        hs_createdate: task.createdAt,
        hs_lastmodifieddate: task.updatedAt,
        created_by_automation: true,
        created_by_automation_id: metadata.automation_id,
        number_in_sequence: metadata.position_in_sequence,
        archived: false,
      };
    });

    const { error: insertError } = await supabase
      .from('hs_tasks')
      .insert(tasksToInsert);

    if (insertError) {
      console.error(`[${executionId}] ❌ Error inserting tasks:`, insertError);
    } else {
      console.log(`[${executionId}] ✅ Inserted ${tasksToInsert.length} tasks into hs_tasks`);
    }

    // Update automation runs
    const runIds = createdTasks.map((_, index) => runMetadata[index].run_id);
    const taskIds = createdTasks.map(task => task.id);

    const { error: updateError } = await supabase
      .from('task_automation_runs')
      .update({
        hs_action_successful: true,
        hs_actioned_task_ids: taskIds,
        updated_at: new Date().toISOString()
      })
      .in('id', runIds);

    if (updateError) {
      console.error(`[${executionId}] ❌ Error updating runs:`, updateError);
    } else {
      console.log(`[${executionId}] ✅ Marked ${runIds.length} runs as successful`);
    }

    console.log(`[${executionId}] === RETRY STUCK AUTOMATION RUNS COMPLETE ===`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Retried ${stuckRuns.length} stuck runs, created ${createdTasks.length} tasks`,
        executionId 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in retry-stuck-automation-runs:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
