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

// Enhanced logging utility
class SyncLogger {
  private executionId: string;
  private supabase: any;

  constructor(executionId: string, supabase: any) {
    this.executionId = executionId;
    this.supabase = supabase;
  }

  async log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, details?: any) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${this.executionId}] [${level}] ${message}`, details || '');
    
    // Also log to database
    try {
      await this.supabase.rpc('add_execution_log', {
        execution_id_param: this.executionId,
        log_level: level,
        message,
        details: details ? JSON.stringify(details) : null
      });
    } catch (error) {
      console.error(`Failed to log to database: ${error.message}`);
    }
  }

  async updateExecution(updates: any) {
    try {
      await this.supabase
        .from('sync_executions')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('execution_id', this.executionId);
    } catch (error) {
      console.error(`Failed to update execution: ${error.message}`);
    }
  }

  async logTaskAttempt(taskHubspotId: string, status: string, error?: string, response?: any) {
    try {
      await this.supabase
        .from('task_sync_attempts')
        .insert({
          execution_id: this.executionId,
          task_hubspot_id: taskHubspotId,
          status,
          completed_at: new Date().toISOString(),
          error_message: error,
          hubspot_response: response ? JSON.stringify(response) : null
        });
    } catch (error) {
      console.error(`Failed to log task attempt: ${error.message}`);
    }
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Generate unique execution ID
  const executionId = `inc-sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const startTime = Date.now();
    console.log(`=== [${executionId}] INCREMENTAL HUBSPOT TASKS SYNC START ===`);
    
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
    
    // Initialize logger and execution tracking
    const logger = new SyncLogger(executionId, supabase);
    
    // Parse request body 
    const { timestamp, triggerSource } = await req.json().catch(() => ({}));
    
    // Create execution record
    await supabase.from('sync_executions').insert({
      execution_id: executionId,
      sync_type: 'incremental',
      trigger_source: triggerSource || 'manual',
      status: 'running'
    });

    await logger.log('INFO', 'Starting global incremental sync', { triggerSource: triggerSource || 'manual' });

    // Get the last sync timestamp from global metadata row
    const { data: syncMetadata, error: syncError } = await supabase
      .from('sync_metadata')
      .select('last_sync_timestamp')
      .single();

    if (syncError) {
      console.error('Error fetching sync metadata:', syncError);
      throw new Error(`Failed to fetch sync metadata: ${syncError.message}`);
    }

    // Use the last sync timestamp (fallback to epoch if none)
    const lastSyncTimestamp = syncMetadata?.last_sync_timestamp || '1970-01-01T00:00:00Z';
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

    // Global sync - no owner filter needed

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
      const currentTimestamp = new Date().toISOString();
      const { error: metadataUpdateError } = await supabase
        .from('sync_metadata')
        .update({
          last_sync_timestamp: currentTimestamp,
          last_sync_success: true,
          sync_type: 'incremental',
          sync_duration: Math.round((Date.now() - startTime) / 1000),
          tasks_added: 0,
          tasks_updated: 0,
          tasks_deleted: 0,
          error_message: null,
          updated_at: currentTimestamp
        })
        .single();

      if (metadataUpdateError) {
        console.error('Error updating sync metadata:', metadataUpdateError);
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

        await new Promise(resolve => setTimeout(resolve, 100)); // Faster for incremental
      }
    }

    // ==== ENHANCED TASK-DEAL-CONTACT ASSOCIATION LOGIC ====
    console.log('🔍 Fetching task-deal associations for enhanced contact resolution...');
    
    const taskDealMap: { [taskId: string]: string } = {};
    const tasksNeedingDealAssoc = allTasks.filter(task => !taskContactMap[task.id]);
    
    if (tasksNeedingDealAssoc.length > 0) {
      console.log(`📝 ${tasksNeedingDealAssoc.length} tasks need deal-based contact resolution`);
      
      // Fetch task-deal associations for tasks without direct contact associations
      const taskDealBatchSize = 100;
      const taskIdsNeedingDeals = tasksNeedingDealAssoc.map(t => t.id);
      
      for (let i = 0; i < taskIdsNeedingDeals.length; i += taskDealBatchSize) {
        const batchTaskIds = taskIdsNeedingDeals.slice(i, i + taskDealBatchSize);
        
        try {
          const taskDealResponse = await fetch('https://api.hubapi.com/crm/v4/associations/tasks/deals/batch/read', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${hubspotToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              inputs: batchTaskIds.map(id => ({ id }))
            }),
          });

          if (taskDealResponse.ok) {
            const taskDealData = await taskDealResponse.json();
            
            for (const result of taskDealData.results) {
              if (result.to && result.to.length > 0) {
                const dealId = result.to[0].toObjectId;
                if (dealId && String(dealId).trim()) {
                  taskDealMap[result.from.id] = dealId;
                }
              }
            }
          }
        } catch (error) {
          console.warn('Error fetching task-deal associations:', error);
          result.errors.push(`Failed to fetch task-deal associations: ${error.message}`);
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Fetch deal-contact associations for discovered deals
      const dealIds = [...new Set(Object.values(taskDealMap))];
      
      if (dealIds.length > 0) {
        console.log(`🔗 Fetching contact associations for ${dealIds.length} deals...`);
        
        const dealContactBatchSize = 100;
        const dealContactMap: { [dealId: string]: string } = {};
        
        for (let i = 0; i < dealIds.length; i += dealContactBatchSize) {
          const batchDealIds = dealIds.slice(i, i + dealContactBatchSize);
          
          try {
            const dealContactResponse = await fetch('https://api.hubapi.com/crm/v4/associations/deals/contacts/batch/read', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${hubspotToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                inputs: batchDealIds.map(id => ({ id }))
              }),
            });

            if (dealContactResponse.ok) {
              const dealContactData = await dealContactResponse.json();
              
              for (const result of dealContactData.results) {
                if (result.to && result.to.length > 0) {
                  dealContactMap[result.from.id] = result.to[0].toObjectId;
                }
              }
            }
          } catch (error) {
            console.warn('Error fetching deal-contact associations:', error);
            result.errors.push(`Failed to fetch deal-contact associations: ${error.message}`);
          }

          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Map tasks to contacts through deals
        for (const [taskId, dealId] of Object.entries(taskDealMap)) {
          const contactId = dealContactMap[dealId];
          if (contactId && !taskContactMap[taskId]) {
            taskContactMap[taskId] = contactId;
            console.log(`✅ Mapped task ${taskId} to contact ${contactId} via deal ${dealId}`);
          }
        }
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

    // Helper function to safely parse timestamps
    const parseTimestamp = (value: any): Date | null => {
      if (!value || value === '' || value === 'null' || value === '0') return null;
      
      // Handle ISO 8601 strings (e.g., "2025-09-05T07:00:11.629Z")
      if (typeof value === 'string' && value.includes('T') && value.includes('Z')) {
        const date = new Date(value);
        return !isNaN(date.getTime()) && date.getFullYear() > 1970 ? date : null;
      }
      
      // Handle numeric timestamps
      const timestamp = parseInt(String(value));
      if (isNaN(timestamp) || timestamp === 0) return null;
      const date = new Date(timestamp);
      return date.getFullYear() > 1970 ? date : null;
    };

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
          hs_createdate: parseTimestamp(task.properties.hs_createdate),
          hs_lastmodifieddate: parseTimestamp(task.properties.hs_lastmodifieddate),
          hs_task_completion_date: parseTimestamp(task.properties.hs_task_completion_date),
          hs_task_completion_count: task.properties.hs_task_completion_count ? parseInt(task.properties.hs_task_completion_count) : 0,
          hs_task_is_all_day: task.properties.hs_task_is_all_day === 'true',
          hs_task_is_overdue: task.properties.hs_task_is_overdue === 'true',
          hs_timestamp: parseTimestamp(task.properties.hs_timestamp),
          hs_task_last_contact_outreach: parseTimestamp(task.properties.hs_task_last_contact_outreach),
          hubspot_owner_id: task.properties.hubspot_owner_id || null,
          hubspot_team_id: task.properties.hubspot_team_id || null,
          hubspot_owner_assigneddate: parseTimestamp(task.properties.hubspot_owner_assigneddate),
          hs_created_by_user_id: task.properties.hs_created_by_user_id || null,
          hs_updated_by_user_id: task.properties.hs_updated_by_user_id || null,
          hs_queue_membership_ids: task.properties.hs_queue_membership_ids || null,
          associated_contact_id: taskContactMap[task.id] || null,
          associated_deal_id: taskDealMap[task.id] || null,
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
            createdate: parseTimestamp(contact.properties.createdate),
            lastmodifieddate: parseTimestamp(contact.properties.lastmodifieddate),
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

    const syncDuration = Date.now() - startTime;

    console.log('=== INCREMENTAL SYNC COMPLETE ===');
    console.log(`📊 Tasks processed: ${allTasks.length}`);
    console.log(`📊 Tasks updated: ${result.tasksUpdated}`);
    console.log(`📊 Contacts updated: ${result.contactsUpdated}`);
    console.log(`📊 Errors: ${result.errors.length}`);
    console.log(`⏱️ Duration: ${syncDuration}ms`);

    // Update sync metadata (global row only)
    const currentTimestamp = new Date().toISOString();
    const { error: finalUpdateError } = await supabase
      .from('sync_metadata')
      .update({
        last_sync_timestamp: currentTimestamp,
        last_sync_success: result.errors.length === 0,
        sync_type: 'incremental',
        sync_duration: Math.round(syncDuration / 1000), // Convert to seconds
        tasks_added: result.tasksAdded,
        tasks_updated: result.tasksUpdated,
        tasks_deleted: result.tasksDeleted,
        error_message: result.errors.length > 0 ? result.errors.join('; ') : null,
        updated_at: currentTimestamp
      })
      .single();

    if (finalUpdateError) {
      console.error('❌ Failed to update sync metadata:', finalUpdateError);
    } else {
      console.log('✅ Sync metadata updated successfully');
    }

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
    
    // Update sync metadata with error (global row only) - PRESERVE last_sync_timestamp on failure
    const currentTimestamp = new Date().toISOString();
    const { error: errorUpdateError } = await supabase
      .from('sync_metadata')
      .update({
        // DO NOT update last_sync_timestamp on failure - preserve it to prevent data loss
        last_sync_success: false,
        sync_type: 'incremental',
        sync_duration: Math.round((Date.now() - startTime) / 1000),
        error_message: error.message,
        updated_at: currentTimestamp
      })
      .single();

    if (errorUpdateError) {
      console.error('❌ Failed to update sync metadata with error:', errorUpdateError);
    }
    
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