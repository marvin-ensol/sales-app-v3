import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { 
  HUBSPOT_ALLOWED_TEAMS, 
  API_CONFIG, 
  PRIORITY_MAP, 
  TASK_STATUS,
  CORS_HEADERS 
} from './constants.ts';
import { 
  getCurrentParisTime,
  formatTaskDate,
  getParisTimeFromUTC
} from './dateUtils.ts';
import {
  HubSpotTask,
  HubSpotOwner,
  delay,
  createUnassignedNewTasksRequest,
  createOwnerTasksRequest,
  createCompletedTasksRequest,
  createRappelsRdvTasksRequest,
  getTaskQueue,
  formatOwnerName,
  createAssociationsBatchRequest,
  createContactsBatchRequest
} from './hubspotUtils.ts';

interface TaskFilterParams {
  ownerId?: string;
  hubspotToken: string;
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
      limit: API_CONFIG.PAGINATION_LIMIT,
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
      await delay(API_CONFIG.BATCH_DELAY);
    }
  }

  console.log(`Completed pagination: ${pageCount} pages, ${allResults.length} total results`);
  return allResults;
}

async function fetchUnassignedNewTasks(hubspotToken: string): Promise<HubSpotTask[]> {
  console.log('Fetching unassigned New tasks...');
  
  const requestBody = createUnassignedNewTasksRequest();
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
  
  const requestBody = createOwnerTasksRequest(ownerId);
  const results = await fetchAllPages(
    'https://api.hubapi.com/crm/v3/objects/tasks/search',
    requestBody,
    hubspotToken,
    API_CONFIG.FETCH_DELAY
  );

  console.log('Owner tasks fetched:', results.length);
  return results;
}

async function fetchCompletedTasksToday(ownerId: string, hubspotToken: string): Promise<HubSpotTask[]> {
  console.log('Fetching completed tasks for today for owner:', ownerId);
  
  const requestBody = createCompletedTasksRequest(ownerId);
  const results = await fetchAllPages(
    'https://api.hubapi.com/crm/v3/objects/tasks/search',
    requestBody,
    hubspotToken,
    API_CONFIG.FETCH_DELAY
  );

  console.log('Completed tasks fetched:', results.length);
  return results;
}

async function fetchRappelsRdvTasks(ownerId: string, hubspotToken: string): Promise<HubSpotTask[]> {
  console.log('Fetching Rappels & RDV tasks for owner:', ownerId);
  
  const requestBody = createRappelsRdvTasksRequest(ownerId);
  const results = await fetchAllPages(
    'https://api.hubapi.com/crm/v3/objects/tasks/search',
    requestBody,
    hubspotToken,
    API_CONFIG.FETCH_DELAY * 2
  );

  console.log('Rappels & RDV tasks fetched:', results.length);
  return results;
}

async function fetchTasksFromHubSpot({ ownerId, hubspotToken }: TaskFilterParams) {
  console.log('Owner filter:', ownerId);
  console.log('Starting API calls with delays and pagination to retrieve all tasks...');

  const unassignedTasks = await fetchUnassignedNewTasks(hubspotToken);
  
  let ownerTasks: HubSpotTask[] = [];
  let completedTasks: HubSpotTask[] = [];
  let rappelsRdvTasks: HubSpotTask[] = [];
  
  if (ownerId) {
    ownerTasks = await fetchOwnerTasks(ownerId, hubspotToken);
    completedTasks = await fetchCompletedTasksToday(ownerId, hubspotToken);
    rappelsRdvTasks = await fetchRappelsRdvTasks(ownerId, hubspotToken);
  }

  const allTasks = [...unassignedTasks, ...completedTasks, ...rappelsRdvTasks];
  const taskIds = new Set(unassignedTasks.map(task => task.id));
  
  completedTasks.forEach(task => {
    if (!taskIds.has(task.id)) {
      taskIds.add(task.id);
    }
  });
  
  rappelsRdvTasks.forEach(task => {
    if (!taskIds.has(task.id)) {
      allTasks.push(task);
      taskIds.add(task.id);
    }
  });
  
  ownerTasks.forEach(task => {
    if (!taskIds.has(task.id)) {
      allTasks.push(task);
      taskIds.add(task.id);
    }
  });

  console.log(`Combined tasks: ${allTasks.length} (${unassignedTasks.length} unassigned + ${ownerTasks.length} owner tasks + ${completedTasks.length} completed today + ${rappelsRdvTasks.length} rappels & rdv)`);
  
  return allTasks;
}

