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
  };
}

interface HubSpotOwner {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  teams?: Array<{ id: string }>;
}

async function fetchTasksFromHubSpot({ ownerId, hubspotToken }: TaskFilterParams) {
  console.log('Owner filter:', ownerId);

  // Create filter groups: one for unassigned tasks in "New" queue, one for selected owner's tasks
  const filterGroups = [
    // Filter group for unassigned tasks in "New" queue (queue ID: 22859489)
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
  ];

  // Add filter group for selected owner's tasks if ownerId is provided
  if (ownerId) {
    filterGroups.push({
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
    });
    console.log("Added ownerId filter group for:", ownerId);
  }

  const tasksResponse = await fetch(
    `https://api.hubapi.com/crm/v3/objects/tasks/search`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hubspotToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filterGroups: filterGroups,
        properties: [
          'hs_task_subject',
          'hs_body_preview',
          'hs_task_status',
          'hs_task_priority',
          'hs_task_type',
          'hs_timestamp',
          'hubspot_owner_id',
          'hs_queue_membership_ids',
          'hs_lastmodifieddate'
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
  )

  if (!tasksResponse.ok) {
    const errorText = await tasksResponse.text()
    console.error(`HubSpot API error: ${tasksResponse.status} - ${errorText}`)
    throw new Error(`HubSpot API error: ${tasksResponse.status} - ${errorText}`)
  }

  const tasksData = await tasksResponse.json()
  console.log('Tasks fetched successfully:', tasksData.results?.length || 0)
  
  return tasksData.results || []
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

    return {
      id: task.id,
      title: props.hs_task_subject || 'Untitled Task',
      description: props.hs_body_preview || undefined,
      contact: contactName,
      contactId: contactId || null,
      contactPhone: contactPhone,
      status: 'not_started',
      dueDate,
      taskDueDate,
      priority: priorityMap[props.hs_task_priority] || 'medium',
      owner: ownerName,
      hubspotId: task.id,
      queue: queue,
      queueIds: queueIds,
      isUnassigned: !taskOwnerId
    };
  }).filter((task: any) => {
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

    // Fetch tasks from HubSpot (both unassigned "New" tasks and selected owner's tasks)
    const tasks = await fetchTasksFromHubSpot({ ownerId, hubspotToken })
    const taskIds = tasks.map((task: HubSpotTask) => task.id)

    // Get task associations
    const taskContactMap = await fetchTaskAssociations(taskIds, hubspotToken)

    // Filter out tasks that don't have contact associations (for assigned tasks only)
    const tasksWithContactsOrUnassigned = tasks.filter((task: HubSpotTask) => {
      const isUnassigned = !task.properties?.hubspot_owner_id;
      const hasContact = taskContactMap[task.id];
      
      // Keep all unassigned tasks (they will always have contact associations)
      if (isUnassigned) {
        return true;
      }
      
      // For assigned tasks, require contact association
      return hasContact;
    })

    console.log(`Filtered tasks with contacts or unassigned: ${tasksWithContactsOrUnassigned.length} out of ${tasks.length} total tasks`)

    // Get unique contact IDs and fetch contact details
    const contactIds = new Set(Object.values(taskContactMap))
    const contacts = await fetchContactDetails(contactIds, hubspotToken)

    // Fetch valid owners and build allowed owners set
    const { validOwnerIds, ownersMap } = await fetchValidOwners(hubspotToken)

    // Filter tasks by allowed team owners (but allow unassigned tasks)
    const tasksWithAllowedOwners = filterTasksByValidOwners(tasksWithContactsOrUnassigned, validOwnerIds)

    // Transform and filter tasks
    const transformedTasks = transformTasks(tasksWithAllowedOwners, taskContactMap, contacts, ownersMap)

    // Sort tasks: unassigned "New" tasks first, then assigned tasks
    const sortedTasks = transformedTasks.sort((a, b) => {
      // If both are in "new" queue, prioritize unassigned tasks
      if (a.queue === 'new' && b.queue === 'new') {
        if (a.isUnassigned && !b.isUnassigned) return -1;
        if (!a.isUnassigned && b.isUnassigned) return 1;
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
