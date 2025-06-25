import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TaskFilterParams {
  ownerId?: string;
  hubspotToken: string;
  forceFullSync?: boolean;
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

async function getLastSyncTimestamp(supabase: any, ownerId: string): Promise<string> {
  const { data, error } = await supabase
    .from('sync_metadata')
    .select('last_sync_timestamp')
    .eq('owner_id', ownerId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
    console.error('Error fetching last sync timestamp:', error);
    throw error;
  }

  if (!data) {
    // First sync for this owner, return epoch
    console.log(`First sync for owner ${ownerId}, using epoch timestamp`);
    return '0';
  }

  const timestamp = new Date(data.last_sync_timestamp).getTime();
  console.log(`Last sync for owner ${ownerId}: ${data.last_sync_timestamp} (${timestamp})`);
  return timestamp.toString();
}

async function updateSyncMetadata(supabase: any, ownerId: string, success: boolean, errorMessage?: string) {
  const updateData = {
    owner_id: ownerId,
    last_sync_timestamp: new Date().toISOString(),
    last_sync_success: success,
    error_message: errorMessage || null,
  };

  const { error } = await supabase
    .from('sync_metadata')
    .upsert(updateData, { onConflict: 'owner_id' });

  if (error) {
    console.error('Error updating sync metadata:', error);
  } else {
    console.log(`Updated sync metadata for owner ${ownerId}: success=${success}`);
  }
}

async function fetchIncrementalTasks(ownerId: string, hubspotToken: string, lastSyncTimestamp: string, forceFullSync = false): Promise<HubSpotTask[]> {
  console.log(`Fetching ${forceFullSync ? 'full' : 'incremental'} tasks for owner: ${ownerId}`);
  
  const baseFilters = [
    {
      propertyName: 'hubspot_owner_id',
      operator: 'EQ',
      value: ownerId
    }
  ];

  // Add timestamp filter for incremental sync
  if (!forceFullSync && lastSyncTimestamp !== '0') {
    baseFilters.push({
      propertyName: 'hs_lastmodifieddate',
      operator: 'GT',
      value: lastSyncTimestamp
    });
    console.log(`Using incremental sync with timestamp filter: > ${lastSyncTimestamp}`);
  }

  const requestBody = {
    filterGroups: [{ filters: baseFilters }],
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

  console.log(`${forceFullSync ? 'Full' : 'Incremental'} sync fetched: ${results.length} tasks`);
  return results;
}

async function fetchRappelsRdvTasks(ownerId: string, hubspotToken: string): Promise<HubSpotTask[]> {
  console.log('Fetching Rappels & RDV tasks for owner:', ownerId);
  
  const nowParis = getCurrentParisTime();
  const oneHourFromNowParis = new Date(nowParis.getTime() + (60 * 60 * 1000));
  const oneHourFromNowUTC = new Date(oneHourFromNowParis.toLocaleString("en-US", { timeZone: "UTC" }));
  const oneHourFromNowTimestamp = oneHourFromNowUTC.getTime();

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
            value: '22933271'
          },
          {
            propertyName: 'hubspot_owner_id',
            operator: 'EQ',
            value: ownerId
          },
          {
            propertyName: 'hs_timestamp',
            operator: 'LTE',
            value: oneHourFromNowTimestamp.toString()
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
    hubspotToken,
    300
  );

  console.log('Rappels & RDV tasks fetched:', results.length);
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
  console.log('Fetching filtered owners from HubSpot...')
  
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
    
    const allowedTeamIds = ['162028741', '135903065']
    const validOwners = allOwnersData.results?.filter((owner: HubSpotOwner) => {
      const ownerTeams = owner.teams || []
      const hasAllowedTeam = ownerTeams.some((team: any) => {
        const teamIdString = team.id?.toString()
        return allowedTeamIds.includes(teamIdString)
      })
      if (hasAllowedTeam) {
        validOwnerIds.add(owner.id.toString())
      }
      return hasAllowedTeam
    }) || []

    console.log(`Valid owners (in allowed teams): ${validOwners.length}`)
    
    ownersMap = validOwners.reduce((acc: any, owner: HubSpotOwner) => {
      acc[owner.id] = owner
      return acc
    }, {}) || {}
  } else {
    console.error('Failed to fetch owners:', await allOwnersResponse.text())
  }

  return { validOwnerIds, ownersMap }
}

