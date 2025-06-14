
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    console.log('HubSpot token found, proceeding with API calls...')

    // Parse request body to get owner filter
    let ownerId = null
    try {
      const body = await req.json()
      ownerId = body?.ownerId
    } catch (e) {
      // No body or invalid JSON, continue without owner filter
    }

    console.log('Owner filter:', ownerId || 'none')

    // Use NOT_STARTED filter but fix the format for HubSpot API
    const filters = [
      {
        propertyName: 'hs_task_status',
        operator: 'EQ',
        value: 'NOT_STARTED'
      }
    ]

    // Add owner filter if provided
    if (ownerId) {
      filters.push({
        propertyName: 'hubspot_owner_id',
        operator: 'EQ',
        value: ownerId
      })
    }

    console.log('Search filters (fixed format):', JSON.stringify(filters, null, 2))

    // Fetch tasks with NOT_STARTED status only
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
    
    // Log all task IDs to help debug
    const taskIds = tasksData.results?.map((task: any) => task.id) || []
    console.log('Task IDs found:', taskIds)
    console.log('Looking for task 221631177963 in results:', taskIds.includes('221631177963'))
    
    // If we find the specific task, log its details
    const specificTask = tasksData.results?.find((task: any) => task.id === '221631177963')
    if (specificTask) {
      console.log('Found task 221631177963 details:', JSON.stringify(specificTask, null, 2))
    } else {
      console.log('Task 221631177963 NOT found in results')
    }

    // Get task associations using the Associations API
    let taskContactMap: { [key: string]: string } = {}
    
    if (taskIds.length > 0) {
      // Fetch associations for all tasks
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
        console.log('Associations fetched successfully:', JSON.stringify(associationsData, null, 2))
        
        // Build task-to-contact mapping - use toObjectId instead of id
        associationsData.results?.forEach((result: any) => {
          if (result.to && result.to.length > 0) {
            taskContactMap[result.from.id] = result.to[0].toObjectId
            console.log(`Task ${result.from.id} associated with contact ${result.to[0].toObjectId}`)
          }
        })
      } else {
        console.error('Failed to fetch associations:', await associationsResponse.text())
      }
    }

    console.log('Task-Contact mapping:', taskContactMap)

    // Filter out tasks that don't have contact associations
    const tasksWithContacts = tasksData.results?.filter((task: any) => {
      const hasContact = taskContactMap[task.id]
      if (!hasContact) {
        console.log(`Filtering out task ${task.id} (${task.properties?.hs_task_subject}) - no contact association`)
      }
      return hasContact
    }) || []

    console.log(`Filtered tasks with contacts: ${tasksWithContacts.length} out of ${tasksData.results?.length || 0} total tasks`)

    // Get unique contact IDs from associations
    const contactIds = new Set(Object.values(taskContactMap))
    console.log('Contact IDs found:', Array.from(contactIds))

    // Fetch contact details if we have contact IDs
    let contacts = {}
    if (contactIds.size > 0) {
      console.log('Fetching contact details for', contactIds.size, 'contacts')
      const contactsResponse = await fetch(
        `https://api.hubapi.com/crm/v3/objects/contacts/batch/read`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${hubspotToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: Array.from(contactIds).map(id => ({ id })),
            properties: ['firstname', 'lastname', 'email', 'company']
          })
        }
      )

      if (contactsResponse.ok) {
        const contactsData = await contactsResponse.json()
        console.log('Contacts fetched successfully:', contactsData.results?.length || 0)
        console.log('Contact details:', JSON.stringify(contactsData.results, null, 2))
        contacts = contactsData.results?.reduce((acc: any, contact: any) => {
          acc[contact.id] = contact
          return acc
        }, {}) || {}
      } else {
        console.error('Failed to fetch contacts:', await contactsResponse.text())
      }
    }

    // Get owner details for all unique owner IDs - FIXED: Get ALL owners first, then filter
    console.log('Fetching all owners from HubSpot...')
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

    let ownersMap = {}
    if (allOwnersResponse.ok) {
      const allOwnersData = await allOwnersResponse.json()
      console.log('All owners fetched successfully:', allOwnersData.results?.length || 0)
      
      // Create a map of all owners by ID
      ownersMap = allOwnersData.results?.reduce((acc: any, owner: any) => {
        acc[owner.id] = owner
        console.log(`Owner ${owner.id}: ${owner.firstName} ${owner.lastName} (${owner.email})`)
        return acc
      }, {}) || {}
    } else {
      console.error('Failed to fetch owners:', await allOwnersResponse.text())
    }

    // Get current date for filtering - now only show overdue tasks
    const currentDate = new Date()
    console.log('Current date for overdue filtering:', currentDate)

    // Transform tasks to our format and filter by overdue status only
    const transformedTasks = tasksWithContacts.map((task: any) => {
      const props = task.properties
      
      console.log(`Processing task ${task.id}:`, {
        title: props.hs_task_subject,
        owner_id: props.hubspot_owner_id,
        status: props.hs_task_status,
        timestamp: props.hs_timestamp,
        lastmodified: props.hs_lastmodifieddate
      })
      
      // Get associated contact from our mapping
      const contactId = taskContactMap[task.id] || null
      const contact = contactId ? contacts[contactId] : null
      
      let contactName = 'No Contact'
      if (contact) {
        const firstName = contact.properties?.firstname || ''
        const lastName = contact.properties?.lastname || ''
        const email = contact.properties?.email || ''
        const company = contact.properties?.company || ''
        
        console.log(`Contact ${contactId} details:`, { firstName, lastName, email, company })
        
        if (firstName || lastName) {
          contactName = `${firstName} ${lastName}`.trim()
        } else if (email) {
          contactName = email
        } else if (company) {
          contactName = company
        }
      }

      // Format due date - hs_timestamp is in ISO format, convert to GMT+2 (Paris time)
      let dueDate = ''
      let taskDueDate = null
      if (props.hs_timestamp) {
        console.log('Raw timestamp:', props.hs_timestamp)
        const date = new Date(props.hs_timestamp)
        console.log('Parsed date UTC:', date)
        
        // Store the actual due date for filtering
        taskDueDate = date
        
        // Convert to GMT+2 (Paris time)
        const parisDate = new Date(date.getTime() + (2 * 60 * 60 * 1000)) // Add 2 hours for GMT+2
        console.log('Paris date:', parisDate)
        
        // Format as DD/MM à HH:MM in Paris time
        const day = parisDate.getUTCDate().toString().padStart(2, '0')
        const month = (parisDate.getUTCMonth() + 1).toString().padStart(2, '0')
        const hours = parisDate.getUTCHours().toString().padStart(2, '0')
        const minutes = parisDate.getUTCMinutes().toString().padStart(2, '0')
        dueDate = `${day}/${month} à ${hours}:${minutes}`
        console.log('Formatted due date (GMT+2):', dueDate)
      }

      // Map priority
      const priorityMap: { [key: string]: string } = {
        'HIGH': 'high',
        'MEDIUM': 'medium',
        'LOW': 'low'
      }

      // Get owner name - FIXED: Use the ownersMap to get proper owner details
      const taskOwnerId = props.hubspot_owner_id
      const owner = taskOwnerId ? ownersMap[taskOwnerId] : null
      const ownerName = owner 
        ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.email || 'Unknown Owner'
        : 'Unassigned'

      console.log(`Task ${task.id} owner ID: ${taskOwnerId}, Owner details:`, owner, `Resolved name: ${ownerName}`)

      // Determine queue based on hs_queue_membership_ids using correct IDs
      let queue = 'other'
      const queueIds = props.hs_queue_membership_ids ? props.hs_queue_membership_ids.split(';') : []
      
      // Use the correct queue IDs: 22859489 for new, 22859490 for attempted
      if (queueIds.includes('22859489')) {
        queue = 'new'
      } else if (queueIds.includes('22859490')) {
        queue = 'attempted'
      }

      console.log(`Task: ${props.hs_task_subject}, Contact ID: ${contactId}, Contact: ${contactName}, Queue IDs: ${queueIds.join(',')}, Assigned Queue: ${queue}, Owner: ${ownerName}`)

      return {
        id: task.id,
        title: props.hs_task_subject || 'Untitled Task',
        description: props.hs_task_body || undefined,
        contact: contactName,
        contactId: contactId || null,
        status: 'not_started', // All tasks are NOT_STARTED due to our filter
        dueDate,
        taskDueDate, // Store the actual date for filtering
        priority: priorityMap[props.hs_task_priority] || 'medium',
        owner: ownerName,
        hubspotId: task.id,
        queue: queue,
        queueIds: queueIds
      }
    }).filter((task: any) => {
      // Only include tasks that are OVERDUE (not just due today)
      if (!task.taskDueDate) return false
      const isOverdue = task.taskDueDate < currentDate
      console.log(`Task ${task.id} overdue check: due=${task.taskDueDate}, current=${currentDate}, overdue=${isOverdue}`)
      return isOverdue
    }) || []

    console.log('Transformed and filtered tasks (overdue only, with contacts):', transformedTasks.length)

    return new Response(
      JSON.stringify({ 
        tasks: transformedTasks.map(({ taskDueDate, ...task }) => task), // Remove taskDueDate from response
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
