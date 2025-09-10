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

interface TaskSyncAttempt {
  taskHubspotId: string;
  status: 'success' | 'failed';
  errorMessage?: string;
  errorDetails?: any;
  stage: 'fetch' | 'process' | 'upsert_contact' | 'upsert_task';
  hubspotResponse?: any;
}

interface SyncResult {
  contactsUpdated: number;
  tasksUpdated: number;
  tasksProcessed: number;
  tasksFailed: number;
  errors: number;
  duration: number;
  taskDetails: {
    fetchedTaskIds: string[];
    processedTaskIds: string[];
    updatedTaskIds: string[];
    failedTaskIds: string[];
    failedDetails: Array<{ taskId: string; error: string; stage: string }>;
  };
  taskSyncAttempts: TaskSyncAttempt[];
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

  info(message: string, details?: any) { return this.log('INFO', message, details); }
  warn(message: string, details?: any) { return this.log('WARN', message, details); }
  error(message: string, details?: any) { return this.log('ERROR', message, details); }
  debug(message: string, details?: any) { return this.log('DEBUG', message, details); }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Generate unique execution ID
  const executionId = `inc-sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Get environment variables
  const hubspotToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!hubspotToken) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'HubSpot access token not found' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Supabase configuration not found' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Initialize Supabase client with service role key for admin operations
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Check if sync is paused
  try {
    const { data: syncControl, error: syncControlError } = await supabase
      .from('sync_control')
      .select('*')
      .single();

    if (syncControlError && syncControlError.code !== 'PGRST116') {
      console.error('❌ Error checking sync control:', syncControlError);
    } else if (syncControl?.is_paused) {
      console.log('⏸️ Sync is paused by user');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Sync is currently paused',
          paused: true 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (pauseCheckError) {
    console.error('❌ Error checking pause status:', pauseCheckError);
  }
  
  const startTime = Date.now();
  
  try {
    // ==============================================
    // CONCURRENCY CONTROL: Enhanced check with cleanup
    // ==============================================
    
    // First, clean up any stale executions older than 3 minutes
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
    await supabase
      .from('sync_executions')
      .update({ 
        status: 'failed', 
        error_message: 'Execution timed out',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('status', 'running')
      .lt('started_at', threeMinutesAgo.toISOString());

    // Check for any remaining running syncs
    const { data: runningSyncs, error: syncCheckError } = await supabase
      .from('sync_executions')
      .select('execution_id, started_at')
      .eq('status', 'running')
      .order('started_at', { ascending: false });

    if (syncCheckError) {
      console.error('Error checking for running syncs:', syncCheckError);
    } else if (runningSyncs && runningSyncs.length > 0) {
      console.log(`⏳ Another sync is already running: ${runningSyncs[0].execution_id}. Skipping this execution.`);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Another sync is already running',
          runningSync: runningSyncs[0].execution_id
        }), 
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 409
        }
      );
    }

    console.log(`=== [${executionId}] INCREMENTAL HUBSPOT TASKS SYNC START ===`);
    
    // Initialize logger and execution tracking
    const logger = new SyncLogger(executionId, supabase);
    
    // Parse request body 
    const requestBody = await req.json().catch(() => ({}));
    const triggerSource = requestBody.triggerSource || 'manual';
    
    // Create execution record with proper error handling
    const { error: execInsertError } = await supabase.from('sync_executions').insert({
      execution_id: executionId,
      sync_type: 'incremental',
      trigger_source: triggerSource,
      status: 'running'
    });

    if (execInsertError) {
      console.error('Failed to create execution record:', execInsertError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to create execution record',
        details: execInsertError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await logger.info('Starting global incremental sync', { triggerSource });

    // ==============================================
    // MAIN SYNC LOGIC WITH TIMEOUT WRAPPER
    // ==============================================
    
    // Set up execution timeout (3 minutes max)
    const SYNC_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes
    
    const syncPromise = performIncrementalSync(logger, executionId);
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Sync execution timed out after 3 minutes')), SYNC_TIMEOUT_MS);
    });

    // Race between sync completion and timeout
    const result = await Promise.race([syncPromise, timeoutPromise]);
    
    // Log task sync attempts to database
    if (result.taskSyncAttempts.length > 0) {
      const taskAttempts = result.taskSyncAttempts.map(attempt => ({
        execution_id: executionId,
        task_hubspot_id: attempt.taskHubspotId,
        status: attempt.status,
        error_message: attempt.errorMessage,
        error_details: attempt.errorDetails,
        hubspot_response: attempt.hubspotResponse,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: 0, // We could track this per task in the future
        attempt_number: 1
      }));

      const { error: attemptsError } = await supabase
        .from('task_sync_attempts')
        .insert(taskAttempts);

      if (attemptsError) {
        logger.warn(`Failed to log task sync attempts: ${attemptsError.message}`);
      }
    }

    // Mark execution as completed successfully
    await supabase
      .from('sync_executions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        duration_ms: result.duration,
        tasks_fetched: result.taskDetails.fetchedTaskIds.length,
        tasks_processed: result.tasksProcessed,
        tasks_updated: result.tasksUpdated,
        tasks_failed: result.tasksFailed,
        task_details: result.taskDetails
      })
      .eq('execution_id', executionId);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Incremental sync error:', error);
    
    // Mark execution as failed
    await supabase
      .from('sync_executions')
      .update({
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime
      })
      .eq('execution_id', executionId);
    
    // Update sync metadata with error - PRESERVE last_sync_timestamp on failure
    const currentTimestamp = new Date().toISOString();
    
    // Get existing metadata record for proper WHERE clause
    const { data: existingMetadata } = await supabase
      .from('sync_metadata')
      .select('id')
      .limit(1)
      .single();
    
    if (existingMetadata) {
      await supabase
        .from('sync_metadata')
        .update({
          // DO NOT update last_sync_timestamp on failure - preserve it to prevent data loss
          last_sync_success: false,
          sync_type: 'incremental',
          sync_duration: Math.round((Date.now() - startTime) / 1000),
          error_message: error.message,
          updated_at: currentTimestamp
        })
        .eq('id', existingMetadata.id);
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

// ==============================================
// CORE SYNC LOGIC (extracted to separate function)
// ==============================================
async function performIncrementalSync(logger: SyncLogger, executionId: string): Promise<SyncResult> {
  const startTime = Date.now();
  
  // Initialize tracking arrays
  const fetchedTaskIds: string[] = [];
  const processedTaskIds: string[] = [];
  const updatedTaskIds: string[] = [];
  const failedTaskIds: string[] = [];
  const failedDetails: Array<{ taskId: string; error: string; stage: string }> = [];
  const taskSyncAttempts: TaskSyncAttempt[] = [];
  
  // Track HubSpot API calls
  let hubspotApiCallCount = 0;
  
  // Get environment variables
  const hubspotToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
  
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
  logger.info(`📅 Last sync timestamp: ${lastSyncTimestamp}`);

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

  logger.info('📥 Fetching modified tasks from HubSpot...');
  
  let allModifiedTasks: HubSpotTask[] = [];
  let hasMore = true;
  let page = 1;

  // Fetch all modified tasks with pagination
  while (hasMore && page <= 100) { // Safety limit
    logger.info(`📄 Fetching page ${page}...`);

    const response = await fetch('https://api.hubapi.com/crm/v3/objects/tasks/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hubspotToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    hubspotApiCallCount++;

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`HubSpot API error (${response.status}):`, errorText);
      throw new Error(`HubSpot API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    allModifiedTasks.push(...data.results);
    