function filterTasksByValidOwners(tasks: HubSpotTask[], validOwnerIds: Set<string>) {
  const tasksWithAllowedOwners = tasks.filter((task: HubSpotTask) => {
    const taskOwnerId = task.properties?.hubspot_owner_id;
    
    if (!taskOwnerId) {
      return true;
    }
    
    if (validOwnerIds.has(taskOwnerId.toString())) {
      return true;
    } else {
      console.log(`❌ DROPPED: Task ${task.id} ownerId ${taskOwnerId} not in allowed teams`);
      return false;
    }
  });

  console.log(`Filtered tasks with allowed owners: ${tasksWithAllowedOwners.length} out of ${tasks.length}`);
  return tasksWithAllowedOwners;
}

function transformTasks(tasks: HubSpotTask[], taskContactMap: { [key: string]: string }, contacts: any, ownersMap: any) {
  const currentParisTime = getCurrentParisTime();

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
  }).filter((task: any) => {
    if (task.status === 'completed') {
      return true;
    }
    
    if (task.queue === 'rappels') {
      return true;
    }
    
    if (!task.taskDueDate) return false;
    const isOverdue = task.taskDueDate < currentParisTime;
    return isOverdue;
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

async function getTasksFromDatabase(supabase: any, ownerId?: string) {
  console.log(`Fetching tasks from database${ownerId ? ` for owner ${ownerId}` : ''}...`);

  let query = supabase.from('tasks').select('*');
  
  if (ownerId) {
    // Get tasks that are either assigned to this owner or unassigned new tasks
    query = query.or(`owner.eq.${ownerId},and(queue.eq.new,is_unassigned.eq.true)`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching tasks from database:', error);
    throw error;
  }

  console.log(`Fetched ${data?.length || 0} tasks from database`);
  return data || [];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Starting HubSpot tasks fetch with incremental sync...')
    
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

    let ownerId = null
    let forceFullSync = false
    try {
      const body = await req.json()
      ownerId = body?.ownerId
      forceFullSync = body?.forceFullSync || false
    } catch (e) {
      // No body or invalid JSON, continue without owner filter
    }

    // Try to get tasks from database first
    let shouldFetchFromAPI = true;
    let cachedTasks = [];

    if (ownerId && !forceFullSync) {
      try {
        cachedTasks = await getTasksFromDatabase(supabase, ownerId);
        
        // Check if we have recent data (less than 5 minutes old)
        if (cachedTasks.length > 0) {
          const oldestTask = cachedTasks.reduce((oldest, current) => 
            new Date(oldest.updated_at) < new Date(current.updated_at) ? oldest : current
          );
          const lastUpdate = new Date(oldestTask.updated_at);
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          
          if (lastUpdate > fiveMinutesAgo) {
            console.log('Using cached data (less than 5 minutes old)');
            shouldFetchFromAPI = false;
          }
        }
      } catch (error) {
        console.log('Could not fetch from database, falling back to API:', error);
      }
    }

    if (shouldFetchFromAPI) {
      console.log('Fetching fresh data from HubSpot API...');
      
      try {
        // Get last sync timestamp for incremental sync
        const lastSyncTimestamp = ownerId ? await getLastSyncTimestamp(supabase, ownerId) : '0';
        
        // Fetch tasks using incremental sync
        const ownerTasks = ownerId ? await fetchIncrementalTasks(ownerId, hubspotToken, lastSyncTimestamp, forceFullSync) : [];
        
        // Always fetch unassigned new tasks and rappels (these are shared across users)
        const unassignedTasks = await fetchUnassignedNewTasks(hubspotToken);
        const rappelsTasks = ownerId ? await fetchRappelsRdvTasks(ownerId, hubspotToken) : [];
        
        // Combine all tasks
        const allTasks = [...ownerTasks, ...unassignedTasks, ...rappelsTasks];
        const uniqueTasks = allTasks.filter((task, index, arr) => 
          arr.findIndex(t => t.id === task.id) === index
        );
        
        console.log(`Combined unique tasks: ${uniqueTasks.length}`);
        
        if (uniqueTasks.length > 0) {
          // Process tasks (associations, contacts, validation)
          const taskIds = uniqueTasks.map((task: HubSpotTask) => task.id);
          const taskContactMap = await fetchTaskAssociations(taskIds, hubspotToken);
          
          const filteredTasks = uniqueTasks.filter((task: HubSpotTask) => {
            const isCompleted = task.properties?.hs_task_status === 'COMPLETED';
            const hasContact = taskContactMap[task.id];
            return isCompleted || hasContact;
          });
          
          const contactIds = new Set(Object.values(taskContactMap));
          const contacts = await fetchContactDetails(contactIds, hubspotToken);
          const { validOwnerIds, ownersMap } = await fetchValidOwners(hubspotToken);
          
          const tasksWithAllowedOwners = filterTasksByValidOwners(filteredTasks, validOwnerIds);
          const transformedTasks = transformTasks(tasksWithAllowedOwners, taskContactMap, contacts, ownersMap);
          
          // Sync to database
          await syncTasksToDatabase(supabase, transformedTasks);
          
          // Update sync metadata
          if (ownerId) {
            await updateSyncMetadata(supabase, ownerId, true);
          }
          
          // Convert for API response (remove internal fields)
          const responseTasks = transformedTasks.map(({ taskDueDate, hs_lastmodifieddate, ...task }) => task);
          
          return new Response(
            JSON.stringify({ 
              tasks: responseTasks,
              total: responseTasks.length,
              success: true,
              source: 'api',
              sync_type: forceFullSync ? 'full' : 'incremental'
            }),
            { 
              headers: { 
                ...corsHeaders,
                'Content-Type': 'application/json' 
              } 
            }
          );
        } else {
          console.log('No new tasks to process');
          
          // Still get cached data for response
          cachedTasks = ownerId ? await getTasksFromDatabase(supabase, ownerId) : [];
        }
        
        if (ownerId) {
          await updateSyncMetadata(supabase, ownerId, true);
        }
      } catch (error) {
        console.error('Error in API sync:', error);
        
        if (ownerId) {
          await updateSyncMetadata(supabase, ownerId, false, error.message);
        }
        
        // Try to return cached data as fallback
        try {
          cachedTasks = ownerId ? await getTasksFromDatabase(supabase, ownerId) : [];
          console.log('Using cached data as fallback after API error');
        } catch (dbError) {
          console.error('Could not fetch cached data either:', dbError);
          throw error; // Re-throw original API error
        }
      }
    }

    // Return cached data
    const responseTasks = cachedTasks.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      contact: task.contact,
      contactId: task.contact_id,
      contactPhone: task.contact_phone,
      status: task.status,
      dueDate: task.due_date,
      priority: task.priority,
      owner: task.owner,
      hubspotId: task.hubspot_id,
      queue: task.queue,
      queueIds: task.queue_ids,
      isUnassigned: task.is_unassigned,
      completionDate: task.completion_date ? new Date(task.completion_date) : null
    }));

    return new Response(
      JSON.stringify({ 
        tasks: responseTasks,
        total: responseTasks.length,
        success: true,
        source: 'cache'
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error in fetch-hubspot-tasks function:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error occurred',
        tasks: [],
        total: 0,
        success: false
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
