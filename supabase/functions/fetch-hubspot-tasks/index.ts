import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TaskFilterParams {
  ownerId?: string;
  hubspotToken: string;
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

    // Add pagination to the request body
    const paginatedBody = {
      ...requestBody,
      limit: 100, // Use standard page size
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

    // Check if there are more pages
    hasMore = data.paging && data.paging.next && data.paging.next.after;
    after = hasMore ? data.paging.next.after : undefined;

    console.log(`Page ${pageCount} fetched: ${results.length} results. Total so far: ${allResults.length}`);

    // Add delay between pages to avoid rate limiting (except for the last iteration)
    if (hasMore) {
      await delay(300);
    }
  }

  console.log(`Completed pagination: ${pageCount} pages, ${allResults.length} total results`);
  return allResults;
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

async function fetchOwnerTasks(ownerId: string, hubspotToken: string): Promise<HubSpotTask[]> {
  console.log('Fetching owner tasks for:', ownerId);
  
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
            propertyName: 'hubspot_owner_id',
            operator: 'EQ',
            value: ownerId
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
    300 // Initial delay before starting this call
  );

  console.log('Owner tasks fetched:', results.length);
  return results;
}

async function fetchCompletedTasksToday(ownerId: string, hubspotToken: string): Promise<HubSpotTask[]> {
  console.log('Fetching completed tasks for today for owner:', ownerId);
  
  // Get today's date in UTC (start and end of day)
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  
  const startTimestamp = startOfDay.getTime();
  const endTimestamp = endOfDay.getTime();
  
  console.log('Fetching completed tasks between:', startOfDay.toISOString(), 'and', endOfDay.toISOString());

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
            operator: 'EQ',
            value: ownerId
          },
          {
            propertyName: 'hs_task_completion_date',
            operator: 'GTE',
            value: startTimestamp.toString()
          },
          {
            propertyName: 'hs_task_completion_date',
            operator: 'LT',
            value: endTimestamp.toString()
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
        propertyName: 'hs_task_completion_date',
        direction: 'DESCENDING'
      }
    ]
  };

  const results = await fetchAllPages(
    'https://api.hubapi.com/crm/v3/objects/tasks/search',
    requestBody,
    hubspotToken,
    300 // Initial delay before starting this call
  );

  console.log('Completed tasks fetched:', results.length);
  return results;
}

async function fetchTasksFromHubSpot({ ownerId, hubspotToken }: TaskFilterParams) {
  console.log('Owner filter:', ownerId);
  console.log('Starting API calls with delays and pagination to retrieve all tasks...');

  // Always fetch unassigned "New" tasks first
  const unassignedTasks = await fetchUnassignedNewTasks(hubspotToken);
  
  let ownerTasks: HubSpotTask[] = [];
  let completedTasks: HubSpotTask[] = [];
  
  if (ownerId) {
    // Fetch owner tasks with delay and pagination
    ownerTasks = await fetchOwnerTasks(ownerId, hubspotToken);
    // Fetch completed tasks with delay and pagination
    completedTasks = await fetchCompletedTasksToday(ownerId, hubspotToken);
  }

  // Combine all tasks, removing any duplicates by ID
  const allTasks = [...unassignedTasks, ...completedTasks];
  const taskIds = new Set(unassignedTasks.map(task => task.id));
  
  // Add completed tasks (they shouldn't overlap with unassigned)
  completedTasks.forEach(task => {
    if (!taskIds.has(task.id)) {
      taskIds.add(task.id);
    }
  });
  
  // Add owner tasks
  ownerTasks.forEach(task => {
    if (!taskIds.has(task.id)) {
      allTasks.push(task);
      taskIds.add(task.id);
    }
  });

  console.log(`Combined tasks: ${allTasks.length} (${unassignedTasks.length} unassigned + ${ownerTasks.length} owner tasks + ${completedTasks.length} completed today)`);
  
  return allTasks;
}

