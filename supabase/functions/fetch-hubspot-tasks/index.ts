
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

    // Get today's date in ISO format for filtering
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()

    console.log('Fetching tasks modified today:', todayISO)

    // Fetch tasks modified today, filtered by owner and status
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
              filters: [
                {
                  propertyName: 'hs_lastmodifieddate',
                  operator: 'GTE',
                  value: todayISO
                },
                {
                  propertyName: 'hubspot_owner_id',
                  operator: 'EQ',
                  value: '1288346562'
                },
                {
                  propertyName: 'hs_task_status',
                  operator: 'EQ',
                  value: 'NOT_STARTED'
                }
              ]
            }
          ],
          properties: [
            'hs_task_subject',
            'hs_task_status',
            'hs_task_priority',
            'hs_task_type',
            'hs_timestamp',
            'hubspot_owner_id',
            'hs_queue_membership_ids'
          ],
          limit: 100
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

    // Get task associations using the Associations API
    const taskIds = tasksData.results?.map((task: any) => task.id) || []
    console.log('Task IDs for association lookup:', taskIds)

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
        
        // Build task-to-contact mapping
        associationsData.results?.forEach((result: any) => {
          if (result.to && result.to.length > 0) {
            taskContactMap[result.from.id] = result.to[0].id
            console.log(`Task ${result.from.id} associated with contact ${result.to[0].id}`)
          }
        })
      } else {
        console.error('Failed to fetch associations:', await associationsResponse.text())
      }
    }

    console.log('Task-Contact mapping:', taskContactMap)

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
        contacts = contactsData.results?.reduce((acc: any, contact: any) => {
          acc[contact.id] = contact
          return acc
        }, {}) || {}
      } else {
        console.error('Failed to fetch contacts:', await contactsResponse.text())
      }
    }

    // Get owner details (though we know it's owner 1288346562)
    let owner = null
    const ownersResponse = await fetch(
      `https://api.hubapi.com/crm/v3/owners/batch/read`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hubspotToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: [{ id: '1288346562' }]
        })
      }
    )

    if (ownersResponse.ok) {
      const ownersData = await ownersResponse.json()
      owner = ownersData.results?.[0]
    }

    const ownerName = owner 
      ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.email || 'Unknown Owner'
      : 'Unassigned'

    // Transform tasks to our format
    const transformedTasks = tasksData.results?.map((task: any) => {
      const props = task.properties
      
      // Get associated contact from our mapping
      const contactId = taskContactMap[task.id] || null
      const contact = contactId ? contacts[contactId] : null
      
      let contactName = 'No Contact'
      if (contact) {
        const firstName = contact.properties?.firstname || ''
        const lastName = contact.properties?.lastname || ''
        const email = contact.properties?.email || ''
        const company = contact.properties?.company || ''
        
        if (firstName || lastName) {
          contactName = `${firstName} ${lastName}`.trim()
        } else if (email) {
          contactName = email
        } else if (company) {
          contactName = company
        }
      }

      // Format due date - hs_timestamp is in ISO format
      let dueDate = ''
      if (props.hs_timestamp) {
        console.log('Raw timestamp:', props.hs_timestamp)
        const date = new Date(props.hs_timestamp)
        console.log('Parsed date:', date)
        
        // Format as DD/MM à HH:MM
        const day = date.getDate().toString().padStart(2, '0')
        const month = (date.getMonth() + 1).toString().padStart(2, '0')
        const hours = date.getHours().toString().padStart(2, '0')
        const minutes = date.getMinutes().toString().padStart(2, '0')
        dueDate = `${day}/${month} à ${hours}:${minutes}`
        console.log('Formatted due date:', dueDate)
      }

      // Map priority
      const priorityMap: { [key: string]: string } = {
        'HIGH': 'high',
        'MEDIUM': 'medium',
        'LOW': 'low'
      }

      // Determine queue based on hs_queue_membership_ids using correct IDs
      let queue = 'other'
      const queueIds = props.hs_queue_membership_ids ? props.hs_queue_membership_ids.split(';') : []
      
      // Use the correct queue IDs: 22859489 for new, 22859490 for attempted
      if (queueIds.includes('22859489')) {
        queue = 'new'
      } else if (queueIds.includes('22859490')) {
        queue = 'attempted'
      }

      console.log(`Task: ${props.hs_task_subject}, Contact ID: ${contactId}, Contact: ${contactName}, Queue IDs: ${queueIds.join(',')}, Assigned Queue: ${queue}`)

      return {
        id: task.id,
        title: props.hs_task_subject || 'Untitled Task',
        contact: contactName,
        contactId: contactId || null,
        status: 'not_started',
        dueDate,
        priority: priorityMap[props.hs_task_priority] || 'medium',
        owner: ownerName,
        hubspotId: task.id,
        queue: queue,
        queueIds: queueIds
      }
    }) || []

    console.log('Transformed tasks successfully:', transformedTasks.length)

    return new Response(
      JSON.stringify({ 
        tasks: transformedTasks,
        total: tasksData.total || 0,
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
