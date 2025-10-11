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

interface HubSpotResponse {
  results: HubSpotTask[];
  paging?: {
    next?: {
      after: string;
    };
  };
  total: number;
}

interface HubSpotAssociationResponse {
  results: Array<{
    from: { id: string };
    to: Array<{
      toObjectId: string;
      associationTypes: Array<{
        typeId: number;
        label: string;
        category: string;
      }>;
    }>;
  }>;
}

interface HubSpotContact {
  id: string;
  properties: {
    firstname?: string;
    lastname?: string;
    mobilephone?: string;
    ensol_source_group?: string;
    hs_lead_status?: string;
    lifecyclestage?: string;
    createdate?: string;
    lastmodifieddate?: string;
    [key: string]: any;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== HUBSPOT TASKS SYNC START ===');
    
    // Get environment variables
    const hubspotToken = Deno.env.get('HUBSPOT_API_TOKEN');
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

    // Create a ReadableStream for Server-Sent Events
    const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const startTime = Date.now(); // Track sync start time
      
      const sendEvent = (data: any) => {
        const chunk = encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
        controller.enqueue(chunk);
      };

      interface Operation {
        id: string;
        name: string;
        status: string;
        message?: string;
        count?: number;
      }

      const sendOperationUpdate = (operationId: string, status: string, message?: string, count?: number) => {
        const operations: Operation[] = [
          { id: 'tasks', name: 'Fetching Tasks', status: operationId === 'tasks' ? status : 'pending' },
          { id: 'associations', name: 'Task Associations', status: operationId === 'associations' ? status : (operationId === 'tasks' && status === 'complete') ? 'pending' : 'pending' },
          { id: 'contacts', name: 'Fetching Contacts', status: operationId === 'contacts' ? status : (operationId === 'associations' && status === 'complete') ? 'pending' : 'pending' },
          { id: 'database', name: 'Writing to Database', status: operationId === 'database' ? status : (operationId === 'contacts' && status === 'complete') ? 'pending' : 'pending' }
        ];

          // Update based on current progress
          if (operationId === 'associations' && status === 'running') {
            operations[0].status = 'complete';
          } else if (operationId === 'contacts' && status === 'running') {
            operations[0].status = 'complete';
            operations[1].status = 'complete';
          } else if (operationId === 'database' && status === 'running') {
            operations[0].status = 'complete';
            operations[1].status = 'complete';
            operations[2].status = 'complete';
          } else if (operationId === 'database' && status === 'complete') {
            operations.forEach(op => op.status = 'complete');
          }

          // Add message and count to current operation
          const currentOp = operations.find(op => op.id === operationId);
          if (currentOp && message) {
            currentOp.message = message;
          }
          if (currentOp && count) {
            currentOp.count = count;
          }

          sendEvent({
            phase: operationId === 'database' && status === 'complete' ? 'complete' : 'processing',
            operations,
            currentOperation: operationId,
            message: message || `Processing ${operationId}...`
          });
        };

        // Start the sync process
        (async () => {
          try {
            sendOperationUpdate('database', 'running', 'Clearing existing data...');
            
            console.log('🗑️ Clearing existing hs_tasks and hs_contacts data...');
            
            // Clear existing data from both tables
            const { error: deleteTasksError } = await supabase
              .from('hs_tasks')
              .delete()
              .neq('hs_object_id', ''); // This deletes all rows

            if (deleteTasksError) {
              console.error('Error clearing existing tasks:', deleteTasksError);
              throw new Error(`Failed to clear existing task data: ${deleteTasksError.message}`);
            }

            const { error: deleteContactsError } = await supabase
              .from('hs_contacts')
              .delete()
              .neq('hs_object_id', ''); // This deletes all rows

            if (deleteContactsError) {
              console.error('Error clearing existing contacts:', deleteContactsError);
              throw new Error(`Failed to clear existing contact data: ${deleteContactsError.message}`);
            }

            console.log('✅ Existing data cleared successfully');
            sendOperationUpdate('tasks', 'running', 'Starting HubSpot tasks fetch...');

            // Prepare the request body - fetch all non-completed tasks
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
                    }
                  ]
                }
              ],
              properties: [
                "hs_body_preview",
                "hs_created_by_user_id",
                "hs_createdate",
                "hs_timestamp",
                "hs_date_entered_60b5c368_04c4_4d32_9b4a_457e159f49b7_13292096",
                "hs_date_entered_61bafb31_e7fa_46ed_aaa9_1322438d6e67_1866552342",
                "hs_date_entered_af0e6a5c_2ea3_4c72_b69f_7c6cb3fdb591_1652950531",
                "hs_date_entered_dd5826e4_c976_4654_a527_b59ada542e52_2144133616",
                "hs_date_entered_fc8148fb_3a2d_4b59_834e_69b7859347cb_1813133675",
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
                "hubspot_owner_assigneddate",
                "hubspot_owner_id",
                "hubspot_team_id"
              ]
            };

            console.log('📥 Starting HubSpot API fetch...');
            
            let allTasks: HubSpotTask[] = [];
            let hasMore = true;
            let after: string | undefined;
            let pageCount = 0;
            const maxPages = 1000; // Safety limit

            while (hasMore && pageCount < maxPages) {
              pageCount++;
              console.log(`📄 Fetching page ${pageCount}${after ? ` (after: ${after})` : ''}...`);

              // Add pagination parameter if we have it
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

              const data: HubSpotResponse = await response.json();
              
              console.log(`📦 Received ${data.results.length} tasks on page ${pageCount}`);
              
              allTasks = allTasks.concat(data.results);

              // Update progress during fetching (10% to 50%)
              const fetchProgress = Math.min(50, 10 + (pageCount * 2));
              sendOperationUpdate('tasks', 'running', `Fetched ${allTasks.length} tasks from ${pageCount} pages...`, allTasks.length);
              
              // Check if there are more pages
              hasMore = !!data.paging?.next?.after;
              after = data.paging?.next?.after;

              // Respect API rate limits - wait between requests
              if (hasMore) {
                console.log('⏳ Waiting 300ms to respect rate limits...');
                await new Promise(resolve => setTimeout(resolve, 300));
              }
            }

            console.log(`🎯 Total tasks fetched: ${allTasks.length} from ${pageCount} pages`);
            sendOperationUpdate('associations', 'running', `Fetching contact associations for ${allTasks.length} tasks...`);

            // Extract task IDs and fetch contact associations
            let taskContactMap: { [taskId: string]: string } = {};
            const taskIds = allTasks.map(task => task.id);
            console.log('🔗 Fetching contact associations...');

            if (taskIds.length > 0) {
              // Fetch contact associations in batches of 100
              const associationBatchSize = 100;
              for (let i = 0; i < taskIds.length; i += associationBatchSize) {
                const batchTaskIds = taskIds.slice(i, i + associationBatchSize);
                
                console.log(`📞 Fetching associations batch ${Math.floor(i / associationBatchSize) + 1}/${Math.ceil(taskIds.length / associationBatchSize)} (${batchTaskIds.length} tasks)...`);

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
                    const associationData: HubSpotAssociationResponse = await associationResponse.json();
                    
                    // Process associations and collect contact IDs
                    for (const result of associationData.results) {
                      if (result.to && result.to.length > 0) {
                        // If multiple contacts, we'll select the oldest one later
                        const contactIds = result.to.map(contact => contact.toObjectId);
                        taskContactMap[result.from.id] = contactIds[0]; // Store first contact for now
                      }
                    }
                  } else {
                    console.warn(`Failed to fetch associations batch: ${associationResponse.status}`);
                  }
                } catch (error) {
                  console.warn('Error fetching association batch:', error);
                }

                // Update progress during association fetching (50% to 60%)
                const assocProgress = Math.min(60, 50 + Math.floor(((i + associationBatchSize) / taskIds.length) * 10));
                sendOperationUpdate('associations', 'running', `Fetched associations for ${Math.min(i + associationBatchSize, taskIds.length)}/${taskIds.length} tasks...`);

                // Respect API rate limits
                await new Promise(resolve => setTimeout(resolve, 300));
              }
            }

            console.log(`🔗 Found ${Object.keys(taskContactMap).length} task-contact associations`);
            
            // ==== ENHANCED TASK-DEAL-CONTACT ASSOCIATION LOGIC ====
            
            // Fetch task-deal associations for ALL tasks (not just those without direct contact associations)
            console.log(`🔍 Fetching task-deal associations for all ${allTasks.length} tasks...`);
            
            const taskDealMap: { [taskId: string]: string } = {};
            const taskCompanyMap: { [taskId: string]: string } = {};
            const finalTaskContactMap = { ...taskContactMap };
            
            // 🔍 DEBUG: Focus on task 285193363680
            const debugTaskId = "285193363680";
            console.log(`🎯 [DEBUG] Starting task-deal association process for target task ${debugTaskId}`);
            
            if (allTasks.length > 0) {
              sendOperationUpdate('task-deal-associations', 'running', `Fetching task-deal associations for ${allTasks.length} tasks...`);
              
              // Batch fetch task-deal associations for ALL tasks
              const taskDealBatchSize = 100;
              const allTaskIds = allTasks.map(t => t.id);
              
              for (let i = 0; i < allTaskIds.length; i += taskDealBatchSize) {
                const batchTaskIds = allTaskIds.slice(i, i + taskDealBatchSize);
                console.log(`🔗 Fetching task-deal associations batch ${Math.floor(i / taskDealBatchSize) + 1}/${Math.ceil(allTaskIds.length / taskDealBatchSize)} (${batchTaskIds.length} tasks)...`);

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

                  // 🔍 DEBUG: Log the API request for our target task
                  if (batchTaskIds.includes(debugTaskId)) {
                    console.log(`🎯 [DEBUG] API request for task-deal associations includes target task ${debugTaskId}`);
                    console.log(`🎯 [DEBUG] API request body:`, JSON.stringify({
                      inputs: batchTaskIds.map(id => ({ id }))
                    }));
                  }

                  if (taskDealResponse.ok) {
                    const taskDealData = await taskDealResponse.json();
                    
                    // 🔍 DEBUG: Log the API response for our target task
                    if (batchTaskIds.includes(debugTaskId)) {
                      console.log(`🎯 [DEBUG] Task-deal API response for batch including ${debugTaskId}:`, JSON.stringify(taskDealData, null, 2));
                    }
                    
                    for (const result of taskDealData.results) {
                      // 🔍 DEBUG: Log processing for our target task
                      if (result.from.id === debugTaskId) {
                        console.log(`🎯 [DEBUG] Processing task-deal result for ${debugTaskId}:`, JSON.stringify(result, null, 2));
                      }
                      
                      if (result.to && result.to.length > 0) {
                        const dealId = result.to[0].toObjectId;
                        // Validate deal ID before storing
                        if (dealId && String(dealId).trim()) {
                          // If multiple deals, select the oldest one based on createdate
                          if (result.to.length > 1) {
                            console.log(`📝 Task ${result.from.id} has ${result.to.length} associated deals, selecting oldest...`);
                          }
                          taskDealMap[result.from.id] = dealId;
                          
                          // 🔍 DEBUG: Log deal mapping for our target task
                          if (result.from.id === debugTaskId) {
                            console.log(`🎯 [DEBUG] Successfully mapped task ${debugTaskId} to deal ${dealId}`);
                          }
                        } else {
                          console.warn(`⚠️ Invalid deal ID for task ${result.from.id}:`, dealId);
                          
                          // 🔍 DEBUG: Log invalid deal for our target task
                          if (result.from.id === debugTaskId) {
                            console.log(`🎯 [DEBUG] FAILED - Invalid deal ID for target task ${debugTaskId}:`, dealId);
                          }
                        }
                      } else {
                        // 🔍 DEBUG: Log no deals found for our target task
                        if (result.from.id === debugTaskId) {
                          console.log(`🎯 [DEBUG] No deals found for target task ${debugTaskId}`);
                        }
                      }
                    }
                  } else {
                    console.warn(`Failed to fetch task-deal associations batch: ${taskDealResponse.status}`);
                  }
                } catch (error) {
                  console.warn('Error fetching task-deal association batch:', error);
                }

                await new Promise(resolve => setTimeout(resolve, 300));
              }
              
              console.log(`🔗 Found ${Object.keys(taskDealMap).length} task-deal associations`);
              
              // 🔍 DEBUG: Check if our target task has a deal mapping
              if (taskDealMap[debugTaskId]) {
                console.log(`🎯 [DEBUG] Target task ${debugTaskId} is mapped to deal: ${taskDealMap[debugTaskId]}`);
              } else {
                console.log(`🎯 [DEBUG] PROBLEM - Target task ${debugTaskId} has NO deal mapping in taskDealMap`);
                console.log(`🎯 [DEBUG] Full taskDealMap:`, taskDealMap);
              }

              // 🏢 Fetch task-company associations
              sendOperationUpdate('task-company-associations', 'running', `Fetching task-company associations for ${allTaskIds.length} tasks...`);
              
              // Batch fetch task-company associations
              for (let i = 0; i < allTaskIds.length; i += taskDealBatchSize) {
                const batchTaskIds = allTaskIds.slice(i, i + taskDealBatchSize);
                console.log(`🏢 Fetching task-company associations batch ${Math.floor(i / taskDealBatchSize) + 1}/${Math.ceil(allTaskIds.length / taskDealBatchSize)} (${batchTaskIds.length} tasks)...`);

                try {
                  const taskCompanyResponse = await fetch('https://api.hubapi.com/crm/v4/associations/tasks/companies/batch/read', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${hubspotToken}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      inputs: batchTaskIds.map(id => ({ id }))
                    }),
                  });

                  if (taskCompanyResponse.ok) {
                    const taskCompanyData = await taskCompanyResponse.json();
                    
                    for (const result of taskCompanyData.results) {
                      if (result.to && result.to.length > 0) {
                        // Get the first company ID (as requested by user)
                        const companyId = result.to[0].toObjectId;
                        if (companyId && String(companyId).trim()) {
                          taskCompanyMap[result.from.id] = companyId;
                          if (result.to.length > 1) {
                            console.log(`🏢 Task ${result.from.id} has ${result.to.length} associated companies, using first one: ${companyId}`);
                          }
                        }
                      }
                    }
                  } else {
                    console.warn(`Failed to fetch task-company associations batch: ${taskCompanyResponse.status}`);
                  }
                } catch (error) {
                  console.warn('Error fetching task-company association batch:', error);
                }

                await new Promise(resolve => setTimeout(resolve, 300));
              }
              
              console.log(`🏢 Found ${Object.keys(taskCompanyMap).length} task-company associations`);
              sendOperationUpdate('task-company-associations', 'complete', `Found ${Object.keys(taskCompanyMap).length} task-company associations`)
              
              // Identify tasks without direct contact associations to enhance via deal chains
              const tasksWithoutContacts = allTasks.filter(task => !taskContactMap[task.id]);
              console.log(`🔍 Found ${tasksWithoutContacts.length} tasks without direct contact associations, attempting to resolve via deals...`);
              
              // If we found task-deal associations, now fetch deal-contact associations
              if (Object.keys(taskDealMap).length > 0) {
                sendOperationUpdate('deal-contact-associations', 'running', `Fetching deal-contact associations for ${Object.keys(taskDealMap).length} deals...`);
                
                const uniqueDealIds = [...new Set(Object.values(taskDealMap))].filter(id => id && String(id).trim());
                const dealContactMap: { [dealId: string]: string } = {};
                
                // 🔍 DEBUG: Check if our expected deal is in the unique deals list
                const expectedDealId = "302135751893";
                if (uniqueDealIds.includes(expectedDealId)) {
                  console.log(`🎯 [DEBUG] Expected deal ${expectedDealId} found in uniqueDealIds list`);
                } else {
                  console.log(`🎯 [DEBUG] PROBLEM - Expected deal ${expectedDealId} NOT found in uniqueDealIds:`, uniqueDealIds);
                }
                
                // Batch fetch deal-contact associations
                for (let i = 0; i < uniqueDealIds.length; i += taskDealBatchSize) {
                  const batchDealIds = uniqueDealIds.slice(i, i + taskDealBatchSize);
                  console.log(`🔗 Fetching deal-contact associations batch ${Math.floor(i / taskDealBatchSize) + 1}/${Math.ceil(uniqueDealIds.length / taskDealBatchSize)} (${batchDealIds.length} deals)...`);
                  
                  // 🔍 DEBUG: Log if our expected deal is in this batch
                  if (batchDealIds.includes(expectedDealId)) {
                    console.log(`🎯 [DEBUG] Expected deal ${expectedDealId} is in this batch`);
                  }

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
                      
                      // 🔍 DEBUG: Log the API response if our expected deal is in this batch
                      if (batchDealIds.includes(expectedDealId)) {
                        console.log(`🎯 [DEBUG] Deal-contact API response for batch including deal ${expectedDealId}:`, JSON.stringify(dealContactData, null, 2));
                      }
                      
                      for (const result of dealContactData.results) {
                        // 🔍 DEBUG: Log processing for our expected deal
                        if (result.from.id === expectedDealId) {
                          console.log(`🎯 [DEBUG] Processing deal-contact result for deal ${expectedDealId}:`, JSON.stringify(result, null, 2));
                        }
                        
                        if (result.to && result.to.length > 0) {
                          // If multiple contacts, select the oldest one
                          if (result.to.length > 1) {
                            console.log(`📝 Deal ${result.from.id} has ${result.to.length} associated contacts, selecting oldest...`);
                          }
                          dealContactMap[result.from.id] = result.to[0].toObjectId; // For now, take first - we'll sort by createdate later
                          
                          // 🔍 DEBUG: Log contact mapping for our expected deal
                          if (result.from.id === expectedDealId) {
                            console.log(`🎯 [DEBUG] Successfully mapped deal ${expectedDealId} to contact ${result.to[0].toObjectId}`);
                          }
                        } else {
                          // 🔍 DEBUG: Log no contacts found for our expected deal
                          if (result.from.id === expectedDealId) {
                            console.log(`🎯 [DEBUG] No contacts found for deal ${expectedDealId}`);
                          }
                        }
                      }
                    } else {
                      console.warn(`Failed to fetch deal-contact associations batch: ${dealContactResponse.status}`);
                      // Log the error response body for debugging
                      try {
                        const errorBody = await dealContactResponse.text();
                        console.warn(`Deal-contact association error body:`, errorBody);
                        console.warn(`Request was for deal IDs:`, batchDealIds);
                      } catch (e) {
                        console.warn('Could not read error response body');
                      }
                    }
                  } catch (error) {
                    console.warn('Error fetching deal-contact association batch:', error);
                  }

                  await new Promise(resolve => setTimeout(resolve, 300));
                }
                
                console.log(`🔗 Found ${Object.keys(dealContactMap).length} deal-contact associations`);
                
                // 🔍 DEBUG: Log the dealContactMap state
                console.log(`🎯 [DEBUG] dealContactMap:`, dealContactMap);
                
                // Now resolve the full task -> deal -> contact chain ONLY for tasks without direct contact associations
                let resolvedTaskContacts = 0;
                for (const [taskId, dealId] of Object.entries(taskDealMap)) {
                  // Only enhance contact associations for tasks that don't already have direct contact associations
                  if (!taskContactMap[taskId]) {
                    const contactId = dealContactMap[dealId];
                    if (contactId) {
                      finalTaskContactMap[taskId] = contactId;
                      resolvedTaskContacts++;
                      
                      // 🔍 DEBUG: Log resolution for our target task
                      if (taskId === debugTaskId) {
                        console.log(`🎯 [DEBUG] Successfully resolved contact for task ${debugTaskId}: ${contactId} via deal ${dealId}`);
                      }
                    } else {
                      // 🔍 DEBUG: Log failed resolution for our target task
                      if (taskId === debugTaskId) {
                        console.log(`🎯 [DEBUG] FAILED to resolve contact for task ${debugTaskId}: dealContactMap[${dealId}] = ${dealContactMap[dealId]}`);
                      }
                    }
                  } else {
                    // 🔍 DEBUG: Log that task already has direct contact
                    if (taskId === debugTaskId) {
                      console.log(`🎯 [DEBUG] Task ${debugTaskId} already has direct contact association: ${taskContactMap[taskId]}`);
                    }
                  }
                }
                
                // 🔍 DEBUG: Final state for our target task
                if (finalTaskContactMap[debugTaskId]) {
                  console.log(`🎯 [DEBUG] Final contact resolution for task ${debugTaskId}: ${finalTaskContactMap[debugTaskId]}`);
                } else {
                  console.log(`🎯 [DEBUG] FINAL FAILURE - Task ${debugTaskId} has NO contact in finalTaskContactMap`);
                }
                
                console.log(`✅ Resolved ${resolvedTaskContacts} additional task-contact relationships via deals`);
                
                  // Create missing task-contact associations in HubSpot (only for tasks that don't already have direct contact associations)
                  if (resolvedTaskContacts > 0) {
                    sendOperationUpdate('creating-associations', 'running', `Creating ${resolvedTaskContacts} missing task-contact associations in HubSpot...`);
                    
                    const associationsToCreate = [];
                    for (const [taskId, dealId] of Object.entries(taskDealMap)) {
                      // Only create associations for tasks that don't already have direct contact associations
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
                  
                  // Create associations in batches of 100 (HubSpot limit)
                  const createBatchSize = 100;
                  let createdAssociations = 0;
                  
                  for (let i = 0; i < associationsToCreate.length; i += createBatchSize) {
                    const batchAssociations = associationsToCreate.slice(i, i + createBatchSize);
                    console.log(`🔗 Creating task-contact associations batch ${Math.floor(i / createBatchSize) + 1}/${Math.ceil(associationsToCreate.length / createBatchSize)} (${batchAssociations.length} associations)...`);

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

                      if (createResponse.ok) {
                        const createData = await createResponse.json();
                        createdAssociations += createData.results ? createData.results.length : batchAssociations.length;
                        console.log(`✅ Successfully created ${batchAssociations.length} task-contact associations in HubSpot`);
                      } else {
                        console.warn(`Failed to create task-contact associations batch: ${createResponse.status}`);
                        const errorText = await createResponse.text();
                        console.warn('Create association error:', errorText);
                      }
                    } catch (error) {
                      console.warn('Error creating task-contact associations batch:', error);
                    }

                    await new Promise(resolve => setTimeout(resolve, 500)); // Longer delay for create operations
                  }
                  
                  console.log(`🎉 Created ${createdAssociations} new task-contact associations in HubSpot`);
                }
              }
            }
            
            // Extract unique contact IDs and fetch contact details (including newly resolved ones)
            const uniqueContactIds = [...new Set(Object.values(finalTaskContactMap))];
            console.log(`👥 Fetching details for ${uniqueContactIds.length} unique contacts (including ${Object.keys(finalTaskContactMap).length - Object.keys(taskContactMap).length} newly resolved)...`);
            
            sendOperationUpdate('contacts', 'running', `Fetching details for ${uniqueContactIds.length} contacts...`, uniqueContactIds.length);

            let allContacts: HubSpotContact[] = [];
            if (uniqueContactIds.length > 0) {
              // Fetch contact details in batches of 100
              const contactBatchSize = 100;
              for (let i = 0; i < uniqueContactIds.length; i += contactBatchSize) {
                const batchContactIds = uniqueContactIds.slice(i, i + contactBatchSize);
                
                console.log(`👤 Fetching contacts batch ${Math.floor(i / contactBatchSize) + 1}/${Math.ceil(uniqueContactIds.length / contactBatchSize)} (${batchContactIds.length} contacts)...`);

                try {
                  const contactResponse = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/batch/read', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${hubspotToken}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      inputs: batchContactIds.map(id => ({ id })),
                      properties: ['firstname', 'lastname', 'createdate', 'lastmodifieddate', 'mobilephone', 'ensol_source_group', 'hs_lead_status', 'lifecyclestage', 'hubspot_owner_id']
                    }),
                  });

                  if (contactResponse.ok) {
                    const contactData = await contactResponse.json();
                    allContacts = allContacts.concat(contactData.results);
                  } else {
                    console.warn(`Failed to fetch contacts batch: ${contactResponse.status}`);
                  }
                } catch (error) {
                  console.warn('Error fetching contact batch:', error);
                }

                // Update progress during contact fetching (65% to 75%)
                const contactProgress = Math.min(75, 65 + Math.floor(((i + contactBatchSize) / uniqueContactIds.length) * 10));
                sendOperationUpdate('contacts', 'running', `Fetched ${Math.min(i + contactBatchSize, uniqueContactIds.length)}/${uniqueContactIds.length} contacts...`);

                // Respect API rate limits
                await new Promise(resolve => setTimeout(resolve, 300));
              }
            }

            console.log(`👥 Total contacts fetched: ${allContacts.length}`);

            // For tasks with multiple associated contacts, select the oldest one
            const contactsById: { [id: string]: HubSpotContact } = {};
            allContacts.forEach(contact => {
              contactsById[contact.id] = contact;
            });

            // Use the finalTaskContactMap that was already populated earlier with task-contact associations
            console.log('🔍 Using task-contact associations (including those resolved via deals)...');

            // Insert contacts into database
            sendOperationUpdate('database', 'running', `Inserting ${allContacts.length} contacts into database...`);

            if (allContacts.length > 0) {
              console.log('💾 Inserting contacts into database...');
              
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
              
              const transformedContacts = allContacts.map(contact => ({
                hs_object_id: contact.id,
                firstname: contact.properties.firstname || null,
                lastname: contact.properties.lastname || null,
                mobilephone: contact.properties.mobilephone || null,
                ensol_source_group: contact.properties.ensol_source_group || null,
                hs_lead_status: contact.properties.hs_lead_status || null,
                lifecyclestage: contact.properties.lifecyclestage || null,
                createdate: parseContactTimestamp(contact.properties.createdate),
                lastmodifieddate: parseContactTimestamp(contact.properties.lastmodifieddate),
                hubspot_owner_id: contact.properties.hubspot_owner_id || null,
              }));

              const { error: contactInsertError } = await supabase
                .from('hs_contacts')
                .insert(transformedContacts);

              if (contactInsertError) {
                console.error('Error inserting contacts:', contactInsertError);
                // Don't fail the entire sync for contact insertion errors
                console.warn('Continuing with task insertion despite contact error...');
              } else {
                console.log(`✅ Inserted ${allContacts.length} contacts successfully`);
              }
            }

            sendOperationUpdate('database', 'running', `Inserting ${allTasks.length} tasks into database...`, allTasks.length);

            if (allTasks.length === 0) {
              console.log('⚠️ No tasks found to sync');
              sendOperationUpdate('database', 'complete', 'No tasks found to sync', 0);
              controller.close();
              return;
            }

            console.log('💾 Inserting tasks into database...');

            // Transform and insert tasks in batches
            const batchSize = 100;
            let insertedCount = 0;

            // Filter out orphan tasks (those with no contact, deal, or company associations)
            console.log('🔍 Filtering out orphan tasks...');
            const tasksWithAssociations = allTasks.filter(task => {
              const hasContact = finalTaskContactMap[task.id];
              const hasDeal = taskDealMap[task.id];
              const hasCompany = taskCompanyMap[task.id];
              
              if (!hasContact && !hasDeal && !hasCompany) {
                console.log(`⚠️ Skipping orphan task ${task.id}: no contact, deal, or company associations`);
                return false;
              }
              
              return true;
            });
            
            console.log(`📊 Processing ${tasksWithAssociations.length} tasks with associations (${allTasks.length - tasksWithAssociations.length} orphan tasks skipped)`);
            
            for (let i = 0; i < tasksWithAssociations.length; i += batchSize) {
              const batch = tasksWithAssociations.slice(i, i + batchSize);
              
              console.log(`📝 Inserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(tasksWithAssociations.length / batchSize)} (${batch.length} records)...`);
              
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

              const transformedTasks = batch.map(task => ({
                hs_object_id: task.id,
                hs_body_preview: task.properties.hs_body_preview || null,
                hs_created_by_user_id: task.properties.hs_created_by_user_id || null,
                hs_createdate: parseTimestamp(task.properties.hs_createdate),
                hs_lastmodifieddate: parseTimestamp(task.properties.hs_lastmodifieddate),
                hs_timestamp: parseTimestamp(task.properties.hs_timestamp),
                hs_duration: task.properties.hs_duration || null,
                hs_queue_membership_ids: task.properties.hs_queue_membership_ids || null,
                hs_task_body: task.properties.hs_task_body || null,
                hs_task_completion_count: task.properties.hs_task_completion_count ? parseInt(task.properties.hs_task_completion_count) : null,
                hs_task_completion_date: parseTimestamp(task.properties.hs_task_completion_date),
                hs_task_for_object_type: task.properties.hs_task_for_object_type || null,
                hs_task_is_all_day: task.properties.hs_task_is_all_day ? task.properties.hs_task_is_all_day === 'true' : null,
                hs_task_is_overdue: task.properties.hs_task_is_overdue ? task.properties.hs_task_is_overdue === 'true' : null,
                hs_task_last_contact_outreach: parseTimestamp(task.properties.hs_task_last_contact_outreach),
                hs_task_priority: task.properties.hs_task_priority || null,
                hs_task_status: task.properties.hs_task_status || null,
                hs_task_subject: task.properties.hs_task_subject || null,
                hs_task_type: task.properties.hs_task_type || null,
                hs_updated_by_user_id: task.properties.hs_updated_by_user_id || null,
                hubspot_owner_assigneddate: parseTimestamp(task.properties.hubspot_owner_assigneddate),
                hubspot_owner_id: task.properties.hubspot_owner_id || null,
                hubspot_team_id: task.properties.hubspot_team_id || null,
                archived: task.archived || false,
                associated_contact_id: finalTaskContactMap[task.id] || null,
                associated_deal_id: taskDealMap[task.id] || null,
                associated_company_id: taskCompanyMap[task.id] || null,
              }));

              const { error: insertError } = await supabase
                .from('hs_tasks')
                .insert(transformedTasks);

              if (insertError) {
                console.error('Error inserting batch:', insertError);
                throw new Error(`Failed to insert batch: ${insertError.message}`);
              }

              insertedCount += batch.length;
              console.log(`✅ Inserted batch successfully. Total inserted: ${insertedCount}/${tasksWithAssociations.length}`);
              
              // Update progress during insertion (55% to 95%)
              const insertProgress = Math.min(95, 55 + Math.floor((insertedCount / tasksWithAssociations.length) * 40));
              sendOperationUpdate('database', 'running', `Inserted ${insertedCount}/${tasksWithAssociations.length} records...`);
            }

            console.log(`🎉 Sync completed successfully! Total records: ${insertedCount}`);
            console.log(`🚫 Orphan tasks skipped: ${allTasks.length - tasksWithAssociations.length}`);
            
            // Update sync metadata on successful completion
            const endTime = Date.now();
            const syncDuration = Math.round((endTime - startTime) / 1000); // Duration in seconds
            
            console.log(`🔄 Updating sync metadata - Duration: ${syncDuration}s, Tasks: ${insertedCount}`);
            
            const { error: metadataError } = await supabase
              .from('sync_metadata')
              .update({
                sync_type: 'full',
                last_sync_timestamp: new Date().toISOString(),
                last_sync_success: true,
                sync_duration: syncDuration,
                tasks_added: insertedCount,
                tasks_updated: 0, // Full sync doesn't track updates
                tasks_deleted: 0, // We clear and repopulate, so not applicable
                error_message: null,
                updated_at: new Date().toISOString()
              })
              .single();

            if (metadataError) {
              console.error('⚠️ Failed to update sync metadata:', metadataError);
              // Don't fail the entire sync for metadata update issues
            } else {
              console.log('✅ Sync metadata updated successfully');
            }
            
            sendOperationUpdate('database', 'complete', `Successfully synced ${insertedCount} records (${allTasks.length - tasksWithAssociations.length} orphans skipped)`, insertedCount);

            controller.close();
          } catch (error) {
            console.error('Error in sync-hubspot-tasks function:', error);
            
            // Update sync metadata on failure
            const endTime = Date.now();
            const syncDuration = Math.round((endTime - startTime) / 1000);
            
            const { error: metadataError } = await supabase
              .from('sync_metadata')
              .update({
                sync_type: 'full',
                last_sync_timestamp: new Date().toISOString(),
                last_sync_success: false,
                sync_duration: syncDuration,
                error_message: (error as Error)?.message || 'Unknown error',
                updated_at: new Date().toISOString()
              })
              .single();

            if (metadataError) {
              console.error('⚠️ Failed to update sync metadata on error:', metadataError);
            }
            
            const errorOperations = [
              { id: 'tasks', name: 'Fetching Tasks', status: 'error' },
              { id: 'associations', name: 'Task Associations', status: 'error' },
              { id: 'contacts', name: 'Fetching Contacts', status: 'error' },
              { id: 'database', name: 'Writing to Database', status: 'error' }
            ];
            sendEvent({ 
              phase: 'error', 
              operations: errorOperations, 
              message: 'Sync failed', 
              error: (error as Error)?.message || 'Unknown error occurred'
            });
            controller.close();
          }
        })();
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Error in sync-hubspot-tasks function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error)?.message || 'Unknown error occurred',
        totalRecords: 0
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});