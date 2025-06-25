
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface HubSpotTask {
  id: string;
  properties: {
    hs_task_subject?: string;
    hs_body_preview?: string;
    hs_task_status?: string;
    hs_task_priority?: string;
    hs_task_type?: string;
    hs_timestamp?: string;
    hubspot_owner_id?: string;
    hs_queue_membership_ids?: string;
    hs_lastmodifieddate?: string;
    hs_task_completion_date?: string;
  };
}

interface HubSpotOwner {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  teams?: Array<{ id: string }>;
}

// Helper function to get Paris time from UTC timestamp
function getParisTimeFromUTC(utcTimestamp: number): Date {
  const utcDate = new Date(utcTimestamp);
  return new Date(utcDate.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
}

// Helper function to get current time in Paris
function getCurrentParisTime(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
}

// Helper function to add delays between API calls
async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAllPages(url: string, requestBody: any, hubspotToken: string, initialDelay = 0): Promise<HubSpotTask[]> {
  let allResults: HubSpotTask[] = [];
  let after = undefined;
  let hasMore = true;
  let pageCount = 0;

  if (initialDelay > 0) {
    await delay(initialDelay);
  }

  while (hasMore) {
    pageCount++;
    console.log(`Fetching page ${pageCount}...`);

    const paginatedBody = {
      ...requestBody,
      limit: 100,
      ...(after && { after })
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hubspotToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paginatedBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`HubSpot API error on page ${pageCount}: ${response.status} - ${errorText}`);
      throw new Error(`HubSpot API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const results = data.results || [];
    allResults = allResults.concat(results);

    hasMore = data.paging && data.paging.next && data.paging.next.after;
    after = hasMore ? data.paging.next.after : undefined;

    console.log(`Page ${pageCount} fetched: ${results.length} results. Total so far: ${allResults.length}`);

    if (hasMore) {
      await delay(300);
    }
  }

  console.log(`Completed pagination: ${pageCount} pages, ${allResults.length} total results`);
  return allResults;
}

async function getGlobalLastSyncTimestamp(supabase: any): Promise<string> {
  const { data, error } = await supabase
    .from('sync_metadata')
    .select('last_sync_timestamp')
    .order('last_sync_timestamp', { ascending: false })
    .limit(1);

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching global last sync timestamp:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    console.log('First global sync, using epoch timestamp');
    return '0';
  }

  const timestamp = new Date(data[0].last_sync_timestamp).getTime();
  console.log(`Global last sync: ${data[0].last_sync_timestamp} (${timestamp})`);
  return timestamp.toString();
}

async function updateGlobalSyncMetadata(supabase: any, ownerIds: string[], success: boolean, errorMessage?: string) {
  const updateData = ownerIds.map(ownerId => ({
    owner_id: ownerId,
    last_sync_timestamp: new Date().toISOString(),
    last_sync_success: success,
    error_message: errorMessage || null,
  }));

  const { error } = await supabase
    .from('sync_metadata')
    .upsert(updateData, { onConflict: 'owner_id' });

  if (error) {
    console.error('Error updating global sync metadata:', error);
  } else {
    console.log(`Updated sync metadata for ${ownerIds.length} owners: success=${success}`);
  }
}

async function fetchAllTasksForAllOwners(ownerIds: string[], hubspotToken: string, lastSyncTimestamp: string): Promise<HubSpotTask[]> {
  console.log(`Fetching ALL not_started tasks for ${ownerIds.length} owners since timestamp: ${lastSyncTimestamp}`);
  
  const filters = [
    {
      propertyName: 'hs_task_status',
      operator: 'EQ',
      value: 'NOT_STARTED'
    },
    {
      propertyName: 'hubspot_owner_id',
      operator: 'IN',
      values: ownerIds
    }
  ];

  // Add timestamp filter for incremental sync (only if not initial sync)
  if (lastSyncTimestamp !== '0') {
    filters.push({
      propertyName: 'hs_lastmodifieddate',
      operator: 'GT',
      value: lastSyncTimestamp
    });
    console.log(`Using incremental sync with timestamp filter: > ${lastSyncTimestamp}`);
  } else {
    console.log('Initial sync - fetching ALL not_started tasks for all owners');
  }

  const requestBody = {
    filterGroups: [{ filters }],
    properties: [
      'hs_task_subject',
      'hs_body_preview',
      'hs_task_status',
      'hs_task_priority',
      'hs_task_type',
      'hs_timestamp',
      'hubspot_owner_id',
      'hs_queue_membership_ids',
      'hs_lastmodifieddate',
      'hs_task_completion_date'
    ],
    sorts: [
      {
        propertyName: 'hs_lastmodifieddate',
        direction: 'ASCENDING'
      }
    ]
  };

  const results = await fetchAllPages(
    'https://api.hubapi.com/crm/v3/objects/tasks/search',
    requestBody,
    hubspotToken
  );

  console.log(`All owner tasks sync fetched: ${results.length} tasks`);
  return results;
}

async function fetchUnassignedNewTasks(hubspotToken: string): Promise<HubSpotTask[]> {
  console.log('Fetching unassigned New tasks...');
  
  const requestBody = {
    filterGroups: [
      {
        filters: [
          {
            propertyName: 'hs_task_status',
            operator: 'EQ',
            value: 'NOT_STARTED'
          },
          {
            propertyName: 'hs_queue_membership_ids',
            operator: 'CONTAINS_TOKEN',
            value: '22859489'
          },
          {
            propertyName: 'hubspot_owner_id',
            operator: 'NOT_HAS_PROPERTY'
          }
        ]
      }
    ],
    properties: [
      'hs_task_subject',
      'hs_body_preview',
      'hs_task_status',
      'hs_task_priority',
      'hs_task_type',
      'hs_timestamp',
      'hubspot_owner_id',
      'hs_queue_membership_ids',
      'hs_lastmodifieddate',
      'hs_task_completion_date'
    ],
    sorts: [
      {
        propertyName: 'hs_timestamp',
        direction: 'ASCENDING'
      }
    ]
  };

  const results = await fetchAllPages(
    'https://api.hubapi.com/crm/v3/objects/tasks/search',
    requestBody,
    hubspotToken
  );

  console.log('Unassigned New tasks fetched:', results.length);
  return results;
}

async function fetchCompletedTasksForAllOwners(ownerIds: string[], hubspotToken: string): Promise<HubSpotTask[]> {
  console.log(`Fetching completed tasks for ${ownerIds.length} owners`);
  
  const requestBody = {
    filterGroups: [
      {
        filters: [
          {
            propertyName: 'hs_task_status',
            operator: 'EQ',
            value: 'COMPLETED'
          },
          {
            propertyName: 'hubspot_owner_id',
            operator: 'IN',
            values: ownerIds
          }
        ]
      }
    ],
    properties: [
      'hs_task_subject',
      'hs_body_preview',
      'hs_task_status',
      'hs_task_priority',
      'hs_task_type',
      'hs_timestamp',
      'hubspot_owner_id',
      'hs_queue_membership_ids',
      'hs_lastmodifieddate',
      'hs_task_completion_date'
    ],
    sorts: [
      {
        propertyName: 'hs_lastmodifieddate',
        direction: 'DESCENDING'
      }
    ]
  };

  const results = await fetchAllPages(
    'https://api.hubapi.com/crm/v3/objects/tasks/search',
    requestBody,
    hubspotToken,
    300
  );

  console.log('Completed tasks fetched for all owners:', results.length);
  return results;
}

async function fetchTaskAssociations(taskIds: string[], hubspotToken: string) {
  let taskContactMap: { [key: string]: string } = {}
  
  if (taskIds.length > 0) {
    await delay(300);
    
    const batchSize = 100;
    console.log(`Fetching task associations for ${taskIds.length} tasks in batches of ${batchSize}...`);

    for (let i = 0; i < taskIds.length; i += batchSize) {
      const batch = taskIds.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(taskIds.length / batchSize);
      
      console.log(`Fetching associations batch ${batchNumber}/${totalBatches} (${batch.length} tasks)...`);

      if (i > 0) {
        await delay(200);
      }

      const associationsResponse = await fetch(
        `https://api.hubapi.com/crm/v4/associations/tasks/contacts/batch/read`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${hubspotToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: batch.map(id => ({ id }))
          })
        }
      );

      if (associationsResponse.ok) {
        const associationsData = await associationsResponse.json();
        console.log(`Associations batch ${batchNumber} fetched successfully`);
        
        associationsData.results?.forEach((result: any) => {
          if (result.to && result.to.length > 0) {
            taskContactMap[result.from.id] = result.to[0].toObjectId
          }
        });
      } else {
        console.error(`Failed to fetch associations batch ${batchNumber}:`, await associationsResponse.text());
      }
    }

    console.log(`Total task-contact associations fetched: ${Object.keys(taskContactMap).length}`);
  }

  return taskContactMap;
}