    // Track fetched task IDs
    data.results.forEach((task: any) => {
      fetchedTaskIds.push(task.id);
      taskSyncAttempts.push({
        taskHubspotId: task.id,
        status: 'success',
        stage: 'fetch',
        hubspotResponse: { properties: task.properties }
      });
    });
    
    logger.info(`📦 Received ${data.results.length} tasks on page ${page}`);
    
    hasMore = data.results.length === 100;
    page++;
  }

  logger.info(`🎯 Total modified tasks fetched: ${allModifiedTasks.length}`);

  if (allModifiedTasks.length === 0) {
    logger.info('✅ No tasks modified since last sync');
    
    // Update sync metadata for no-tasks case
    const currentTimestamp = new Date().toISOString();
    const { data: existingMetadata } = await supabase
      .from('sync_metadata')
      .select('id')
      .limit(1)
      .single();
    
    if (existingMetadata) {
      await supabase
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
        .eq('id', existingMetadata.id);
    }

    return { 
      contactsUpdated: 0,
      tasksUpdated: 0,
      tasksProcessed: 0,
      tasksFailed: 0,
      errors: 0,
      duration: Date.now() - startTime,
      taskDetails: {
        fetchedTaskIds: [],
        processedTaskIds: [],
        updatedTaskIds: [],
        failedTaskIds: [],
        failedDetails: []
      },
      taskSyncAttempts: []
    };
  }

  // Fetch contact associations for all tasks
  logger.info('🔗 Fetching contact associations...');
  let taskContactMap: { [taskId: string]: string } = {};
  
  if (allModifiedTasks.length > 0) {
    const taskIds = allModifiedTasks.map(task => task.id);
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
        hubspotApiCallCount++;

        if (associationResponse.ok) {
          const associationData = await associationResponse.json();
          
          for (const assocResult of associationData.results) {
            if (assocResult.to && assocResult.to.length > 0) {
              taskContactMap[assocResult.from.id] = assocResult.to[0].toObjectId;
            }
          }
        }
      } catch (error) {
        logger.warn('Error fetching association batch:', error);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Fetch task-deal associations for enhanced contact resolution
  logger.info('🔍 Fetching task-deal associations for enhanced contact resolution...');
  
  const taskDealMap: { [taskId: string]: string } = {};
  const tasksNeedingDealAssoc = allModifiedTasks.filter(task => !taskContactMap[task.id]);
  
  if (tasksNeedingDealAssoc.length > 0) {
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
        hubspotApiCallCount++;

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
        logger.warn('Error fetching task-deal associations:', error);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Fetch contact details for associated contacts
  const contactIds = [...new Set(Object.values(taskContactMap))];
  const contactsMap: { [contactId: string]: any } = {};
  
  if (contactIds.length > 0) {
    logger.info(`📞 Fetching contact details for ${contactIds.length} contacts...`);
    
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
        hubspotApiCallCount++;

        if (contactResponse.ok) {
          const contactData = await contactResponse.json();
          
          for (const contact of contactData.results) {
            contactsMap[contact.id] = contact;
          }
        }
      } catch (error) {
        logger.warn('Error fetching contact batch:', error);
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  // Process incremental updates
  logger.info('💾 Processing incremental updates...');
  
  let contactsUpdated = 0;
  let tasksUpdated = 0;
  let tasksFailed = 0;

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

  for (const task of allModifiedTasks) {
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
      logger.error(`Error processing task ${task.id}:`, error);
      failedTaskIds.push(task.id);
      tasksFailed++;
      failedDetails.push({
        taskId: task.id,
        error: error.message,
        stage: 'process'
      });
      taskSyncAttempts.push({
        taskHubspotId: task.id,
        status: 'failed',
        stage: 'process',
        errorMessage: error.message,
        errorDetails: error
      });
    }
  }

  // Deduplicate contacts before upsert to avoid "ON CONFLICT DO UPDATE command cannot affect row a second time"
  const uniqueContacts = [];
  const seenContactIds = new Set();
  
  for (const contact of contactsToUpsert) {
    if (!seenContactIds.has(contact.hs_object_id)) {
      seenContactIds.add(contact.hs_object_id);
      uniqueContacts.push(contact);
    }
  }

  // Upsert contacts first
  if (uniqueContacts.length > 0) {
    logger.info(`📝 Upserting ${uniqueContacts.length} contacts...`);
    
    try {
      const { data: contactsData, error: contactsError } = await supabase
        .from('hs_contacts')
        .upsert(uniqueContacts, { 
          onConflict: 'hs_object_id',
          ignoreDuplicates: false 
        })
        .select('hs_object_id');

      if (contactsError) {
        logger.error(`❌ Error upserting contacts: ${contactsError.message}`);
        // Track contact upsert failures for related tasks
        const contactIds = uniqueContacts.map(c => c.hs_object_id);
        allModifiedTasks.forEach(task => {
          if (task.associations?.contacts?.results?.some((c: any) => contactIds.includes(c.id))) {
            taskSyncAttempts.push({
              taskHubspotId: task.id,
              status: 'failed',
              stage: 'upsert_contact',
              errorMessage: `Contact upsert failed: ${contactsError.message}`,
              errorDetails: contactsError
            });
          }
        });
        throw contactsError;
      }

      contactsUpdated = contactsData?.length || 0;
      logger.info(`✅ Successfully upserted ${contactsUpdated} contacts`);
    } catch (error) {
      logger.error(`❌ Contact upsert failed: ${error.message}`);
      throw error;
    }
  }

  // Upsert tasks
  if (tasksToUpsert.length > 0) {
    logger.info(`📝 Upserting ${tasksToUpsert.length} tasks...`);
    
    // Track which tasks are being processed
    tasksToUpsert.forEach(task => {
      processedTaskIds.push(task.hs_object_id);
    });
    
    // Log tasks with missing contact references (these are warnings, not failures)
    let warningCount = 0;
    tasksToUpsert.forEach(task => {
      if (!task.associated_contact_id) {
        const originalTask = allModifiedTasks.find(t => t.id === task.hs_object_id);
        const contactId = originalTask?.associations?.contacts?.results?.[0]?.id;
        if (contactId) {
          logger.warn(`⚠️ Task ${task.hs_object_id} references missing contact ${contactId}`);
          warningCount++;
          // Add to task sync attempts as a processing note, not a failure
          taskSyncAttempts.push({
            taskHubspotId: task.hs_object_id,
            status: 'success',
            stage: 'process',
            errorMessage: `Warning: Task references missing contact ${contactId}`,
            hubspotResponse: { associatedContactId: contactId }
          });
        }
      }
    });

    try {
      const { data: tasksData, error: tasksError } = await supabase
        .from('hs_tasks')
        .upsert(tasksToUpsert, { 
          onConflict: 'hs_object_id',
          ignoreDuplicates: false 
        })
        .select('hs_object_id');

      if (tasksError) {
        logger.error(`❌ Error upserting tasks: ${tasksError.message}`);
        
        // Track task upsert failures
        tasksToUpsert.forEach(task => {
          failedTaskIds.push(task.hs_object_id);
          tasksFailed++;
          failedDetails.push({
            taskId: task.hs_object_id,
            error: tasksError.message,
            stage: 'upsert_task'
          });
          taskSyncAttempts.push({
            taskHubspotId: task.hs_object_id,
            status: 'failed',
            stage: 'upsert_task',
            errorMessage: tasksError.message,
            errorDetails: tasksError
          });
        });
        
        throw tasksError;
      }

      // Track successfully updated tasks
      if (tasksData) {
        tasksData.forEach(task => {
          updatedTaskIds.push(task.hs_object_id);
          taskSyncAttempts.push({
            taskHubspotId: task.hs_object_id,
            status: 'success',
            stage: 'upsert_task'
          });
        });
      }

      tasksUpdated = tasksData?.length || 0;
      logger.info(`✅ Successfully upserted ${tasksUpdated} tasks`);
      
      if (warningCount > 0) {
        logger.warn(`⚠️ ${warningCount} tasks had missing contact references and were saved without contact links`);
      }
    } catch (error) {
      logger.error(`❌ Task upsert failed: ${error.message}`);
      throw error;
    }
  }

  const duration = Date.now() - startTime;

  logger.info('=== INCREMENTAL SYNC COMPLETE ===');
  logger.info(`📊 Contacts updated: ${contactsUpdated}`);
  logger.info(`📊 Tasks updated: ${tasksUpdated}`);
  logger.info(`📊 Tasks processed: ${allModifiedTasks.length}`);
  logger.info(`📊 Tasks failed: ${tasksFailed}`);
  logger.info(`⏱️ Duration: ${duration}ms`);

  // Update sync metadata
  const { error: metadataError } = await supabase
    .from('sync_metadata')
    .upsert({
      id: '00000000-0000-0000-0000-000000000001', // Fixed UUID for singleton
      last_sync_timestamp: new Date().toISOString(),
      last_sync_success: true,
      sync_type: 'incremental',
      sync_duration: duration,
      tasks_updated: tasksUpdated,
      tasks_added: 0, // We don't track added vs updated in incremental sync
      tasks_deleted: 0,
      error_message: null
    });

  if (metadataError) {
    logger.error(`❌ Error updating sync metadata: ${metadataError.message}`);
  } else {
    logger.info('✅ Sync metadata updated successfully');
  }

  return {
    contactsUpdated,
    tasksUpdated,
    tasksProcessed: allModifiedTasks.length,
    tasksFailed,
    errors: 0, // Only true sync errors, not task-level warnings
    duration,
    taskDetails: {
      fetchedTaskIds,
      processedTaskIds,
      updatedTaskIds,
      failedTaskIds,
      failedDetails
    },
    taskSyncAttempts
  };
}