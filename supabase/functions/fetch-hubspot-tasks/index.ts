
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TaskFilterParams {
  ownerId: string;
  hubspotToken: string;
}

interface HubSpotTask {
  id: string;
  properties: {
    hs_task_subject?: string;
    hs_task_body?: string;
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
  console.log('Fetching tasks for owner:', ownerId);

  const filters = [
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
  ];

  const tasksResponse = await fetch(
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
            filters: filters
          }
        ],
        properties: [
          'hs_task_subject',
          'hs_task_body',
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
            properties: ['firstname', 'lastname', 'email', 'company', 'hs_object_id']
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

async function fetchOwnerDetails(ownerId: string, hubspotToken: string) {
  console.log('Fetching owner details for:', ownerId)
  
  const ownerResponse = await fetch(
    `https://api.hubapi.com/crm/v3/owners/${ownerId}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${hubspotToken}`,
        'Content-Type': 'application/json',
      }
    }
  )

  if (ownerResponse.ok) {
    const ownerData = await ownerResponse.json()
    console.log('Owner details fetched successfully')
    return ownerData
  } else {
    console.error('Failed to fetch owner details:', await ownerResponse.text())
    return null
  }
}

function transformTasks(tasks: HubSpotTask[], taskContactMap: { [key: string]: string }, contacts: any, owner: any) {
  const currentDate = new Date()

  return tasks.map((task: HubSpotTask) => {
    const props = task.properties;

    const contactId = taskContactMap[task.id] || null;
    const contact = contactId ? contacts[contactId] : null;

    let contactName = 'No Contact';
    if (contact && contact.properties) {
      const contactProps = contact.properties;
      const firstName = contactProps.firstname || '';
      const lastName = contactProps.lastname || '';
      const email = contactProps.email || '';
      const company = contactProps.company || '';

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
      description: props.hs_task_body || undefined,
      contact: contactName,
      contactId: contactId || null,
      status: 'not_started',
      dueDate,
      taskDueDate,
      priority: priorityMap[props.hs_task_priority] || 'medium',
      owner: ownerName,
      hubspotId: task.id,
      queue: queue,
      queueIds: queueIds
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
      // No body or invalid JSON
    }

    if (!ownerId) {
      throw new Error('Owner ID is required')
    }

    // Fetch tasks from HubSpot for the specific owner
    const tasks = await fetchTasksFromHubSpot({ ownerId, hubspotToken })
    const taskIds = tasks.map((task: HubSpotTask) => task.id)

    // Get task associations
    const taskContactMap = await fetchTaskAssociations(taskIds, hubspotToken)

    // Filter out tasks that don't have contact associations
    const tasksWithContacts = tasks.filter((task: HubSpotTask) => {
      return taskContactMap[task.id]
    })

    console.log(`Filtered tasks with contacts: ${tasksWithContacts.length} out of ${tasks.length} total tasks`)

    // Get unique contact IDs and fetch contact details
    const contactIds = new Set(Object.values(taskContactMap))
    const contacts = await fetchContactDetails(contactIds, hubspotToken)

    // Fetch owner details
    const owner = await fetchOwnerDetails(ownerId, hubspotToken)

    // Transform and filter tasks
    const transformedTasks = transformTasks(tasksWithContacts, taskContactMap, contacts, owner)

    console.log('Final transformed tasks:', transformedTasks.length);

    return new Response(
      JSON.stringify({ 
        tasks: transformedTasks.map(({ taskDueDate, ...task }) => task),
        total: transformedTasks.length,
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