async function fetchContactDetails(contactIds: Set<string>, hubspotToken: string) {
  let contacts = {}
  if (contactIds.size > 0) {
    console.log('Fetching contact details for', contactIds.size, 'contacts')
    
    await delay(300);
    
    const contactIdsArray = Array.from(contactIds)
    const batchSize = 100
    
    for (let i = 0; i < contactIdsArray.length; i += batchSize) {
      const batch = contactIdsArray.slice(i, i + batchSize)
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(contactIdsArray.length / batchSize);
      
      console.log(`Fetching contacts batch ${batchNumber}/${totalBatches} (${batch.length} contacts)...`);
      
      if (i > 0) {
        await delay(200);
      }
      
      const contactsResponse = await fetch(
        `https://api.hubapi.com/crm/v3/objects/contacts/batch/read`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${hubspotToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: batch.map(id => ({ id })),
            properties: ['firstname', 'lastname', 'email', 'company', 'hs_object_id', 'mobilephone']
          })
        }
      )

      if (contactsResponse.ok) {
        const contactsData = await contactsResponse.json()
        
        const batchContacts = contactsData.results?.reduce((acc: any, contact: any) => {
          acc[contact.id] = contact
          return acc
        }, {}) || {}
        
        contacts = { ...contacts, ...batchContacts }
        console.log(`Contacts batch ${batchNumber} fetched: ${Object.keys(batchContacts).length} contacts`);
      } else {
        console.error(`Failed to fetch contact batch ${batchNumber}:`, await contactsResponse.text())
      }
    }
    
    console.log('Total contacts fetched:', Object.keys(contacts).length)
  }

  return contacts
}

