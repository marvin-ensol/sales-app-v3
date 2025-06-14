
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
    
    const taskIds = tasksData.results?.map((task: any) => task.id) || []

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
        console.log('Task associations fetched successfully')
        
        // Build task-to-contact mapping - use toObjectId instead of id
        associationsData.results?.forEach((result: any) => {
          if (result.to && result.to.length > 0) {
            taskContactMap[result.from.id] = result.to[0].toObjectId
          }
        })
      } else {
        console.error('Failed to fetch associations:', await associationsResponse.text())
      }
    }

    // Filter out tasks that don't have contact associations
    const tasksWithContacts = tasksData.results?.filter((task: any) => {
      return taskContactMap[task.id]
    }) || []

    console.log(`Filtered tasks with contacts: ${tasksWithContacts.length} out of ${tasksData.results?.length || 0} total tasks`)

    // Get unique contact IDs from associations
    const contactIds = new Set(Object.values(taskContactMap))

    // Fetch contact details in batches of 100 (HubSpot's limit)
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
          
          // Merge this batch into the contacts object
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

    // Get all active owners from the allowed teams
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
      
      // Filter owners by team membership
      const allowedTeamIds = ['162028741', '135903065']
      
      const validOwners = allOwnersData.results?.filter((owner: any) => {
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
      
      // Create a map of all valid owners by ID
      ownersMap = validOwners.reduce((acc: any, owner: any) => {
        acc[owner.id] = owner
        return acc
      }, {}) || {}
    } else {
      console.error('Failed to fetch owners:', await allOwnersResponse.text())
    }

    // Get current date for filtering - now only show overdue tasks
    const currentDate = new Date()

    // Transform tasks to our format and filter by overdue status and valid owners
    const transformedTasks = tasksWithContacts.filter((task: any) => {
      const taskOwnerId = task.properties?.hubspot_owner_id
      
      // Filter out tasks with deactivated owners (not in our valid owner list)
      if (taskOwnerId && !validOwnerIds.has(taskOwnerId.toString())) {
        return false
      }
      
      return true
    }).map((task: any) => {
      const props = task.properties
      
      // Get associated contact from our mapping
      const contactId = taskContactMap[task.id] || null
      const contact = contactId ? contacts[contactId] : null
      
      let contactName = 'No Contact'
      if (contact && contact.properties) {
        const contactProps = contact.properties
        const firstName = contactProps.firstname || ''
        const lastName = contactProps.lastname || ''
        const email = contactProps.email || ''
        const company = contactProps.company || ''
        
        // Enhanced contact name resolution with multiple fallbacks
        if (firstName && lastName) {
          contactName = `${firstName} ${lastName}`.trim()
        } else if (firstName) {
          contactName = firstName
        } else if (lastName) {
          contactName = lastName
        } else if (email) {
          contactName = email
        } else if (company) {
          contactName = company
        } else {
          // Use contact ID as absolute fallback
          contactName = `Contact ${contactId}`
        }
      }

      // Format due date - hs_timestamp is in ISO format, convert to GMT+2 (Paris time)
      let dueDate = ''
      let taskDueDate = null
      if (props.hs_timestamp) {
        const date = new Date(props.hs_timestamp)
        
        // Store the actual due date for filtering
        taskDueDate = date
        
        // Convert to GMT+2 (Paris time)
        const parisDate = new Date(date.getTime() + (2 * 60 * 60 * 1000)) // Add 2 hours for GMT+2
        
        // Format as DD/MM à HH:MM in Paris time
        const day = parisDate.getUTCDate().toString().padStart(2, '0')
        const month = (parisDate.getUTCMonth() + 1).toString().padStart(2, '0')
        const hours = parisDate.getUTCHours().toString().padStart(2, '0')
        const minutes = parisDate.getUTCMinutes().toString().padStart(2, '0')
        dueDate = `${day}/${month} à ${hours}:${minutes}`
      }

      // Map priority
      const priorityMap: { [key: string]: string } = {
        'HIGH': 'high',
        'MEDIUM': 'medium',
        'LOW': 'low'
      }

      // Get owner name - Use the valid ownersMap to get proper owner details
      const taskOwnerId = props.hubspot_owner_id
      const owner = taskOwnerId ? ownersMap[taskOwnerId] : null
      const ownerName = owner 
        ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.email || 'Unknown Owner'
        : 'Unassigned'

      // Determine queue based on hs_queue_membership_ids using correct IDs
      let queue = 'other'
      const queueIds = props.hs_queue_membership_ids ? props.hs_queue_membership_ids.split(';') : []
      
      // Use the correct queue IDs: 22859489 for new, 22859490 for attempted
      if (queueIds.includes('22859489')) {
        queue = 'new'
      } else if (queueIds.includes('22859490')) {
        queue = 'attempted'
      }

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
      return isOverdue
    }) || []

    console.log('Final transformed tasks:', transformedTasks.length)

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