async function fetchTaskAssociations(taskIds: string[], hubspotToken: string) {
  let taskContactMap: { [key: string]: string } = {}
  
  if (taskIds.length > 0) {
    // Add delay before associations call
    await delay(300);
    
    // Process associations in batches to handle large numbers of tasks
    const batchSize = 100;
    console.log(`Fetching task associations for ${taskIds.length} tasks in batches of ${batchSize}...`);

    for (let i = 0; i < taskIds.length; i += batchSize) {
      const batch = taskIds.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(taskIds.length / batchSize);
      
      console.log(`Fetching associations batch ${batchNumber}/${totalBatches} (${batch.length} tasks)...`);

      if (i > 0) {
        await delay(200); // Delay between batches
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
    
    // Add delay before contacts call
    await delay(300);
    
    const contactIdsArray = Array.from(contactIds)
    const batchSize = 100
    
    for (let i = 0; i < contactIdsArray.length; i += batchSize) {
      const batch = contactIdsArray.slice(i, i + batchSize)
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(contactIdsArray.length / batchSize);
      
      console.log(`Fetching contacts batch ${batchNumber}/${totalBatches} (${batch.length} contacts)...`);
      
      // Add delay between batches
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
  
  // Add delay before owners call
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
      
      if (hasAllowedTeam) {
        console.log(`✔️ INCLUDED OWNER: ${owner.id} (${owner.firstName || ''} ${owner.lastName || ''})`);
      } else {
        console.log(`❌ EXCLUDED OWNER: ${owner.id} (${owner.firstName || ''} ${owner.lastName || ''})`);
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
    
    // Allow unassigned tasks (no owner)
    if (!taskOwnerId) {
      console.log(`✔️ ALLOWED: Task ${task.id} has NO OWNER (unassigned)`);
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
  const currentDate = new Date()

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
      const date = new Date(props.hs_timestamp);
      taskDueDate = date;

      const parisDate = new Date(date.getTime() + (2 * 60 * 60 * 1000));
      const day = parisDate.getUTCDate().toString().padStart(2, '0');
      const month = (parisDate.getUTCMonth() + 1).toString().padStart(2, '0');
      const hours = parisDate.getUTCHours().toString().padStart(2, '0');
      const minutes = parisDate.getUTCMinutes().toString().padStart(2, '0');
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

    if (queueIds.includes('22859489')) {
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
      completionDate: props.hs_task_completion_date ? new Date(parseInt(props.hs_task_completion_date)) : null
    };
  }).filter((task: any) => {
    // For completed tasks, we don't need the overdue filter
    if (task.status === 'completed') {
      return true;
    }
    
    // For not started tasks, apply the overdue filter
    if (!task.taskDueDate) return false;
    const isOverdue = task.taskDueDate < currentDate;
    return isOverdue;
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Starting HubSpot tasks fetch with pagination and staggered API calls...')
    
    const hubspotToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN')
    
    if (!hubspotToken) {
      console.error('HubSpot access token not found in environment variables')
      throw new Error('HubSpot access token not configured. Please check your environment variables.')
    }

    let ownerId = null
    try {
      const body = await req.json()
      ownerId = body?.ownerId
    } catch (e) {
      // No body or invalid JSON, continue without owner filter
    }

    // Fetch tasks from HubSpot (with delays and pagination)
    const tasks = await fetchTasksFromHubSpot({ ownerId, hubspotToken })
    const taskIds = tasks.map((task: HubSpotTask) => task.id)

    // Get task associations (with delay and batching)
    const taskContactMap = await fetchTaskAssociations(taskIds, hubspotToken)

    // Filter tasks: completed tasks don't need contact associations, but not started tasks do
    const filteredTasks = tasks.filter((task: HubSpotTask) => {
      const isCompleted = task.properties?.hs_task_status === 'COMPLETED';
      const hasContact = taskContactMap[task.id];
      
      if (isCompleted) {
        // Allow completed tasks regardless of contact association
        return true;
      } else {
        // Not started tasks must have contact associations
        if (!hasContact) {
          console.log(`❌ DROPPED: Task ${task.id} has no contact association`);
          return false;
        }
        return true;
      }
    })

    console.log(`Filtered tasks: ${filteredTasks.length} out of ${tasks.length} total tasks`)

    // Get unique contact IDs and fetch contact details (with delay and batching)
    const contactIds = new Set(Object.values(taskContactMap))
    const contacts = await fetchContactDetails(contactIds, hubspotToken)

    // Fetch valid owners and build allowed owners set (with delay)
    const { validOwnerIds, ownersMap } = await fetchValidOwners(hubspotToken)

    // Filter tasks by allowed team owners (but allow unassigned tasks)
    const tasksWithAllowedOwners = filterTasksByValidOwners(filteredTasks, validOwnerIds)

    // Transform and filter tasks
    const transformedTasks = transformTasks(tasksWithAllowedOwners, taskContactMap, contacts, ownersMap)

    // Sort tasks: unassigned "New" tasks first, then assigned tasks, then completed tasks
    const sortedTasks = transformedTasks.sort((a, b) => {
      // Completed tasks go to the end
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (a.status !== 'completed' && b.status === 'completed') return -1;
      
      // For not started tasks, prioritize as before
      if (a.status !== 'completed' && b.status !== 'completed') {
        if (a.queue === 'new' && b.queue === 'new') {
          if (a.isUnassigned && !b.isUnassigned) return -1;
          if (!a.isUnassigned && b.isUnassigned) return 1;
        }
      }
      
      return 0; // Keep original order for other cases
    });

    console.log('Final transformed and sorted tasks:', sortedTasks.length);
    console.log('API calls completed with pagination and staggered delays to avoid rate limiting');

    return new Response(
      JSON.stringify({ 
        tasks: sortedTasks.map(({ taskDueDate, ...task }) => task),
        total: sortedTasks.length,
        success: true
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    )

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