async function fetchValidOwners(hubspotToken: string) {
  console.log('Fetching specific allowed owners from HubSpot...')
  
  await delay(300);
  
  const allOwnersResponse = await fetch(
    `https://api.hubapi.com/crm/v3/owners`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${hubspotToken}`,
        'Content-Type': 'application/json',
      }
    }
  )

  let validOwnerIds = new Set<string>()
  let ownersMap = {}
  
  if (allOwnersResponse.ok) {
    const allOwnersData = await allOwnersResponse.json()
    console.log('Owners fetched successfully:', allOwnersData.results?.length || 0)
    
    // Define the specific users we want to include
    const allowedOwnerNames = [
      'Benjamin Rivet',
      'Thomas Bertiaux', 
      'Marine Fessart',
      'Gauthier Bonder',
      'Lucas Grenier',
      'Marvin Luksenberg'
    ]
    
    const validOwners = allOwnersData.results?.filter((owner: HubSpotOwner) => {
      const firstName = owner.firstName || ''
      const lastName = owner.lastName || ''
      const fullName = `${firstName} ${lastName}`.trim()
      
      const isAllowed = allowedOwnerNames.includes(fullName)
      if (isAllowed) {
        validOwnerIds.add(owner.id.toString())
        console.log(`✅ ALLOWED OWNER: ${fullName} (ID: ${owner.id})`)
      }
      return isAllowed
    }) || []

    console.log(`Valid owners (specific allowed users): ${validOwners.length}`)
    
    ownersMap = validOwners.reduce((acc: any, owner: HubSpotOwner) => {
      acc[owner.id] = owner
      return acc
    }, {}) || {}
  } else {
    console.error('Failed to fetch owners:', await allOwnersResponse.text())
  }

  return { validOwnerIds, ownersMap }
}

function transformTasks(tasks: HubSpotTask[], taskContactMap: { [key: string]: string }, contacts: any, ownersMap: any) {
  console.log(`Transforming ${tasks.length} tasks...`);

  return tasks.map((task: HubSpotTask) => {
    const props = task.properties;

    const contactId = taskContactMap[task.id] || null;
    const contact = contactId ? contacts[contactId] : null;

    let contactName = 'No Contact';
    let contactPhone = null;
    if (contact && contact.properties) {
      const contactProps = contact.properties;
      const firstName = contactProps.firstname || '';
      const lastName = contactProps.lastname || '';
      const email = contactProps.email || '';
      const company = contactProps.company || '';
      contactPhone = contactProps.mobilephone || null;

      if (firstName && lastName) {
        contactName = `${firstName} ${lastName}`.trim();
      } else if (firstName) {
        contactName = firstName;
      } else if (lastName) {
        contactName = lastName;
      } else if (email) {
        contactName = email;
      } else if (company) {
        contactName = company;
      } else {
        contactName = `Contact ${contactId}`;
      }
    }

    let dueDate = '';
    let taskDueDate = null;
    if (props.hs_timestamp) {
      const utcDate = new Date(props.hs_timestamp);
      taskDueDate = getParisTimeFromUTC(utcDate.getTime());

      const day = taskDueDate.getDate().toString().padStart(2, '0');
      const month = (taskDueDate.getMonth() + 1).toString().padStart(2, '0');
      const hours = taskDueDate.getHours().toString().padStart(2, '0');
      const minutes = taskDueDate.getMinutes().toString().padStart(2, '0');
      dueDate = `${day}/${month} à ${hours}:${minutes}`;
    }

    const priorityMap: { [key: string]: string } = {
      'HIGH': 'high',
      'MEDIUM': 'medium',
      'LOW': 'low'
    };

    const taskOwnerId = props.hubspot_owner_id;
    const owner = taskOwnerId ? ownersMap[taskOwnerId] : null;
    const ownerName = owner
      ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.email || 'Unknown Owner'
      : 'Unassigned';

    let queue = 'other';
    const queueIds = props.hs_queue_membership_ids ? props.hs_queue_membership_ids.split(';') : [];

    if (queueIds.includes('22933271')) {
      queue = 'rappels';
    } else if (queueIds.includes('22859489')) {
      queue = 'new';
    } else if (queueIds.includes('22859490')) {
      queue = 'attempted';
    }

    const isCompleted = props.hs_task_status === 'COMPLETED';
    const status = isCompleted ? 'completed' : 'not_started';

    return {
      id: task.id,
      title: props.hs_task_subject || 'Untitled Task',
      description: props.hs_body_preview || undefined,
      contact: contactName,
      contactId: contactId || null,
      contactPhone: contactPhone,
      status: status,
      dueDate,
      taskDueDate,
      priority: priorityMap[props.hs_task_priority] || 'medium',
      owner: ownerName,
      hubspotId: task.id,
      queue: queue,
      queueIds: queueIds,
      isUnassigned: !taskOwnerId,
      completionDate: props.hs_task_completion_date ? new Date(parseInt(props.hs_task_completion_date)) : null,
      hs_lastmodifieddate: props.hs_lastmodifieddate ? new Date(props.hs_lastmodifieddate) : new Date()
    };
  });
}

async function syncTasksToDatabase(supabase: any, transformedTasks: any[]) {
  console.log(`Syncing ${transformedTasks.length} tasks to database...`);

  if (transformedTasks.length === 0) {
    console.log('No tasks to sync');
    return;
  }

  // Prepare tasks for database insertion
  const tasksForDB = transformedTasks.map(task => ({
    id: task.id,
    title: task.title,
    description: task.description,
    contact: task.contact,
    contact_id: task.contactId,
    contact_phone: task.contactPhone,
    status: task.status,
    due_date: task.dueDate,
    priority: task.priority,
    owner: task.owner,
    hubspot_id: task.hubspotId,
    queue: task.queue,
    queue_ids: task.queueIds,
    is_unassigned: task.isUnassigned,
    completion_date: task.completionDate?.toISOString(),
    hs_lastmodifieddate: task.hs_lastmodifieddate.toISOString()
  }));

  // Upsert tasks (insert or update if exists)
  const { error } = await supabase
    .from('tasks')
    .upsert(tasksForDB, { onConflict: 'id' });

  if (error) {
    console.error('Error syncing tasks to database:', error);
    throw error;
  }

  console.log(`Successfully synced ${tasksForDB.length} tasks to database`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('=== BACKGROUND SYNC START ===')
    console.log('Timestamp:', new Date().toISOString())
    
    const hubspotToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN')
    
    if (!hubspotToken) {
      console.error('HubSpot access token not found in environment variables')
      throw new Error('HubSpot access token not configured. Please check your environment variables.')
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get valid owners (our 6 specific users)
    const { validOwnerIds, ownersMap } = await fetchValidOwners(hubspotToken);
    const ownerIdsArray = Array.from(validOwnerIds);
    
    if (ownerIdsArray.length === 0) {
      console.log('No valid owners found - skipping sync');
      return new Response(
        JSON.stringify({ 
          message: 'No valid owners found',
          success: true
        }),
        { 
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    console.log(`Found ${ownerIdsArray.length} valid owners for sync`);

    // Get the last sync timestamp across all owners
    const lastSyncTimestamp = await getGlobalLastSyncTimestamp(supabase);

    try {
      // Fetch all task types - removed the filtering logic that was preventing tasks from being fetched
      const ownerTasks = await fetchAllTasksForAllOwners(ownerIdsArray, hubspotToken, lastSyncTimestamp);
      const unassignedTasks = await fetchUnassignedNewTasks(hubspotToken);
      const completedTasks = await fetchCompletedTasksForAllOwners(ownerIdsArray, hubspotToken);
      
      // Combine all tasks and remove duplicates
      const allTasks = [...ownerTasks, ...unassignedTasks, ...completedTasks];
      const uniqueTasks = allTasks.filter((task, index, arr) => 
        arr.findIndex(t => t.id === task.id) === index
      );
      
      console.log(`Combined unique tasks: ${uniqueTasks.length} (${ownerTasks.length} owner tasks + ${unassignedTasks.length} unassigned + ${completedTasks.length} completed)`);
      
      if (uniqueTasks.length > 0) {
        // Process tasks (associations, contacts, validation) - removed the contact requirement filter
        const taskIds = uniqueTasks.map((task: HubSpotTask) => task.id);
        const taskContactMap = await fetchTaskAssociations(taskIds, hubspotToken);
        
        const contactIds = new Set(Object.values(taskContactMap));
        const contacts = await fetchContactDetails(contactIds, hubspotToken);
        
        const transformedTasks = transformTasks(uniqueTasks, taskContactMap, contacts, ownersMap);
        
        // Sync to database
        await syncTasksToDatabase(supabase, transformedTasks);
        
        console.log(`✅ Background sync completed: ${transformedTasks.length} tasks processed`);
      } else {
        console.log('No new tasks to process in background sync');
      }
      
      // Update sync metadata for all owners
      await updateGlobalSyncMetadata(supabase, ownerIdsArray, true);
      
      return new Response(
        JSON.stringify({ 
          message: 'Background sync completed successfully',
          tasksProcessed: uniqueTasks.length,
          success: true,
          timestamp: new Date().toISOString()
        }),
        { 
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json' 
          } 
        }
      );
      
    } catch (error) {
      console.error('Error in background sync:', error);
      await updateGlobalSyncMetadata(supabase, ownerIdsArray, false, error.message);
      throw error;
    }

  } catch (error) {
    console.error('Error in background-task-sync function:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error occurred',
        success: false,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})