async function fetchTaskAssociations(taskIds: string[], hubspotToken: string) {
  let taskContactMap: { [key: string]: string } = {}
  
  if (taskIds.length > 0) {
    await delay(API_CONFIG.FETCH_DELAY);
    
    console.log(`Fetching task associations for ${taskIds.length} tasks in batches of ${API_CONFIG.BATCH_SIZE}...`);

    for (let i = 0; i < taskIds.length; i += API_CONFIG.BATCH_SIZE) {
      const batch = taskIds.slice(i, i + API_CONFIG.BATCH_SIZE);
      const batchNumber = Math.floor(i / API_CONFIG.BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(taskIds.length / API_CONFIG.BATCH_SIZE);
      
      console.log(`Fetching associations batch ${batchNumber}/${totalBatches} (${batch.length} tasks)...`);

      if (i > 0) {
        await delay(API_CONFIG.BATCH_DELAY);
      }

      const associationsResponse = await fetch(
        `https://api.hubapi.com/crm/v4/associations/tasks/contacts/batch/read`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${hubspotToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(createAssociationsBatchRequest(batch))
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
    
    await delay(API_CONFIG.FETCH_DELAY);
    
    const contactIdsArray = Array.from(contactIds)
    
    for (let i = 0; i < contactIdsArray.length; i += API_CONFIG.BATCH_SIZE) {
      const batch = contactIdsArray.slice(i, i + API_CONFIG.BATCH_SIZE)
      const batchNumber = Math.floor(i / API_CONFIG.BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(contactIdsArray.length / API_CONFIG.BATCH_SIZE);
      
      console.log(`Fetching contacts batch ${batchNumber}/${totalBatches} (${batch.length} contacts)...`);
      
      if (i > 0) {
        await delay(API_CONFIG.BATCH_DELAY);
      }
      
      const contactsResponse = await fetch(
        `https://api.hubapi.com/crm/v3/objects/contacts/batch/read`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${hubspotToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(createContactsBatchRequest(batch))
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
  
  await delay(API_CONFIG.FETCH_DELAY);
  
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
    
    const validOwners = allOwnersData.results?.filter((owner: HubSpotOwner) => {
      const ownerTeams = owner.teams || []
      const hasAllowedTeam = ownerTeams.some((team: any) => {
        const teamIdString = team.id?.toString()
        return HUBSPOT_ALLOWED_TEAMS.includes(teamIdString)
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
      dueDate = formatTaskDate(props.hs_timestamp);
    }

    const taskOwnerId = props.hubspot_owner_id;
    const owner = taskOwnerId ? ownersMap[taskOwnerId] : null;
    const ownerName = formatOwnerName(owner);

    const queueIds = props.hs_queue_membership_ids ? props.hs_queue_membership_ids.split(';') : [];
    const queue = getTaskQueue(queueIds);

    const isCompleted = props.hs_task_status === TASK_STATUS.COMPLETED;
    const status = isCompleted ? TASK_STATUS.completed : TASK_STATUS.not_started;

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
      priority: PRIORITY_MAP[props.hs_task_priority] || 'medium',
      owner: ownerName,
      hubspotId: task.id,
      queue: queue,
      queueIds: queueIds,
      isUnassigned: !taskOwnerId,
      completionDate: props.hs_task_completion_date ? new Date(parseInt(props.hs_task_completion_date)) : null
    };
  }).filter((task: any) => {
    if (task.status === TASK_STATUS.completed) {
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
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

    const tasks = await fetchTasksFromHubSpot({ ownerId, hubspotToken })
    const taskIds = tasks.map((task: HubSpotTask) => task.id)

    const taskContactMap = await fetchTaskAssociations(taskIds, hubspotToken)

    const filteredTasks = tasks.filter((task: HubSpotTask) => {
      const isCompleted = task.properties?.hs_task_status === TASK_STATUS.COMPLETED;
      const hasContact = taskContactMap[task.id];
      
      if (isCompleted) {
        return true;
      } else {
        if (!hasContact) {
          console.log(`❌ DROPPED: Task ${task.id} has no contact association`);
          return false;
        }
        return true;
      }
    })

    console.log(`Filtered tasks: ${filteredTasks.length} out of ${tasks.length} total tasks`)

    const contactIds = new Set(Object.values(taskContactMap))
    const contacts = await fetchContactDetails(contactIds, hubspotToken)

    const { validOwnerIds, ownersMap } = await fetchValidOwners(hubspotToken)

    const tasksWithAllowedOwners = filterTasksByValidOwners(filteredTasks, validOwnerIds)

    const transformedTasks = transformTasks(tasksWithAllowedOwners, taskContactMap, contacts, ownersMap)

    const sortedTasks = transformedTasks.sort((a, b) => {
      if (a.status === TASK_STATUS.completed && b.status !== TASK_STATUS.completed) return 1;
      if (a.status !== TASK_STATUS.completed && b.status === TASK_STATUS.completed) return -1;
      
      if (a.status !== TASK_STATUS.completed && b.status !== TASK_STATUS.completed) {
        if (a.queue === 'new' && b.queue === 'new') {
          if (a.isUnassigned && !b.isUnassigned) return -1;
          if (!a.isUnassigned && b.isUnassigned) return 1;
        }
      }
      
      return 0;
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
          ...CORS_HEADERS,
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
          ...CORS_HEADERS, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})
