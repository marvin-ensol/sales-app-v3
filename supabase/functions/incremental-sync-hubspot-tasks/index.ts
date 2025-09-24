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
  actionType: 'created' | 'updated' | 'skipped' | 'failed' | 'unknown' | 'completed';
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
    skippedOrphanTasks?: number;
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
            hubspot_response: attempt.hubspotResponse,
            action_type: attempt.actionType
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
    filterGroups: [
      {
        // Group 1: Non-completed tasks modified since last sync
        filters: [
          {
            propertyName: "hs_lastmodifieddate",
            operator: "GTE",
            value: lastSyncTimestamp
          },
          {
            propertyName: "hs_task_status",
            operator: "NEQ",
            value: "COMPLETED"
          }
        ]
      },
      {
        // Group 2: Tasks completed since last sync (to catch new completions)
        filters: [
          {
            propertyName: "hs_task_completion_date",
            operator: "GTE",
            value: lastSyncTimestamp
          }
        ]
      }
    ]
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

  // ==== FETCH TASK ASSOCIATIONS (CONTACTS, DEALS, COMPANIES) ====
  logger.info('🔗 Fetching task associations...');
  
  const taskIds = allModifiedTasks.map(task => task.id);
  const taskContactMap: { [taskId: string]: string } = {};
  const taskDealMap: { [taskId: string]: string } = {};
  const taskCompanyMap: { [taskId: string]: string } = {};

  if (taskIds.length > 0) {
    const batchSize = 100;
    
    // Fetch task-contact associations
    logger.info('📞 Fetching task-contact associations...');
    for (let i = 0; i < taskIds.length; i += batchSize) {
      const batchTaskIds = taskIds.slice(i, i + batchSize);
      
      logger.info(`📞 Fetching contact associations batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(taskIds.length / batchSize)}...`);

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
          
          // Store task-contact associations (taking first contact if multiple)
          associationData.results.forEach((result: any) => {
            if (result.to && result.to.length > 0) {
              taskContactMap[result.from.id] = result.to[0].id;
            }
          });
        } else {
          logger.warn(`Failed to fetch task-contact associations: ${associationResponse.status}`);
        }
      } catch (error) {
        logger.warn('Error fetching task-contact associations:', error);
      }

      // Respect API rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Fetch task-deal associations
    logger.info('🔗 Fetching task-deal associations...');
    for (let i = 0; i < taskIds.length; i += batchSize) {
      const batchTaskIds = taskIds.slice(i, i + batchSize);
      
      logger.info(`📞 Fetching deal associations batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(taskIds.length / batchSize)}...`);

      try {
        const dealAssociationResponse = await fetch('https://api.hubapi.com/crm/v4/associations/tasks/deals/batch/read', {
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

        if (dealAssociationResponse.ok) {
          const dealAssociationData = await dealAssociationResponse.json();
          
          // Store task-deal associations (taking first deal if multiple)
          dealAssociationData.results.forEach((result: any) => {
            if (result.to && result.to.length > 0) {
              taskDealMap[result.from.id] = result.to[0].id;
            }
          });
        } else {
          logger.warn(`Failed to fetch task-deal associations: ${dealAssociationResponse.status}`);
        }
      } catch (error) {
        logger.warn('Error fetching task-deal associations:', error);
      }

      // Respect API rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Fetch task-company associations
    logger.info('🔗 Fetching task-company associations...');
    for (let i = 0; i < taskIds.length; i += batchSize) {
      const batchTaskIds = taskIds.slice(i, i + batchSize);
      
      logger.info(`📞 Fetching company associations batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(taskIds.length / batchSize)}...`);

      try {
        const companyAssociationResponse = await fetch('https://api.hubapi.com/crm/v4/associations/tasks/companies/batch/read', {
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

        if (companyAssociationResponse.ok) {
          const companyAssociationData = await companyAssociationResponse.json();
          
          // Store task-company associations (taking first company if multiple)
          companyAssociationData.results.forEach((result: any) => {
            if (result.to && result.to.length > 0) {
              taskCompanyMap[result.from.id] = result.to[0].id;
            }
          });
        } else {
          logger.warn(`Failed to fetch task-company associations: ${companyAssociationResponse.status}`);
        }
      } catch (error) {
        logger.warn('Error fetching task-company associations:', error);
      }

      // Respect API rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  logger.info(`🔗 Found ${Object.keys(taskContactMap).length} task-contact associations`);
  logger.info(`🔗 Found ${Object.keys(taskDealMap).length} task-deal associations`);
  logger.info(`🔗 Found ${Object.keys(taskCompanyMap).length} task-company associations`);

  // ==== RESOLVE CONTACT ASSOCIATIONS VIA DEALS ====
  logger.info('🔗 Resolving contact associations via deals...');
  
  const finalTaskContactMap = { ...taskContactMap };
  const dealContactMap: { [dealId: string]: string } = {};
  
  // Get unique deal IDs that don't already have direct contact associations
  const dealsNeedingContactResolution = Object.entries(taskDealMap)
    .filter(([taskId]) => !taskContactMap[taskId])
    .map(([, dealId]) => dealId);
  
  const uniqueDealIds = [...new Set(dealsNeedingContactResolution)];
  
  if (uniqueDealIds.length > 0) {
    logger.info(`🔗 Fetching contact associations for ${uniqueDealIds.length} deals...`);
    
    // Fetch deal-contact associations
    const dealBatchSize = 100;
    for (let i = 0; i < uniqueDealIds.length; i += dealBatchSize) {
      const batchDealIds = uniqueDealIds.slice(i, i + dealBatchSize);
      
      logger.info(`📞 Fetching deal-contact associations batch ${Math.floor(i / dealBatchSize) + 1}/${Math.ceil(uniqueDealIds.length / dealBatchSize)}...`);

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

        hubspotApiCallCount++;

        if (dealContactResponse.ok) {
          const dealContactData = await dealContactResponse.json();
          
          // Store deal-contact associations
          dealContactData.results.forEach((result: any) => {
            if (result.to && result.to.length > 0) {
              dealContactMap[result.from.id] = result.to[0].id;
            }
          });
        } else {
          logger.warn(`Failed to fetch deal-contact associations: ${dealContactResponse.status}`);
        }
      } catch (error) {
        logger.warn('Error fetching deal-contact associations:', error);
      }

      // Respect API rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Resolve task-contact associations via deals
    let resolvedTaskContacts = 0;
    for (const [taskId, dealId] of Object.entries(taskDealMap)) {
      if (!taskContactMap[taskId] && dealContactMap[dealId]) {
        finalTaskContactMap[taskId] = dealContactMap[dealId];
        resolvedTaskContacts++;
      }
    }
    
    logger.info(`✅ Resolved ${resolvedTaskContacts} additional task-contact relationships via deals`);
    
    // Create missing task-contact associations in HubSpot
    if (resolvedTaskContacts > 0) {
      logger.info(`🔗 Creating ${resolvedTaskContacts} missing task-contact associations in HubSpot...`);
      
      const associationsToCreate = [];
      for (const [taskId, dealId] of Object.entries(taskDealMap)) {
        if (!taskContactMap[taskId]) {
          const contactId = dealContactMap[dealId];
          if (contactId) {
            associationsToCreate.push({
              types: [{
                associationCategory: "HUBSPOT_DEFINED",
                associationTypeId: 204 // Task to Contact association type
              }],
              from: { id: taskId },
              to: { id: contactId }
            });
          }
        }
      }
      
      // Create associations in batches of 100
      const createBatchSize = 100;
      let createdAssociations = 0;
      
      for (let i = 0; i < associationsToCreate.length; i += createBatchSize) {
        const batchAssociations = associationsToCreate.slice(i, i + createBatchSize);
        logger.info(`🔗 Creating associations batch ${Math.floor(i / createBatchSize) + 1}/${Math.ceil(associationsToCreate.length / createBatchSize)}...`);

        try {
          const createResponse = await fetch('https://api.hubapi.com/crm/v4/associations/tasks/contacts/batch/create', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${hubspotToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              inputs: batchAssociations
            }),
          });

          hubspotApiCallCount++;

          if (createResponse.ok) {
            const createData = await createResponse.json();
            createdAssociations += createData.results ? createData.results.length : batchAssociations.length;
            logger.info(`✅ Created ${batchAssociations.length} task-contact associations`);
          } else {
            logger.warn(`Failed to create associations batch: ${createResponse.status}`);
          }
        } catch (error) {
          logger.warn('Error creating associations batch:', error);
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      logger.info(`🎉 Created ${createdAssociations} new task-contact associations in HubSpot`);
    }
  }

  // ==== FILTER OUT ORPHAN TASKS ====
  logger.info('🔍 Filtering out orphan tasks (no contact, deal, or company associations)...');
  
  const tasksWithAssociations = allModifiedTasks.filter(task => {
    const hasContact = finalTaskContactMap[task.id];
    const hasDeal = taskDealMap[task.id];
    const hasCompany = taskCompanyMap[task.id];
    
    if (!hasContact && !hasDeal && !hasCompany) {
      logger.warn(`⚠️ Skipping orphan task ${task.id}: no contact, deal, or company associations`);
      taskSyncAttempts.push({
        taskHubspotId: task.id,
        status: 'success',
        stage: 'filtered',
        actionType: 'skipped',
        warnings: ['Task skipped - no associations found']
      });
      return false;
    }
    
    return true;
  });
  
  logger.info(`🎯 Processing ${tasksWithAssociations.length} tasks with associations (${allModifiedTasks.length - tasksWithAssociations.length} orphan tasks skipped)`);

  // ==== FETCH CONTACT DETAILS ====
  const uniqueContactIds = [...new Set(Object.values(finalTaskContactMap))];
  logger.info(`👥 Fetching details for ${uniqueContactIds.length} unique contacts...`);
  
  interface HubSpotContact {
    id: string;
    properties: {
      firstname?: string;
      lastname?: string;
      createdate?: string;
      lastmodifieddate?: string;
      mobilephone?: string;
      ensol_source_group?: string;
      hs_lead_status?: string;
      lifecyclestage?: string;
    };
  }
  
  let allContacts: HubSpotContact[] = [];
  if (uniqueContactIds.length > 0) {
    // Fetch contact details in batches of 100
    const contactBatchSize = 100;
    for (let i = 0; i < uniqueContactIds.length; i += contactBatchSize) {
      const batchContactIds = uniqueContactIds.slice(i, i + contactBatchSize);
      
      logger.info(`👤 Fetching contacts batch ${Math.floor(i / contactBatchSize) + 1}/${Math.ceil(uniqueContactIds.length / contactBatchSize)}...`);

      try {
        const contactResponse = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/batch/read', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${hubspotToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: batchContactIds.map(id => ({ id })),
            properties: ['firstname', 'lastname', 'createdate', 'lastmodifieddate', 'mobilephone', 'ensol_source_group', 'hs_lead_status', 'lifecyclestage']
          }),
        });

        hubspotApiCallCount++;

        if (contactResponse.ok) {
          const contactData = await contactResponse.json();
          allContacts = allContacts.concat(contactData.results);
        } else {
          logger.warn(`Failed to fetch contacts batch: ${contactResponse.status}`);
        }
      } catch (error) {
        logger.warn('Error fetching contact batch:', error);
      }

      // Respect API rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  logger.info(`👥 Fetched details for ${allContacts.length} contacts`);

  // ==== PROCESS AND UPSERT CONTACTS ====
  logger.info('💾 Processing and upserting contacts...');
  
  let contactsUpdated = 0;
  let contactErrors = 0;

  if (allContacts.length > 0) {
    // Helper function to safely parse contact timestamps
    const parseContactTimestamp = (value: any): string | null => {
      if (!value || value === '' || value === 'null' || value === '0') return null;
      
      // Handle ISO 8601 strings (e.g., "2025-09-09T20:10:54.324Z")
      if (typeof value === 'string' && value.includes('T') && value.includes('Z')) {
        const date = new Date(value);
        return !isNaN(date.getTime()) && date.getFullYear() > 1970 ? date.toISOString() : null;
      }
      
      // Handle numeric timestamps
      const timestamp = parseInt(String(value));
      if (isNaN(timestamp) || timestamp === 0) return null;
      const date = new Date(timestamp);
      return date.getFullYear() > 1970 ? date.toISOString() : null;
    };

    const contactsToUpsert = allContacts.map((contact: any) => ({
      hs_object_id: contact.id,
      firstname: contact.properties?.firstname || null,
      lastname: contact.properties?.lastname || null,
      mobilephone: contact.properties?.mobilephone || null,
      ensol_source_group: contact.properties?.ensol_source_group || null,
      hs_lead_status: contact.properties?.hs_lead_status || null,
      lifecyclestage: contact.properties?.lifecyclestage || null,
      createdate: parseContactTimestamp(contact.properties?.createdate),
      lastmodifieddate: parseContactTimestamp(contact.properties?.lastmodifieddate),
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
  
  let tasksCreated = 0;
  let tasksUpdated = 0;
  let warnings = 0;
  
  if (tasksWithAssociations.length === 0) {
    logger.warn('⚠️ No tasks with associations found');
    
    return {
      contactsUpdated: 0,
      tasksCreated: 0,
      tasksUpdated: 0,
      tasksFetched: allModifiedTasks.length,
      tasksFailed: 0,
      errors: 0,
      duration: Date.now() - startTime,
      hubspotApiCalls: hubspotApiCallCount,
      taskDetails: {
        fetchedTaskIds,
        createdTaskIds: [],
        updatedTaskIds: [],
        failedTaskIds: [],
        failedDetails: [],
        skippedOrphanTasks: allModifiedTasks.length - tasksWithAssociations.length
      },
      taskSyncAttempts
    };
  }

  // First, check which tasks already exist to distinguish created vs updated
  const allTaskIds = tasksWithAssociations.map((task: HubSpotTask) => task.id);
  const { data: existingTasks } = await supabase
    .from('hs_tasks')
    .select('hs_object_id')
    .in('hs_object_id', allTaskIds);
  
  const existingTaskIds = new Set(existingTasks?.map(t => t.hs_object_id) || []);
  
  let tasksFailed = 0;
  let errors = contactErrors;
  let tasksToUpsert: any[] = [];

  logger.info(`📝 Upserting ${tasksWithAssociations.length} tasks...`);
  
  // Process tasks in batches
  const taskBatchSize = 100;
  for (let i = 0; i < tasksWithAssociations.length; i += taskBatchSize) {
    const batchTasks = tasksWithAssociations.slice(i, i + taskBatchSize);
    
    // Check for missing contacts and warn
    const missingContactWarnings = batchTasks
      .filter(task => {
        const contactId = finalTaskContactMap[task.id];
        if (!contactId) {
          warnings++;
          logger.warn(`⚠️ Task ${task.id} has no associated contact`);
          taskSyncAttempts.push({
            taskHubspotId: task.id,
            status: 'success',
            stage: 'validation',
            actionType: 'updated',
            warnings: ['Missing contact association']
          });
          return true;
        }
        
        const contactExists = allContacts.some(c => c.id === contactId);
        if (!contactExists) {
          warnings++;
          logger.warn(`⚠️ Task ${task.id} references missing contact ${contactId}`);
          taskSyncAttempts.push({
            taskHubspotId: task.id,
            status: 'success',
            stage: 'validation',
            actionType: 'updated',
            warnings: [`Missing contact ${contactId}`]
          });
          return true;
        }
        
        return false;
      });

    // Transform tasks for database
    const batchTasksToUpsert = batchTasks.map((task: HubSpotTask) => {
      processedTaskIds.push(task.id);

      // Helper function to safely parse timestamps
      const parseTimestamp = (value: any): string | null => {
        if (!value || value === '' || value === 'null' || value === '0') return null;
        
        // Handle ISO 8601 strings (e.g., "2025-09-05T07:00:11.629Z")
        if (typeof value === 'string' && value.includes('T') && value.includes('Z')) {
          const date = new Date(value);
          return !isNaN(date.getTime()) && date.getFullYear() > 1970 ? date.toISOString() : null;
        }
        
        // Handle numeric timestamps
        const timestamp = parseInt(String(value));
        if (isNaN(timestamp) || timestamp === 0) return null;
        const date = new Date(timestamp);
        return date.getFullYear() > 1970 ? date.toISOString() : null;
      };
      
      return {
        hs_object_id: task.id,
        hs_createdate: parseTimestamp(task.properties?.hs_createdate),
        hs_lastmodifieddate: parseTimestamp(task.properties?.hs_lastmodifieddate),
        hs_body_preview: task.properties?.hs_body_preview || null,
        hs_created_by_user_id: task.properties?.hs_created_by_user_id || null,
        hs_queue_membership_ids: task.properties?.hs_queue_membership_ids || null,
        hs_task_body: task.properties?.hs_task_body || null,
        hs_task_completion_count: task.properties?.hs_task_completion_count ? parseInt(task.properties.hs_task_completion_count) : 0,
        hs_task_completion_date: parseTimestamp(task.properties?.hs_task_completion_date),
        hs_task_for_object_type: task.properties?.hs_task_for_object_type || null,
        hs_task_is_all_day: task.properties?.hs_task_is_all_day === 'true',
        hs_task_is_overdue: task.properties?.hs_task_is_overdue === 'true',
        hs_task_last_contact_outreach: parseTimestamp(task.properties?.hs_task_last_contact_outreach),
        hs_task_priority: task.properties?.hs_task_priority || null,
        hs_task_status: task.properties?.hs_task_status || null,
        hs_task_subject: task.properties?.hs_task_subject || null,
        hs_task_type: task.properties?.hs_task_type || null,
        hs_duration: task.properties?.hs_duration || null,
        hs_timestamp: parseTimestamp(task.properties?.hs_timestamp),
        hs_updated_by_user_id: task.properties?.hs_updated_by_user_id || null,
        hubspot_owner_assigneddate: parseTimestamp(task.properties?.hubspot_owner_assigneddate),
        hubspot_owner_id: task.properties?.hubspot_owner_id || null,
        hubspot_team_id: task.properties?.hubspot_team_id || null,
        archived: task.archived || false,
        associated_contact_id: finalTaskContactMap[task.id] || null,
        associated_deal_id: taskDealMap[task.id] || null,
        associated_company_id: taskCompanyMap[task.id] || null,
        updated_at: new Date().toISOString()
      };
    });

    try {
      const { data: tasksData, error: tasksError } = await supabase
        .from('hs_tasks')
        .upsert(batchTasksToUpsert, { 
          onConflict: 'hs_object_id',
          ignoreDuplicates: false 
        })
        .select('hs_object_id');

      if (tasksError) {
        logger.error('Error upserting tasks batch:', tasksError);
        errors++;
        tasksFailed += batchTasksToUpsert.length;
        
        // Add all tasks to failed list
        batchTasksToUpsert.forEach(task => {
          failedTaskIds.push(task.hs_object_id);
          failedDetails.push({
            taskId: task.hs_object_id,
            error: tasksError.message,
            stage: 'upsert_task'
          });
        });
      } else {
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
        
        const upsertedCount = tasksData?.length || 0;
        logger.info(`✅ Upserted batch: ${upsertedCount} tasks`);
      }

    } catch (error) {
      logger.error('Failed to upsert tasks batch:', error);
      // Error already handled above
    }

    // Respect rate limits between batches
    if (i + taskBatchSize < tasksWithAssociations.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  const duration = Date.now() - startTime;
  const upsertedCount = tasksCreated + tasksUpdated;

  // Create consolidated task sync attempts (one record per task per execution)
  logger.info('📝 Creating consolidated task sync records...');
  allModifiedTasks.forEach(task => {
    const taskId = task.id;
    const isSuccess = updatedTaskIds.includes(taskId);
    const isFailed = failedTaskIds.includes(taskId);
    const isSkipped = !tasksWithAssociations.some(t => t.id === taskId);
    
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
    
    // Determine action type based on success and whether task existed
    let actionType = 'unknown';
    if (isSkipped) {
      actionType = 'skipped';
    } else if (isSuccess) {
      // Check if task was completed since last sync (prioritize completion status)
      if (task.properties?.hs_task_completion_date) {
        const completionDate = new Date(task.properties.hs_task_completion_date);
        const lastSyncDate = new Date(lastSyncTimestamp);
        
        if (completionDate >= lastSyncDate) {
          actionType = 'completed';
        } else {
          actionType = existingTaskIds.has(taskId) ? 'updated' : 'created';
        }
      } else {
        actionType = existingTaskIds.has(taskId) ? 'updated' : 'created';
      }
    } else {
      actionType = 'failed';
    }
    
    // Only add to attempts if not already added during processing
    if (!taskSyncAttempts.some(a => a.taskHubspotId === taskId)) {
      taskSyncAttempts.push({
        taskHubspotId: taskId,
        status,
        stage,
        errorMessage,
        hubspotResponse: { properties: task.properties },
        supabaseData: isSuccess ? { upserted: true } : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
        actionType
      });
    }
  });

  logger.info('=== INCREMENTAL SYNC COMPLETE ===');
  logger.info(`📊 Contacts updated: ${contactsUpdated}`);
  logger.info(`🆕 Tasks created: ${tasksCreated}`);
  logger.info(`📋 Tasks updated: ${tasksUpdated}`);
  logger.info(`📦 Tasks fetched: ${allModifiedTasks.length}`);
  logger.info(`❌ Tasks failed: ${tasksFailed}`);
  logger.info(`⚠️ Warnings: ${warnings}`);
  logger.info(`🕒 Duration: ${Math.round(duration / 1000)}s`);
  logger.info(`📞 HubSpot API calls: ${hubspotApiCallCount}`);
  logger.info(`⚠️ Sync completed with ${tasksFailed} errors out of ${allModifiedTasks.length} tasks fetched`);
  logger.info(`🚫 Orphan tasks skipped: ${allModifiedTasks.length - tasksWithAssociations.length}`);
  
  // Execution record already updated with all details - no additional metadata update needed
  logger.info('✅ Sync execution record contains all necessary tracking information');

  return {
    contactsUpdated,
    tasksCreated,
    tasksUpdated,
    tasksFetched: allModifiedTasks.length,
    tasksFailed,
    errors: tasksFailed,
    duration,
    hubspotApiCalls: hubspotApiCallCount,
    taskDetails: {
      fetchedTaskIds,
      createdTaskIds: processedTaskIds.filter(id => {
        const attempt = taskSyncAttempts.find(a => a.taskHubspotId === id);
        return attempt?.actionType === 'created';
      }),
      updatedTaskIds,
      failedTaskIds,
      failedDetails,
      skippedOrphanTasks: allModifiedTasks.length - tasksWithAssociations.length
    },
    taskSyncAttempts
  };
}