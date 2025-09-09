import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HubSpotTask {
  id: string;
  properties: {
    [key: string]: any;
  };
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

interface SyncResult {
  tasksAdded: number;
  tasksUpdated: number;
  tasksDeleted: number;
  contactsAdded: number;
  contactsUpdated: number;
  errors: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    console.log('=== INCREMENTAL HUBSPOT TASKS SYNC START ===');
    
    // Get environment variables
    const hubspotToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!hubspotToken) {
      throw new Error('HubSpot access token not found');
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration not found');
    }

    // Initialize Supabase client with service role key for admin operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse owner ID from request body (optional - if provided, sync only that owner's tasks)
    const { ownerId } = await req.json().catch(() => ({ ownerId: null }));

    console.log(`🔄 Starting incremental sync${ownerId ? ` for owner ${ownerId}` : ' for all owners'}`);

    // Get the last sync timestamp for this owner (or global if no owner specified)
    const { data: syncMetadata, error: syncError } = await supabase
      .from('sync_metadata')
      .select('incremental_sync_timestamp, last_sync_timestamp')
      .eq('owner_id', ownerId || 'global')
      .maybeSingle();

    if (syncError) {
      console.error('Error fetching sync metadata:', syncError);
      throw new Error(`Failed to fetch sync metadata: ${syncError.message}`);
    }

    // Use the latest timestamp (incremental if available, otherwise last_sync)
    const lastSyncTimestamp = syncMetadata?.incremental_sync_timestamp || syncMetadata?.last_sync_timestamp || '1970-01-01T00:00:00Z';
    console.log(`📅 Last sync timestamp: ${lastSyncTimestamp}`);

    // Create the request body for fetching modified tasks
    const requestBody = {
      limit: 100,
      sorts: ["hs_lastmodifieddate"],
      filterGroups: [
        {
          filters: [
            {
              propertyName: "hs_task_status",
              operator: "NEQ", 
              value: "COMPLETED"
            },
            {
              propertyName: "hs_lastmodifieddate",
              operator: "GTE",
              value: new Date(lastSyncTimestamp).getTime()
            }
          ]
        }
      ],
      properties: [
        "hs_body_preview",
        "hs_created_by_user_id",
        "hs_createdate",
        "hs_timestamp",
        "hs_duration",
        "hs_object_id",
        "hs_queue_membership_ids",
        "hs_task_body",
        "hs_task_completion_count",
        "hs_task_completion_date",
        "hs_task_for_object_type",
        "hs_task_is_all_day",
        "hs_task_is_overdue",
        "hs_task_last_contact_outreach",
        "hs_task_priority",
        "hs_task_status",
        "hs_task_subject",
        "hs_task_type",
        "hs_timestamp",
        "hs_updated_by_user_id",
        "hs_lastmodifieddate",
        "hubspot_owner_assigneddate",
        "hubspot_owner_id",
        "hubspot_team_id"
      ]
    };

    // Add owner filter if specified
    if (ownerId) {
      requestBody.filterGroups[0].filters.push({
        propertyName: "hubspot_owner_id",
        operator: "EQ",
        value: ownerId
      });
    }

    console.log('📥 Fetching modified tasks from HubSpot...');
    
    let allTasks: HubSpotTask[] = [];
    let hasMore = true;
    let after: string | undefined;
    let pageCount = 0;

    // Fetch all modified tasks
    while (hasMore && pageCount < 100) { // Safety limit
      pageCount++;
      console.log(`📄 Fetching page ${pageCount}${after ? ` (after: ${after})` : ''}...`);

      const bodyWithPaging = after 
        ? { ...requestBody, after }
        : requestBody;

      const response = await fetch('https://api.hubapi.com/crm/v3/objects/tasks/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hubspotToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyWithPaging),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`HubSpot API error (${response.status}):`, errorText);
        throw new Error(`HubSpot API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`📦 Received ${data.results.length} tasks on page ${pageCount}`);
      
      allTasks = allTasks.concat(data.results);

      hasMore = !!data.paging?.next?.after;
      after = data.paging?.next?.after;

      // Respect API rate limits
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    console.log(`🎯 Total modified tasks fetched: ${allTasks.length}`);

    if (allTasks.length === 0) {
      console.log('✅ No tasks modified since last sync');
      
      // Update sync metadata
      const { error: updateError } = await supabase
        .from('sync_metadata')
        .upsert({
          owner_id: ownerId || 'global',
          incremental_sync_timestamp: new Date().toISOString(),
          last_sync_success: true,
          sync_type: 'incremental',
          sync_duration: Date.now() - startTime,
          tasks_added: 0,
          tasks_updated: 0,
          tasks_deleted: 0
        });

      if (updateError) {
        console.error('Error updating sync metadata:', updateError);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No tasks modified since last sync',
        tasksProcessed: 0,
        syncDuration: Date.now() - startTime
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Process tasks for incremental updates
    const result: SyncResult = {
      tasksAdded: 0,
      tasksUpdated: 0,
      tasksDeleted: 0,
      contactsAdded: 0,
      contactsUpdated: 0,
      errors: []
    };

    // Fetch contact associations for all tasks
    console.log('🔗 Fetching contact associations...');
    let taskContactMap: { [taskId: string]: string } = {};
    
    if (allTasks.length > 0) {
      const taskIds = allTasks.map(task => task.id);
      const associationBatchSize = 100;
      
      for (let i = 0; i < taskIds.length; i += associationBatchSize) {
        const batchTaskIds = taskIds.slice(i, i + associationBatchSize);
        
        try {
          const associationResponse = await fetch('https://api.hubapi.com/crm/v4/associations/tasks/contacts/batch/read', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${hubspotToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              inputs: batchTaskIds.map(id => ({ id }))
            }),
          });

          if (associationResponse.ok) {
            const associationData = await associationResponse.json();
            
            for (const assocResult of associationData.results) {
              if (assocResult.to && assocResult.to.length > 0) {
                taskContactMap[assocResult.from.id] = assocResult.to[0].toObjectId;
              }
            }
          }
        } catch (error) {
          console.warn('Error fetching association batch:', error);
          result.errors.push(`Failed to fetch associations: ${error.message}`);
        }

        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Fetch contact details for associated contacts
    const contactIds = [...new Set(Object.values(taskContactMap))];
    const contactsMap: { [contactId: string]: any } = {};
    
    if (contactIds.length > 0) {
      console.log(`📞 Fetching contact details for ${contactIds.length} contacts...`);
      
      const contactBatchSize = 100;
      for (let i = 0; i < contactIds.length; i += contactBatchSize) {
        const batchContactIds = contactIds.slice(i, i + contactBatchSize);
        
        try {
          const contactResponse = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/batch/read', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${hubspotToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              inputs: batchContactIds.map(id => ({ id })),
              properties: ['firstname', 'lastname', 'email', 'company', 'hs_object_id', 'mobilephone', 'ensol_source_group', 'hs_lead_status', 'lifecyclestage', 'createdate', 'lastmodifieddate']
            }),
          });

          if (contactResponse.ok) {
            const contactData = await contactResponse.json();
            
            for (const contact of contactData.results) {
              contactsMap[contact.id] = contact;
            }
          }
        } catch (error) {
          console.warn('Error fetching contact batch:', error);
          result.errors.push(`Failed to fetch contacts: ${error.message}`);
        }

        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log('💾 Processing incremental updates...');

    // Process each task for upsert
    const tasksToUpsert = [];
    const contactsToUpsert = [];

    for (const task of allTasks) {
      try {
        const taskData = {
          hs_object_id: task.id,
          hs_task_subject: task.properties.hs_task_subject || null,
          hs_task_body: task.properties.hs_task_body || null,
          hs_body_preview: task.properties.hs_body_preview || null,
          hs_task_status: task.properties.hs_task_status || null,
          hs_task_priority: task.properties.hs_task_priority || null,
          hs_task_type: task.properties.hs_task_type || null,
          hs_task_for_object_type: task.properties.hs_task_for_object_type || null,
          hs_duration: task.properties.hs_duration || null,
          hs_createdate: task.properties.hs_createdate ? new Date(parseInt(task.properties.hs_createdate)) : null,
          hs_lastmodifieddate: task.properties.hs_lastmodifieddate ? new Date(parseInt(task.properties.hs_lastmodifieddate)) : null,
          hs_task_completion_date: task.properties.hs_task_completion_date ? new Date(parseInt(task.properties.hs_task_completion_date)) : null,
          hs_task_completion_count: task.properties.hs_task_completion_count ? parseInt(task.properties.hs_task_completion_count) : 0,
          hs_task_is_all_day: task.properties.hs_task_is_all_day === 'true',
          hs_task_is_overdue: task.properties.hs_task_is_overdue === 'true',
          hs_timestamp: task.properties.hs_timestamp ? new Date(parseInt(task.properties.hs_timestamp)) : null,
          hs_task_last_contact_outreach: task.properties.hs_task_last_contact_outreach ? new Date(parseInt(task.properties.hs_task_last_contact_outreach)) : null,
          hubspot_owner_id: task.properties.hubspot_owner_id || null,
          hubspot_team_id: task.properties.hubspot_team_id || null,
          hubspot_owner_assigneddate: task.properties.hubspot_owner_assigneddate ? new Date(parseInt(task.properties.hubspot_owner_assigneddate)) : null,
          hs_created_by_user_id: task.properties.hs_created_by_user_id || null,
          hs_updated_by_user_id: task.properties.hs_updated_by_user_id || null,
          hs_queue_membership_ids: task.properties.hs_queue_membership_ids || null,
          associated_contact_id: taskContactMap[task.id] || null,
          archived: task.archived || false,
          updated_at: new Date()
        };

        tasksToUpsert.push(taskData);

        // Process associated contact
        const contactId = taskContactMap[task.id];
        if (contactId && contactsMap[contactId]) {
          const contact = contactsMap[contactId];
          const contactData = {
            hs_object_id: contact.id,
            firstname: contact.properties.firstname || null,
            lastname: contact.properties.lastname || null,
            mobilephone: contact.properties.mobilephone || null,
            ensol_source_group: contact.properties.ensol_source_group || null,
            hs_lead_status: contact.properties.hs_lead_status || null,
            lifecyclestage: contact.properties.lifecyclestage || null,
            createdate: contact.properties.createdate ? new Date(contact.properties.createdate) : null,
            lastmodifieddate: contact.properties.lastmodifieddate ? new Date(contact.properties.lastmodifieddate) : null,
            updated_at: new Date()
          };

          contactsToUpsert.push(contactData);
        }

      } catch (error) {
        console.error(`Error processing task ${task.id}:`, error);
        result.errors.push(`Failed to process task ${task.id}: ${error.message}`);
      }
    }

    // Upsert contacts first
    if (contactsToUpsert.length > 0) {
      console.log(`📝 Upserting ${contactsToUpsert.length} contacts...`);
      
      const { data: upsertedContacts, error: contactUpsertError } = await supabase
        .from('hs_contacts')
        .upsert(contactsToUpsert, { 
          onConflict: 'hs_object_id',
          count: 'exact'
        });

      if (contactUpsertError) {
        console.error('Error upserting contacts:', contactUpsertError);
        result.errors.push(`Failed to upsert contacts: ${contactUpsertError.message}`);
      } else {
        result.contactsUpdated = contactsToUpsert.length;
        console.log(`✅ Successfully upserted ${contactsToUpsert.length} contacts`);
      }
    }

    // Upsert tasks
    if (tasksToUpsert.length > 0) {
      console.log(`📝 Upserting ${tasksToUpsert.length} tasks...`);
      
      const { data: upsertedTasks, error: taskUpsertError } = await supabase
        .from('hs_tasks')
        .upsert(tasksToUpsert, { 
          onConflict: 'hs_object_id',
          count: 'exact'
        });

      if (taskUpsertError) {
        console.error('Error upserting tasks:', taskUpsertError);
        result.errors.push(`Failed to upsert tasks: ${taskUpsertError.message}`);
      } else {
        result.tasksUpdated = tasksToUpsert.length;
        console.log(`✅ Successfully upserted ${tasksToUpsert.length} tasks`);
      }
    }

    // Update sync metadata
    const syncDuration = Date.now() - startTime;
    const { error: updateError } = await supabase
      .from('sync_metadata')
      .upsert({
        owner_id: ownerId || 'global',
        incremental_sync_timestamp: new Date().toISOString(),
        last_sync_success: result.errors.length === 0,
        sync_type: 'incremental',
        sync_duration: syncDuration,
        tasks_added: result.tasksAdded,
        tasks_updated: result.tasksUpdated,
        tasks_deleted: result.tasksDeleted,
        error_message: result.errors.length > 0 ? result.errors.join('; ') : null
      });

    if (updateError) {
      console.error('Error updating sync metadata:', updateError);
      result.errors.push(`Failed to update sync metadata: ${updateError.message}`);
    }

    console.log('=== INCREMENTAL SYNC COMPLETE ===');
    console.log(`📊 Tasks processed: ${allTasks.length}`);
    console.log(`📊 Tasks updated: ${result.tasksUpdated}`);
    console.log(`📊 Contacts updated: ${result.contactsUpdated}`);
    console.log(`📊 Errors: ${result.errors.length}`);
    console.log(`⏱️ Duration: ${syncDuration}ms`);

    return new Response(JSON.stringify({ 
      success: result.errors.length === 0,
      message: result.errors.length === 0 ? 'Incremental sync completed successfully' : 'Incremental sync completed with errors',
      tasksProcessed: allTasks.length,
      tasksUpdated: result.tasksUpdated,
      contactsUpdated: result.contactsUpdated,
      errors: result.errors,
      syncDuration
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Incremental sync error:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      message: 'Incremental sync failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});