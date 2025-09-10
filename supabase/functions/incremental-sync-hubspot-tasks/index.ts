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
  associations?: {
    contacts?: {
      results: Array<{ id: string; }>;
    };
  };
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

interface TaskSyncAttempt {
  taskHubspotId: string;
  status: 'success' | 'failed';
  stage: string;
  errorMessage?: string;
  errorDetails?: any;
  hubspotResponse?: any;
  supabaseData?: any;
  warnings?: string[];
}

interface SyncResult {
  contactsUpdated: number;
  tasksCreated: number;
  tasksUpdated: number;
  tasksFetched: number;
  tasksFailed: number;
  errors: number;
  duration: number;
  hubspotApiCalls?: number;
  taskDetails: {
    fetchedTaskIds: string[];
    createdTaskIds: string[];
    updatedTaskIds: string[];
    failedTaskIds: string[];
    failedDetails: Array<{ taskId: string; error: string; stage: string }>;
  };
  taskSyncAttempts: TaskSyncAttempt[];
}

// Enhanced logging with structured output and optional database persistence
class SyncLogger {
  private executionId: string;
  private supabase: any;

  constructor(executionId: string, supabase: any) {
    this.executionId = executionId;
    this.supabase = supabase;
  }

  private log(level: string, message: string, details?: any) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${this.executionId}] [${level.toUpperCase()}] ${message}`;
    
    if (details) {
      console.log(logMessage, details);
    } else {
      console.log(logMessage);
    }
  }

  info(message: string, details?: any) {
    this.log('info', message, details);
  }

  warn(message: string, details?: any) {
    this.log('warn', message, details);
  }

  error(message: string, details?: any) {
    this.log('error', message, details);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const requestBody = await req.json().catch(() => ({}));
  const triggerSource = requestBody.triggerSource || 'manual';
  
  // Generate execution_id in format: inc_YY-MM-DD_HH:mm:ss using Paris timezone
  const now = new Date();
  const parisTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const year = parisTime.getFullYear().toString().slice(-2);
  const month = (parisTime.getMonth() + 1).toString().padStart(2, '0');
  const day = parisTime.getDate().toString().padStart(2, '0');
  const hour = parisTime.getHours().toString().padStart(2, '0');
  const minute = parisTime.getMinutes().toString().padStart(2, '0');
  const second = parisTime.getSeconds().toString().padStart(2, '0');
  const executionId = `inc_${year}-${month}-${day}_${hour}:${minute}:${second}`;
  
  console.log(`=== [${executionId}] INCREMENTAL HUBSPOT TASKS SYNC START ===`);
  
  // Get environment variables
  const hubspotToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!hubspotToken) {
    return new Response(JSON.stringify({ error: 'HubSpot access token not found' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Supabase configuration not found' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Initialize Supabase client and logger
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const logger = new SyncLogger(executionId, supabase);

  try {
    logger.info('Starting global incremental sync', { triggerSource });

    // Check if syncing is paused via sync_control
    const { data: syncControl, error: syncControlError } = await supabase
      .from('sync_control')
      .select('is_paused, paused_at, paused_by, notes')
      .single();

    if (syncControlError && syncControlError.code !== 'PGRST116') {
      throw new Error(`Failed to check sync control: ${syncControlError.message}`);
    }

    if (syncControl?.is_paused) {
      const pausedSince = syncControl.paused_at ? new Date(syncControl.paused_at).toLocaleString() : 'unknown';
      const pausedBy = syncControl.paused_by || 'unknown';
      const pauseReason = syncControl.notes ? ` (${syncControl.notes})` : '';
      
      return new Response(JSON.stringify({
        success: false,
        skipped: true,
        message: `Sync is currently paused since ${pausedSince} by ${pausedBy}${pauseReason}`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    logger.info('✅ Sync control check passed - proceeding with sync');

    // ==== CONCURRENCY CONTROL: Check for existing running syncs ====
    logger.info('🔒 Checking for existing running sync executions...');
    
    // First, clean up any stale executions (older than 30 minutes and still "running")
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { error: cleanupError } = await supabase
      .from('sync_executions')
      .update({ 
        status: 'failed', 
        error_message: 'Execution timed out or was abandoned',
        completed_at: new Date().toISOString()
      })
      .eq('status', 'running')
      .lt('started_at', thirtyMinutesAgo);

    if (cleanupError) {
      logger.error('Failed to cleanup stale executions:', cleanupError);
      // Continue anyway - this is not critical
    }

    // Check for any current running executions
    const { data: runningExecutions, error: runningError } = await supabase
      .from('sync_executions')
      .select('execution_id, started_at, trigger_source')
      .eq('status', 'running')
      .order('started_at', { ascending: false });

    if (runningError) {
      logger.error('Failed to check running executions:', runningError);
      throw new Error(`Failed to check running executions: ${runningError.message}`);
    }

    if (runningExecutions && runningExecutions.length > 0) {
      const runningExecution = runningExecutions[0];
      const startedAt = new Date(runningExecution.started_at).toLocaleString();
      const message = `Sync already running (execution: ${runningExecution.execution_id}, started: ${startedAt}, source: ${runningExecution.trigger_source})`;
      
      logger.info(`🚫 ${message}`);
      
      return new Response(JSON.stringify({
        success: false,
        skipped: true,
        message,
        currentExecution: runningExecution
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    logger.info('✅ No running executions found - proceeding');

    // ==== Create sync execution record ====
    const { data: executionData, error: executionError } = await supabase
      .from('sync_executions')
      .insert({
        execution_id: executionId,
        sync_type: 'incremental',
        trigger_source: triggerSource,
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (executionError) {
      logger.error('Failed to create execution record:', executionError);
      throw new Error(`Failed to create execution record: ${executionError.message}`);
    }

    logger.info(`📝 Created execution record: ${executionId}`);

    // ==== Perform incremental sync with timeout ====
    const SYNC_TIMEOUT = 25 * 60 * 1000; // 25 minutes
    
    let result;
    try {
      result = await Promise.race([
        performIncrementalSync(supabase, hubspotToken, logger, executionId),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Sync timeout after 25 minutes')), SYNC_TIMEOUT)
        )
      ]);
      
      // Update execution record with success
      await supabase
        .from('sync_executions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          duration_ms: result.duration,
          tasks_fetched: result.tasksFetched,
          tasks_created: result.tasksCreated,
          tasks_updated: result.tasksUpdated,
          tasks_failed: result.tasksFailed,
          task_details: result.taskDetails,
          hubspot_api_calls: result.hubspotApiCalls || 0
        })
        .eq('execution_id', executionId);

      logger.info(`✅ Execution completed successfully: ${executionId}`);
      
    } catch (syncError) {
      logger.error('Sync execution failed:', syncError);
      
      // Update execution record with failure
      await supabase
        .from('sync_executions')
        .update({
          status: 'failed',
          error_message: syncError.message,
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime
        })
        .eq('execution_id', executionId);
      
      throw syncError;
    }

    // Log task sync attempts if available
    if (result.taskSyncAttempts && result.taskSyncAttempts.length > 0) {
      logger.info(`📝 Logging ${result.taskSyncAttempts.length} task sync attempts...`);
      
      const { error: attemptsError } = await supabase
        .from('task_sync_attempts')
        .insert(
          result.taskSyncAttempts.map(attempt => ({
            execution_id: executionId,
            task_hubspot_id: attempt.taskHubspotId,
            status: attempt.status,
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            duration_ms: 0,
            error_message: attempt.errorMessage,
            error_details: attempt.errorDetails,
            hubspot_response: attempt.hubspotResponse
          }))
        );

      if (attemptsError) {
        logger.warn(`Failed to log task sync attempts: ${attemptsError.message}`);
      }
    }

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
    
    // Note: Error already logged by execution record above
    console.error('Incremental sync failed, execution record updated');
    
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
async function performIncrementalSync(supabase: any, hubspotToken: string, logger: any, executionId: string): Promise<SyncResult> {
  const startTime = Date.now();
  
  // ==== Get last successful sync timestamp from sync_executions ====
  logger.info('📊 Fetching last successful sync timestamp...');
  const { data: lastSync, error: lastSyncError } = await supabase
    .from('sync_executions')
    .select('completed_at')
    .eq('status', 'completed')
    .eq('sync_type', 'incremental')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastSyncError) {
    logger.error('Error fetching last sync:', lastSyncError);
    throw new Error(`Failed to fetch last sync: ${lastSyncError.message}`);
  }

  // Use last successful sync or default to 24 hours ago
  const lastSyncTimestamp = lastSync?.completed_at || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  logger.info(`📅 Last sync timestamp: ${lastSyncTimestamp}`);
  
  // Initialize tracking arrays
  const fetchedTaskIds: string[] = [];
  const processedTaskIds: string[] = [];
  const updatedTaskIds: string[] = [];
  const failedTaskIds: string[] = [];
  const failedDetails: Array<{ taskId: string; error: string; stage: string }> = [];
  const taskSyncAttempts: TaskSyncAttempt[] = [];
  const processedContactIds: string[] = [];
  
  // Track HubSpot API calls
  let hubspotApiCallCount = 0;
  
  // ==== FETCH MODIFIED TASKS FROM HUBSPOT ====
  logger.info('🔍 Fetching modified tasks from HubSpot...');
  
  const requestBody = {
    limit: 100,
    sorts: [{ propertyName: "hs_lastmodifieddate", direction: "DESCENDING" }],
    properties: [
      "hs_body_preview", "hs_created_by_user_id", "hs_createdate", "hs_timestamp",
      "hs_duration", "hs_object_id", "hs_queue_membership_ids", "hs_task_body",
      "hs_task_completion_count", "hs_task_completion_date", "hs_task_for_object_type",
      "hs_task_is_all_day", "hs_task_is_overdue", "hs_task_last_contact_outreach",
      "hs_task_priority", "hs_task_status", "hs_task_subject", "hs_task_type",
      "hs_updated_by_user_id", "hubspot_owner_assigneddate", "hubspot_owner_id",
      "hubspot_team_id", "hs_lastmodifieddate"
    ],
    filterGroups: [{
      filters: [
        {
          propertyName: "hs_lastmodifieddate",
          operator: "GTE",
          value: lastSyncTimestamp
        }
      ]
    }]
  };

  let allModifiedTasks: HubSpotTask[] = [];
  let hasMore = true;
  let after: string | undefined;
  let page = 0;

  while (hasMore && page < 100) { // Safety limit
    page++;
    logger.info(`📄 Fetching page ${page}${after ? ` (after: ${after})` : ''}...`);

    const bodyWithPaging = after ? { ...requestBody, after } : requestBody;

    const response = await fetch('https://api.hubapi.com/crm/v3/objects/tasks/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hubspotToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyWithPaging),
    });

    hubspotApiCallCount++;

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`HubSpot API error (${response.status}):`, errorText);
      throw new Error(`HubSpot API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Track fetched task IDs
    data.results.forEach((task: any) => {
      fetchedTaskIds.push(task.id);
    });
    
    logger.info(`📦 Received ${data.results.length} tasks on page ${page}`);
    
    allModifiedTasks = allModifiedTasks.concat(data.results);

    hasMore = !!data.paging?.next?.after;
    after = data.paging?.next?.after;

    // Respect API rate limits
    if (hasMore) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  logger.info(`🎯 Total modified tasks fetched: ${allModifiedTasks.length}`);

  if (allModifiedTasks.length === 0) {
    logger.info('✅ No modified tasks found - sync complete');
    
    // Execution record already updated with all details - no additional metadata update needed
    logger.info('✅ Sync execution record contains all necessary tracking information');

    return { 
      contactsUpdated: 0,
      tasksCreated: 0,
      tasksUpdated: 0,
      tasksFetched: 0,
      tasksFailed: 0,
      errors: 0,
      duration: Date.now() - startTime,
      taskDetails: {
        fetchedTaskIds: [],
        createdTaskIds: [],
        updatedTaskIds: [],
        failedTaskIds: [],
        failedDetails: []
      },
      taskSyncAttempts: [] // No tasks = no sync attempts
    };
  }

  // ==== FETCH TASK-CONTACT ASSOCIATIONS ====
  logger.info('🔗 Fetching task-contact associations...');
  
  const taskIds = allModifiedTasks.map(task => task.id);
  const taskContactMap: { [taskId: string]: string } = {};

  if (taskIds.length > 0) {
    const batchSize = 100;
    for (let i = 0; i < taskIds.length; i += batchSize) {
      const batchTaskIds = taskIds.slice(i, i + batchSize);
      
      logger.info(`📞 Fetching associations batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(taskIds.length / batchSize)}...`);

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
          
          for (const result of associationData.results) {
            if (result.to && result.to.length > 0) {
              taskContactMap[result.from.id] = result.to[0].toObjectId;
            }
          }
        } else {
          logger.warn(`Failed to fetch associations batch: ${associationResponse.status}`);
        }
      } catch (error) {
        logger.warn('Error fetching association batch:', error);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  logger.info(`🔗 Found ${Object.keys(taskContactMap).length} task-contact associations`);

  // ==== FETCH CONTACT DETAILS ====
  const contactIds = Array.from(new Set(Object.values(taskContactMap).filter(Boolean)));
  logger.info(`👥 Fetching details for ${contactIds.length} unique contacts...`);

  const contactsMap: { [contactId: string]: any } = {};

  if (contactIds.length > 0) {
    const contactBatchSize = 100;
    for (let i = 0; i < contactIds.length; i += contactBatchSize) {
      const batchContactIds = contactIds.slice(i, i + contactBatchSize);
      
      logger.info(`👤 Fetching contacts batch ${Math.floor(i / contactBatchSize) + 1}/${Math.ceil(contactIds.length / contactBatchSize)}...`);

      try {
        const contactResponse = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/batch/read', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${hubspotToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: batchContactIds.map(id => ({ id })),
            properties: ['firstname', 'lastname', 'mobilephone', 'ensol_source_group', 'hs_lead_status', 'lifecyclestage', 'createdate', 'lastmodifieddate']
          }),
        });

        hubspotApiCallCount++;

        if (contactResponse.ok) {
          const contactData = await contactResponse.json();
          
          for (const contact of contactData.results) {
            contactsMap[contact.id] = contact;
          }
        } else {
          logger.warn(`Failed to fetch contacts batch: ${contactResponse.status}`);
        }
      } catch (error) {
        logger.warn('Error fetching contact batch:', error);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  logger.info(`👥 Fetched details for ${Object.keys(contactsMap).length} contacts`);

  // ==== PROCESS AND UPSERT CONTACTS ====
  logger.info('💾 Processing and upserting contacts...');
  
  let contactsUpdated = 0;
  let contactErrors = 0;

  if (Object.keys(contactsMap).length > 0) {
    const contactsToUpsert = Object.values(contactsMap).map((contact: any) => ({
      hs_object_id: contact.id,
      firstname: contact.properties?.firstname || null,
      lastname: contact.properties?.lastname || null,
      mobilephone: contact.properties?.mobilephone || null,
      ensol_source_group: contact.properties?.ensol_source_group || null,
      hs_lead_status: contact.properties?.hs_lead_status || null,
      lifecyclestage: contact.properties?.lifecyclestage || null,
      createdate: contact.properties?.createdate ? new Date(contact.properties.createdate).toISOString() : null,
      lastmodifieddate: contact.properties?.lastmodifieddate ? new Date(contact.properties.lastmodifieddate).toISOString() : null,
      updated_at: new Date().toISOString()
    }));

    const { data: contactsData, error: contactsError } = await supabase
      .from('hs_contacts')
      .upsert(contactsToUpsert, { 
        onConflict: 'hs_object_id',
        ignoreDuplicates: false 
      })
      .select('hs_object_id');

    if (contactsError) {
      logger.error('Error upserting contacts:', contactsError);
      contactErrors++;
    } else {
      contactsUpdated = contactsData?.length || 0;
      contactsData?.forEach(contact => {
        processedContactIds.push(contact.hs_object_id);
      });
      logger.info(`✅ Upserted ${contactsUpdated} contacts`);
    }
  }

  // ==== PROCESS AND UPSERT TASKS ====
  logger.info('📋 Processing and upserting tasks...');
  
  // First, check which tasks already exist to distinguish created vs updated
  const allTaskIds = allModifiedTasks.map((task: HubSpotTask) => task.id);
  const { data: existingTasks } = await supabase
    .from('hs_tasks')
    .select('hs_object_id')
    .in('hs_object_id', allTaskIds);
  
  const existingTaskIds = new Set(existingTasks?.map(t => t.hs_object_id) || []);
  
  let tasksCreated = 0;
  let tasksUpdated = 0;
  let tasksFetched = allModifiedTasks.length;
  let tasksFailed = 0;
  let errors = contactErrors;
  let warningCount = 0;

  if (allModifiedTasks.length > 0) {
    // Process all tasks and prepare for upsert
    const tasksToUpsert = allModifiedTasks.map((task: HubSpotTask) => {
      processedTaskIds.push(task.id);

      const contactId = taskContactMap[task.id];
      
      return {
        hs_object_id: task.id,
        hs_createdate: task.properties?.hs_createdate ? new Date(task.properties.hs_createdate).toISOString() : null,
        hs_lastmodifieddate: task.properties?.hs_lastmodifieddate ? new Date(task.properties.hs_lastmodifieddate).toISOString() : null,
        hs_body_preview: task.properties?.hs_body_preview || null,
        hs_created_by_user_id: task.properties?.hs_created_by_user_id || null,
        hs_queue_membership_ids: task.properties?.hs_queue_membership_ids || null,
        hs_task_body: task.properties?.hs_task_body || null,
        hs_task_completion_count: task.properties?.hs_task_completion_count ? parseInt(task.properties.hs_task_completion_count) : 0,
        hs_task_completion_date: task.properties?.hs_task_completion_date ? new Date(task.properties.hs_task_completion_date).toISOString() : null,
        hs_task_for_object_type: task.properties?.hs_task_for_object_type || null,
        hs_task_is_all_day: task.properties?.hs_task_is_all_day === 'true',
        hs_task_is_overdue: task.properties?.hs_task_is_overdue === 'true',
        hs_task_last_contact_outreach: task.properties?.hs_task_last_contact_outreach ? new Date(task.properties.hs_task_last_contact_outreach).toISOString() : null,
        hs_task_priority: task.properties?.hs_task_priority || null,
        hs_task_status: task.properties?.hs_task_status || null,
        hs_task_subject: task.properties?.hs_task_subject || null,
        hs_task_type: task.properties?.hs_task_type || null,
        hs_duration: task.properties?.hs_duration || null,
        hs_timestamp: task.properties?.hs_timestamp ? new Date(task.properties.hs_timestamp).toISOString() : null,
        hs_updated_by_user_id: task.properties?.hs_updated_by_user_id || null,
        hubspot_owner_assigneddate: task.properties?.hubspot_owner_assigneddate ? new Date(task.properties.hubspot_owner_assigneddate).toISOString() : null,
        hubspot_owner_id: task.properties?.hubspot_owner_id || null,
        hubspot_team_id: task.properties?.hubspot_team_id || null,
        associated_contact_id: contactId || null,
        associated_deal_id: null, // Could be enhanced later
        archived: task.archived || false,
        updated_at: new Date().toISOString()
      };
    });

    // Check for tasks with missing contact references
    tasksToUpsert.forEach(task => {
      const contactId = task.associated_contact_id;
      if (contactId) {
        if (contactId) {
          logger.warn(`⚠️ Task ${task.hs_object_id} references missing contact ${contactId}`);
          warningCount++;
        }
      }
    });

    logger.info(`📝 Upserting ${tasksToUpsert.length} tasks...`);

    try {
      const { data: tasksData, error: tasksError } = await supabase
        .from('hs_tasks')
        .upsert(tasksToUpsert, { 
          onConflict: 'hs_object_id',
          ignoreDuplicates: false 
        })
        .select('hs_object_id');

      if (tasksError) {
        logger.error('Error upserting tasks:', tasksError);
        errors++;
        tasksFailed = tasksToUpsert.length;
        
        // Add all tasks to failed list
        tasksToUpsert.forEach(task => {
          failedTaskIds.push(task.hs_object_id);
          failedDetails.push({
            taskId: task.hs_object_id,
            error: tasksError.message,
            stage: 'upsert_task'
          });
        });
        
        throw tasksError;
      }

      // Track successful updates and count created vs updated
      if (tasksData) {
        tasksData.forEach(task => {
          updatedTaskIds.push(task.hs_object_id);
          if (existingTaskIds.has(task.hs_object_id)) {
            tasksUpdated++;
          } else {
            tasksCreated++;
          }
        });
      }

      logger.info(`✅ Upserted ${tasksData?.length || 0} tasks (${tasksCreated} created, ${tasksUpdated} updated)`);

    } catch (error) {
      logger.error('Failed to upsert tasks:', error);
      // Error already handled above
    }

    // Errors are already tracked in the execution record - no additional metadata update needed
    logger.info(`⚠️ Sync completed with ${errors} errors out of ${tasksFetched} tasks fetched`);
  }

  const duration = Date.now() - startTime;

  // Create consolidated task sync attempts (one record per task per execution)
  logger.info('📝 Creating consolidated task sync records...');
  allModifiedTasks.forEach(task => {
    const taskId = task.id;
    const isSuccess = updatedTaskIds.includes(taskId);
    const isFailed = failedTaskIds.includes(taskId);
    
    // Determine final status and stage
    let status: 'success' | 'failed' = 'success';
    let stage = 'complete';
    let errorMessage: string | undefined;
    
    if (isFailed) {
      status = 'failed';
      const failureDetail = failedDetails.find(f => f.taskId === taskId);
      stage = failureDetail?.stage || 'upsert_task';
      errorMessage = failureDetail?.error;
    }
    
    // Check for warnings (missing contact references)
    const warnings: string[] = [];
    if (task.properties?.hubspot_owner_assigneddate && 
        task.associations?.contacts?.results?.some((contact: any) => 
          !processedContactIds.includes(contact.id))) {
      warnings.push('Missing contact reference in database');
    }
    
    taskSyncAttempts.push({
      taskHubspotId: taskId,
      status,
      stage,
      errorMessage,
      hubspotResponse: { properties: task.properties },
      supabaseData: isSuccess ? { upserted: true } : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    });
  });

  logger.info('=== INCREMENTAL SYNC COMPLETE ===');
  logger.info(`📊 Contacts updated: ${contactsUpdated}`);
  logger.info(`🆕 Tasks created: ${tasksCreated}`);
  logger.info(`📋 Tasks updated: ${tasksUpdated}`);
  logger.info(`📦 Tasks fetched: ${tasksFetched}`);
  logger.info(`❌ Tasks failed: ${tasksFailed}`);
  logger.info(`⚠️ Warnings: ${warningCount}`);
  logger.info(`🕒 Duration: ${Math.round(duration / 1000)}s`);
  logger.info(`📞 HubSpot API calls: ${hubspotApiCallCount}`);

  // Execution record already updated with all details - no additional metadata update needed
  logger.info('✅ Sync execution record contains all necessary tracking information');

  return {
    contactsUpdated,
    tasksCreated,
    tasksUpdated,
    tasksFetched,
    tasksFailed,
    errors,
    duration,
    hubspotApiCalls: hubspotApiCallCount,
    taskDetails: {
      fetchedTaskIds,
      createdTaskIds: tasksToUpsert.filter(task => !existingTaskIds.has(task.hs_object_id)).map(task => task.hs_object_id),
      updatedTaskIds,
      failedTaskIds,
      failedDetails
    },
    taskSyncAttempts
  };
}