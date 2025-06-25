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

async function fetchUnassignedNewTasks(hubspotToken: string): Promise<HubSpotTask[]> {
  console.log('Fetching unassigned New tasks...');
  
  const unassignedResponse = await fetch(
    `https://api.hubapi.com/crm/v3/objects/tasks/search`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hubspotToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
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
        limit: 100,
        sorts: [
          {
            propertyName: 'hs_timestamp',
            direction: 'ASCENDING'
          }
        ]
      })
    }
  );

  if (!unassignedResponse.ok) {
    const errorText = await unassignedResponse.text();
    console.error(`HubSpot unassigned tasks API error: ${unassignedResponse.status} - ${errorText}`);
    throw new Error(`HubSpot unassigned tasks API error: ${unassignedResponse.status} - ${errorText}`);
  }

  const unassignedData = await unassignedResponse.json();
  console.log('Unassigned New tasks fetched:', unassignedData.results?.length || 0);
  
  return unassignedData.results || [];
}

async function fetchOwnerTasks(ownerId: string, hubspotToken: string): Promise<HubSpotTask[]> {
  console.log('Fetching owner tasks for:', ownerId);
  
  const ownerResponse = await fetch(
    `https://api.hubapi.com/crm/v3/objects/tasks/search`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hubspotToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
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
        limit: 200,
        sorts: [
          {
            propertyName: 'hs_timestamp',
            direction: 'ASCENDING'
          }
        ]
      })
    }
  );

  if (!ownerResponse.ok) {
    const errorText = await ownerResponse.text();
    console.error(`HubSpot owner tasks API error: ${ownerResponse.status} - ${errorText}`);
    throw new Error(`HubSpot owner tasks API error: ${ownerResponse.status} - ${errorText}`);
  }

  const ownerData = await ownerResponse.json();
  console.log('Owner tasks fetched:', ownerData.results?.length || 0);
  
  return ownerData.results || [];
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

  const completedResponse = await fetch(
    `https://api.hubapi.com/crm/v3/objects/tasks/search`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hubspotToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
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
        limit: 200,
        sorts: [
          {
            propertyName: 'hs_task_completion_date',
            direction: 'DESCENDING'
          }
        ]
      })
    }
  );

  if (!completedResponse.ok) {
    const errorText = await completedResponse.text();
    console.error(`HubSpot completed tasks API error: ${completedResponse.status} - ${errorText}`);
    throw new Error(`HubSpot completed tasks API error: ${completedResponse.status} - ${errorText}`);
  }

  const completedData = await completedResponse.json();
  console.log('Completed tasks fetched:', completedData.results?.length || 0);
  
  return completedData.results || [];
}

async function fetchTasksFromHubSpot({ ownerId, hubspotToken }: TaskFilterParams) {
  console.log('Owner filter:', ownerId);

  // Always fetch unassigned "New" tasks
  const unassignedTasks = await fetchUnassignedNewTasks(hubspotToken);
  
  let ownerTasks: HubSpotTask[] = [];
  let completedTasks: HubSpotTask[] = [];
  
  if (ownerId) {
    ownerTasks = await fetchOwnerTasks(ownerId, hubspotToken);
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
    const associationsResponse = await fetch(
      `https://api.hubapi.com/crm/v4/associations/tasks/contacts/batch/read`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hubspotToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: taskIds.map(id => ({ id }))
        })
      }
    )

    if (associationsResponse.ok) {
      const associationsData = await associationsResponse.json()
      console.log('Task associations fetched successfully')
      
      associationsData.results?.forEach((result: any) => {
        if (result.to && result.to.length > 0) {
          taskContactMap[result.from.id] = result.to[0].toObjectId
        }
      })
    } else {
      console.error('Failed to fetch associations:', await associationsResponse.text())
    }
  }

  return taskContactMap
}

async function fetchContactDetails(contactIds: Set<string>, hubspotToken: string) {
  let contacts = {}
  if (contactIds.size > 0) {
    console.log('Fetching contact details for', contactIds.size, 'contacts')
    
    const contactIdsArray = Array.from(contactIds)
    const batchSize = 100
    
    for (let i = 0; i < contactIdsArray.length; i += batchSize) {
      const batch = contactIdsArray.slice(i, i + batchSize)
      
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
      } else {
        console.error(`Failed to fetch contact batch ${Math.floor(i/batchSize) + 1}:`, await contactsResponse.text())
      }
    }
    
    console.log('Total contacts fetched:', Object.keys(contacts).length)
  }

  return contacts
}

async function fetchValidOwners(hubspotToken: string) {
  console.log('Fetching filtered owners from HubSpot...')
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
    console.log('Starting HubSpot tasks fetch...')
    
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

    // Fetch tasks from HubSpot (unassigned "New" tasks + selected owner's tasks + completed tasks today)
    const tasks = await fetchTasksFromHubSpot({ ownerId, hubspotToken })
    const taskIds = tasks.map((task: HubSpotTask) => task.id)

    // Get task associations - but allow tasks without contacts for completed tasks
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

    // Get unique contact IDs and fetch contact details
    const contactIds = new Set(Object.values(taskContactMap))
    const contacts = await fetchContactDetails(contactIds, hubspotToken)

    // Fetch valid owners and build allowed owners set
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
