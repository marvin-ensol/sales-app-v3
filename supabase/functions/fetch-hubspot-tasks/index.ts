import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TaskFilterParams {
  ownerId?: string;
  hubspotToken: string;
  debugTaskId?: string;
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

function debugLog(message: string, debugTaskId?: string) {
  if (debugTaskId) {
    console.log(`🔍 DEBUG [${debugTaskId}]: ${message}`);
  } else {
    console.log(`📋 GENERAL: ${message}`);
  }
}

async function fetchSpecificTaskDetails(taskId: string, hubspotToken: string) {
  debugLog(`🔍 DIRECT FETCH: Starting direct fetch for task ${taskId}`, taskId);
  
  try {
    // Fetch the specific task directly
    const taskResponse = await fetch(
      `https://api.hubapi.com/crm/v3/objects/tasks/${taskId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${hubspotToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!taskResponse.ok) {
      debugLog(`❌ DIRECT FETCH FAILED: ${taskResponse.status} - ${await taskResponse.text()}`, taskId);
      return null;
    }

    const taskData = await taskResponse.json();
    debugLog(`✅ DIRECT FETCH SUCCESS: Task found with properties: ${JSON.stringify(taskData.properties, null, 2)}`, taskId);

    // Fetch task associations
    let contactId = null;
    let contactDetails = null;
    
    try {
      const associationsResponse = await fetch(
        `https://api.hubapi.com/crm/v4/objects/tasks/${taskId}/associations/contacts`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${hubspotToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (associationsResponse.ok) {
        const associationsData = await associationsResponse.json();
        debugLog(`🔗 ASSOCIATIONS: ${JSON.stringify(associationsData, null, 2)}`, taskId);
        
        if (associationsData.results && associationsData.results.length > 0) {
          contactId = associationsData.results[0].toObjectId;
          debugLog(`✅ CONTACT FOUND: Associated with contact ID ${contactId}`, taskId);

          // Fetch contact details
          const contactResponse = await fetch(
            `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${hubspotToken}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (contactResponse.ok) {
            contactDetails = await contactResponse.json();
            debugLog(`👤 CONTACT DETAILS: ${JSON.stringify(contactDetails.properties, null, 2)}`, taskId);
          }
        } else {
          debugLog(`❌ NO CONTACT ASSOCIATION found`, taskId);
        }
      } else {
        debugLog(`❌ ASSOCIATIONS FETCH FAILED: ${associationsResponse.status}`, taskId);
      }
    } catch (error) {
      debugLog(`❌ ASSOCIATIONS ERROR: ${error.message}`, taskId);
    }

    // Analyze why this task might be filtered out
    debugLog(`🔍 FILTER ANALYSIS for task ${taskId}:`, taskId);
    debugLog(`  - Status: ${taskData.properties?.hs_task_status} (needed: NOT_STARTED)`, taskId);
    debugLog(`  - Owner ID: ${taskData.properties?.hubspot_owner_id || 'UNASSIGNED'}`, taskId);
    debugLog(`  - Queue IDs: ${taskData.properties?.hs_queue_membership_ids || 'NONE'}`, taskId);
    debugLog(`  - Timestamp: ${taskData.properties?.hs_timestamp}`, taskId);
    debugLog(`  - Contact Association: ${contactId ? 'YES' : 'NO'}`, taskId);

    // Check if task would pass our filters
    const isNotStarted = taskData.properties?.hs_task_status === 'NOT_STARTED';
    const hasContact = !!contactId;
    const hasTimestamp = !!taskData.properties?.hs_timestamp;
    const isOverdue = hasTimestamp ? new Date(taskData.properties.hs_timestamp) < new Date() : false;

    debugLog(`🔍 FILTER RESULTS:`, taskId);
    debugLog(`  - NOT_STARTED status: ${isNotStarted ? '✅ PASS' : '❌ FAIL'}`, taskId);
    debugLog(`  - Has contact: ${hasContact ? '✅ PASS' : '❌ FAIL'}`, taskId);
    debugLog(`  - Has timestamp: ${hasTimestamp ? '✅ PASS' : '❌ FAIL'}`, taskId);
    debugLog(`  - Is overdue: ${isOverdue ? '✅ PASS' : '❌ FAIL'}`, taskId);

    return {
      task: taskData,
      contact: contactDetails,
      contactId,
      filterAnalysis: {
        isNotStarted,
        hasContact,
        hasTimestamp,
        isOverdue,
        wouldPassFilters: isNotStarted && hasContact && hasTimestamp && isOverdue
      }
    };

  } catch (error) {
    debugLog(`❌ DIRECT FETCH ERROR: ${error.message}`, taskId);
    return null;
  }
}

async function fetchTasksFromHubSpot({ ownerId, hubspotToken, debugTaskId }: TaskFilterParams) {
  debugLog(`Starting task fetch. Owner filter: ${ownerId || 'none (ALL OWNERS)'}`, debugTaskId);

  // If we have a debug task ID, fetch it directly first
  if (debugTaskId) {
    await fetchSpecificTaskDetails(debugTaskId, hubspotToken);
    debugLog(`🔍 Now proceeding with normal search to see if debug task appears...`, debugTaskId);
  }

  const filters = [
    {
      propertyName: 'hs_task_status',
      operator: 'EQ',
      value: 'NOT_STARTED'
    }
  ]

  debugLog("Fetching tasks for both assigned and unassigned owners", debugTaskId);

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
  const allTasks = tasksData.results || []
  
  debugLog(`Tasks fetched from HubSpot: ${allTasks.length}`, debugTaskId);
  
  // Check if our debug task is in the initial fetch
  if (debugTaskId) {
    const debugTask = allTasks.find((task: HubSpotTask) => task.id === debugTaskId);
    if (debugTask) {
      debugLog(`✅ Found debug task in initial fetch. Status: ${debugTask.properties?.hs_task_status}, Owner: ${debugTask.properties?.hubspot_owner_id || 'UNASSIGNED'}, Queue IDs: ${debugTask.properties?.hs_queue_membership_ids || 'NONE'}, Timestamp: ${debugTask.properties?.hs_timestamp}`, debugTaskId);
    } else {
      debugLog(`❌ Debug task NOT found in initial fetch. This means it either doesn't exist, isn't NOT_STARTED status, or was filtered out by HubSpot API`, debugTaskId);
    }
  }
  
  return allTasks
}

async function fetchTaskAssociations(taskIds: string[], hubspotToken: string, debugTaskId?: string) {
  let taskContactMap: { [key: string]: string } = {}
  
  if (taskIds.length > 0) {
    debugLog(`Fetching associations for ${taskIds.length} tasks`, debugTaskId);
    
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
      debugLog('Task associations fetched successfully', debugTaskId);
      
      associationsData.results?.forEach((result: any) => {
        if (result.to && result.to.length > 0) {
          taskContactMap[result.from.id] = result.to[0].toObjectId
        }
      })
      
      // Debug specific task association
      if (debugTaskId && taskIds.includes(debugTaskId)) {
        const debugContact = taskContactMap[debugTaskId];
        debugLog(`Association check: ${debugContact ? `✅ Associated with contact ${debugContact}` : '❌ NO contact association found'}`, debugTaskId);
      }
    } else {
      console.error('Failed to fetch associations:', await associationsResponse.text())
    }
  }

  return taskContactMap
}

async function fetchContactDetails(contactIds: Set<string>, hubspotToken: string, debugTaskId?: string) {
  let contacts = {}
  if (contactIds.size > 0) {
    debugLog(`Fetching contact details for ${contactIds.size} contacts`, debugTaskId);
    
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
    
    debugLog(`Total contacts fetched: ${Object.keys(contacts).length}`, debugTaskId);
  }

  return contacts
}

async function fetchValidOwners(hubspotToken: string, debugTaskId?: string) {
  debugLog('Fetching filtered owners from HubSpot...', debugTaskId);
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
    debugLog(`Owners fetched successfully: ${allOwnersData.results?.length || 0}`, debugTaskId);
    
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

    debugLog(`Valid owners (in allowed teams): ${validOwners.length}`, debugTaskId);
    
    ownersMap = validOwners.reduce((acc: any, owner: HubSpotOwner) => {
      acc[owner.id] = owner
      return acc
    }, {}) || {}
  } else {
    console.error('Failed to fetch owners:', await allOwnersResponse.text())
  }

  return { validOwnerIds, ownersMap }
}

function filterTasksByValidOwners(tasks: HubSpotTask[], validOwnerIds: Set<string>, ownerId?: string, debugTaskId?: string) {
  debugLog(`Starting owner filtering. Input tasks: ${tasks.length}`, debugTaskId);
  
  const filteredTasks = tasks.filter((task: HubSpotTask) => {
    const taskOwnerId = task.properties?.hubspot_owner_id;
    const isDebugTask = debugTaskId && task.id === debugTaskId;
    
    // Include tasks with no owner (unassigned)
    if (!taskOwnerId) {
      if (isDebugTask) {
        debugLog(`✅ INCLUDED: Task has NO OWNER (unassigned)`, debugTaskId);
      } else {
        console.log(`✔️ INCLUDED: Task ${task.id} has NO OWNER (unassigned)`);
      }
      return true;
    }
    
    // Include tasks with valid owners
    if (validOwnerIds.has(taskOwnerId.toString())) {
      // If a specific owner is requested, only include their tasks and unassigned tasks
      if (ownerId) {
        if (taskOwnerId === ownerId) {
          if (isDebugTask) {
            debugLog(`✅ INCLUDED: Task belongs to selected owner ${taskOwnerId}`, debugTaskId);
          } else {
            console.log(`✔️ INCLUDED: Task ${task.id} belongs to selected owner ${taskOwnerId}`);
          }
          return true;
        } else {
          if (isDebugTask) {
            debugLog(`❌ FILTERED OUT: Task belongs to different owner ${taskOwnerId} (selected: ${ownerId})`, debugTaskId);
          } else {
            console.log(`❌ FILTERED OUT: Task ${task.id} belongs to different owner ${taskOwnerId}`);
          }
          return false;
        }
      }
      return true;
    } else {
      if (isDebugTask) {
        debugLog(`❌ DROPPED: Task ownerId ${taskOwnerId} not in allowed teams`, debugTaskId);
      } else {
        console.log(`❌ DROPPED: Task ${task.id} ownerId ${taskOwnerId} not in allowed teams`);
      }
      return false;
    }
  });

  debugLog(`After owner filtering: ${filteredTasks.length} tasks remaining`, debugTaskId);
  return filteredTasks;
}

function transformTasks(tasks: HubSpotTask[], taskContactMap: { [key: string]: string }, contacts: any, ownersMap: any, debugTaskId?: string) {
  const currentDate = new Date()
  debugLog(`Starting task transformation. Input tasks: ${tasks.length}`, debugTaskId);

  const transformedTasks = tasks.map((task: HubSpotTask) => {
    const props = task.properties;
    const isDebugTask = debugTaskId && task.id === debugTaskId;

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

    if (isDebugTask) {
      debugLog(`Transformation details - Contact: ${contactName}, Queue: ${queue}, Queue IDs: ${queueIds.join(',')}, Due Date: ${dueDate}, Owner: ${ownerName}`, debugTaskId);
    }

    return {
      id: task.id,
      title: props.hs_task_subject || 'Untitled Task',
      description: props.hs_task_body || undefined,
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
    if (!task.taskDueDate) {
      if (debugTaskId && task.id === debugTaskId) {
        debugLog(`❌ FILTERED OUT: No due date`, debugTaskId);
      }
      return false;
    }
    const isOverdue = task.taskDueDate < currentDate;
    if (!isOverdue) {
      if (debugTaskId && task.id === debugTaskId) {
        debugLog(`❌ FILTERED OUT: Not overdue (due: ${task.taskDueDate.toISOString()}, current: ${currentDate.toISOString()})`, debugTaskId);
      }
      return false;
    }
    if (debugTaskId && task.id === debugTaskId) {
      debugLog(`✅ PASSED: Task is overdue and will be included in final results`, debugTaskId);
    }
    return true;
  });

  debugLog(`Final transformed tasks: ${transformedTasks.length}`, debugTaskId);
  return transformedTasks;
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
    let debugTaskId = null
    try {
      const body = await req.json()
      ownerId = body?.ownerId
      debugTaskId = body?.debugTaskId
    } catch (e) {
      // No body or invalid JSON, continue without owner filter
    }

    if (debugTaskId) {
      console.log(`🔍 DEBUG MODE ENABLED for task ID: ${debugTaskId}`);
    }

    // Fetch tasks from HubSpot
    const tasks = await fetchTasksFromHubSpot({ ownerId, hubspotToken, debugTaskId })
    const taskIds = tasks.map((task: HubSpotTask) => task.id)

    // Get task associations
    const taskContactMap = await fetchTaskAssociations(taskIds, hubspotToken, debugTaskId)

    // Filter out tasks that don't have contact associations
    const tasksWithContacts = tasks.filter((task: HubSpotTask) => {
      const hasContact = taskContactMap[task.id];
      if (debugTaskId && task.id === debugTaskId) {
        debugLog(`Contact association filter: ${hasContact ? '✅ HAS contact association' : '❌ NO contact association - FILTERED OUT'}`, debugTaskId);
      }
      return hasContact;
    })

    debugLog(`Filtered tasks with contacts: ${tasksWithContacts.length} out of ${tasks.length} total tasks`, debugTaskId);

    // Get unique contact IDs and fetch contact details
    const contactIds = new Set(Object.values(taskContactMap))
    const contacts = await fetchContactDetails(contactIds, hubspotToken, debugTaskId)

    // Fetch valid owners and build allowed owners set
    const { validOwnerIds, ownersMap } = await fetchValidOwners(hubspotToken, debugTaskId)

    // Filter tasks by allowed team owners and owner selection
    const tasksWithAllowedOwners = filterTasksByValidOwners(tasksWithContacts, validOwnerIds, ownerId, debugTaskId)

    // Transform and filter tasks
    const transformedTasks = transformTasks(tasksWithAllowedOwners, taskContactMap, contacts, ownersMap, debugTaskId)

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
